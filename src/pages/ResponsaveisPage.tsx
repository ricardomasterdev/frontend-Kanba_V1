import React, { useEffect, useRef, useState } from 'react'
import {
    listResponsaveis,
    createResponsavel,
    deleteResponsavel,
    searchSecretarias,
    listAllSecretarias,
    type Resp,
    type RespForm,
    type SecretariaDTO,
} from '../services/responsaveis'
import api from '../services/api'

const Spinner: React.FC = () => (
    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
    </svg>
)

const PAGE_SIZE = 10

// helper simples de email
const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((v || '').trim())

// Tenta extrair mensagem de duplicidade de e-mail de vários formatos de erro do back
const extractEmailDupError = (err: any): string | null => {
    const status = err?.response?.status
    const data = err?.response?.data
    const msg = (data?.message || data?.error || err?.message || '').toString()

    // Padrões comuns
    const patterns = [
        /e-?mail.+(já existe|já cadastrado|duplicado|em uso)/i,
        /(email|e-?mail).+(unique|duplic|conflict)/i,
        /(duplicate key|constraint).+(email)/i,
    ]
    if (status === 409) return 'E-mail já cadastrado'
    if (patterns.some(rx => rx.test(msg))) return 'E-mail já cadastrado'

    // Estruturados: { errors: { email: '...' } }
    if (data?.errors?.email) {
        const t = String(data.errors.email)
        if (patterns.some(rx => rx.test(t)) || t) return 'E-mail já cadastrado'
    }

    // Estruturados em array: fieldErrors / violations / details / errors
    const arrays = [data?.fieldErrors, data?.violations, data?.details, data?.errors]
    for (const arr of arrays) {
        if (Array.isArray(arr)) {
            const item = arr.find((x: any) =>
                /email/i.test(x?.field || x?.param || x?.propertyPath || '') ||
                /email/i.test(x?.message || '')
            )
            if (item) return 'E-mail já cadastrado'
        }
    }
    return null
}

const ResponsaveisPage: React.FC = () => {
    const [list, setList] = useState<Resp[]>([])
    const [loading, setLoading] = useState(false)
    const [busy, setBusy] = useState(false)

    // índice local: secretariaId -> nome
    const [secIndex, setSecIndex] = useState<Record<number, string>>({})

    // paginação e filtros
    const [page, setPage] = useState(0)
    const [totalPages, setTotalPages] = useState(0)
    const [q, setQ] = useState('')
    const [filterSecQuery, setFilterSecQuery] = useState('')
    const [filterSecOptions, setFilterSecOptions] = useState<SecretariaDTO[]>([])
    const [filterSecOpen, setFilterSecOpen] = useState(false)
    const [filterSecretariaId, setFilterSecretariaId] = useState<number | null>(null)
    const filterDropdownRef = useRef<HTMLDivElement | null>(null)
    const filterDebounceRef = useRef<number | null>(null)

    // modal (criar/editar)
    const [editOpen, setEditOpen] = useState(false)
    const [createMode, setCreateMode] = useState(false)
    const [editId, setEditId] = useState<number | null>(null)
    const [editForm, setEditForm] = useState<RespForm>({ nome: '', email: '', cargo: '', secretariaId: null })

    // erros de validação do modal
    const [errors, setErrors] = useState<{ nome?: string; email?: string; secretariaId?: string }>({})

    // busca secretaria dentro do modal
    const [secQueryEdit, setSecQueryEdit] = useState('')
    const [secOptionsEdit, setSecOptionsEdit] = useState<SecretariaDTO[]>([])
    const [secOpenEdit, setSecOpenEdit] = useState(false)
    const dropdownRefEdit = useRef<HTMLDivElement | null>(null)
    const debounceRefEdit = useRef<number | null>(null)

    // modal de confirmação de exclusão
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [toDelete, setToDelete] = useState<Resp | null>(null)

    const ensureSecIndexHas = async (ids: number[]) => {
        const unique = Array.from(new Set(ids.filter(id => id != null)))
        const missing = unique.filter(id => secIndex[id] === undefined)
        if (missing.length === 0) return
        const all = await listAllSecretarias()
        if (all?.length) {
            setSecIndex(prev => {
                const next = { ...prev }
                for (const s of all) next[s.id] = s.nome
                return next
            })
        } else {
            setSecIndex(prev => {
                const next = { ...prev }
                for (const id of missing) next[id] = `#${id}`
                return next
            })
        }
    }

    const load = async () => {
        setLoading(true)
        try {
            const res = await listResponsaveis(page, PAGE_SIZE, q || undefined, filterSecretariaId || undefined)
            setList(res.content ?? [])
            setTotalPages(res.totalPages ?? 0)

            // monta índice id->nome com o que vier da lista
            const ids = (res.content ?? [])
                .map((r: any) => r.secretariaId)
                .filter((v: any): v is number => typeof v === 'number')
            if (ids.length) await ensureSecIndexHas(ids)
        } finally {
            setLoading(false)
        }
    }

    const runFilterSecSearch = async (text: string) => {
        const query = text.trim()
        if (!query) { setFilterSecOptions([]); return }
        const opts = await searchSecretarias(query, 10)
        setFilterSecOptions(opts)
    }

    useEffect(() => { load() }, [page])

    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (dropdownRefEdit.current && !dropdownRefEdit.current.contains(e.target as Node)) setSecOpenEdit(false)
            if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) setFilterSecOpen(false)
        }
        document.addEventListener('mousedown', onClick)
        return () => document.removeEventListener('mousedown', onClick)
    }, [])

    useEffect(() => {
        if (filterDebounceRef.current) window.clearTimeout(filterDebounceRef.current)
        filterDebounceRef.current = window.setTimeout(() => runFilterSecSearch(filterSecQuery), 250)
        return () => { if (filterDebounceRef.current) window.clearTimeout(filterDebounceRef.current) }
    }, [filterSecQuery])

    const resolveSecName = (id?: number | null) => {
        if (id == null) return '–'
        return secIndex[id] ?? `#${id}`
    }

    const openCreate = () => {
        setCreateMode(true)
        setEditId(null)
        setEditForm({ nome: '', email: '', cargo: '', secretariaId: null })
        setSecQueryEdit('')            // novo cadastro começa vazio
        setSecOptionsEdit([])
        setSecOpenEdit(false)
        setErrors({})
        setEditOpen(true)
    }

    const openEdit = (r: Resp) => {
        setCreateMode(false)
        setEditId(r.id)

        // tenta pegar id e nome da secretaria do registro (caso o back envie)
        const secId = (r as any).secretariaId ?? null
        const secNomeFromRow = (r as any)?.secretaria?.nome || (r as any)?.secretariaNome

        // se veio nome junto do item, semeia o índice local
        if (secId != null && typeof secNomeFromRow === 'string' && secNomeFromRow.trim()) {
            setSecIndex(prev => ({ ...prev, [secId]: secNomeFromRow }))
        }

        setEditForm({
            nome: r.nome ?? '',
            email: r.email ?? '',
            cargo: r.cargo ?? '',
            secretariaId: secId,
        })

        // mostra o nome da secretaria no input do modal (fallback para #id até o índice carregar)
        setSecQueryEdit(secId != null
            ? (secNomeFromRow || resolveSecName(secId))
            : ''
        )

        setSecOptionsEdit([])
        setSecOpenEdit(false)
        setErrors({})
        setEditOpen(true)

        // garante que o índice tenha o nome (caso ainda não tenha)
        if (secId != null) {
            void ensureSecIndexHas([secId])
        }
    }

    const saveEdit = async () => {
        const nextErrors: { nome?: string; email?: string; secretariaId?: string } = {}

        if (!editForm.nome?.trim()) nextErrors.nome = 'Informe o nome'
        if (!editForm.email?.trim()) nextErrors.email = 'Informe o e-mail'
        else if (!isValidEmail(editForm.email)) nextErrors.email = 'E-mail inválido'
        if (editForm.secretariaId == null) nextErrors.secretariaId = 'Selecione uma secretaria'

        if (Object.keys(nextErrors).length > 0) {
            setErrors(nextErrors)
            return
        }

        setBusy(true)
        try {
            if (createMode) {
                await createResponsavel(editForm)
                setPage(0)
            } else {
                if (editId == null) return
                await api.put(`/api/v1/responsaveis/${editId}`, editForm)
            }
            setEditOpen(false)
            await load()
        } catch (e: any) {
            const emailDup = extractEmailDupError(e)
            if (emailDup) {
                setErrors(prev => ({ ...prev, email: emailDup }))
            } else if (/email/i.test(e?.response?.data?.message || e?.message || '')) {
                setErrors(prev => ({ ...prev, email: 'Falha ao salvar. Verifique o e-mail.' }))
            } else {
                setErrors(prev => ({ ...prev, email: ' E-mail já possui cadastro!!.' }))
            }
            return
        } finally {
            setBusy(false)
        }
    }

    // busca secretaria no modal (debounced)
    useEffect(() => {
        if (!editOpen) return
        if (debounceRefEdit.current) window.clearTimeout(debounceRefEdit.current)
        debounceRefEdit.current = window.setTimeout(async () => {
            const q = secQueryEdit.trim()
            if (!q) { setSecOptionsEdit([]); return }
            const opts = await searchSecretarias(q, 10)
            setSecOptionsEdit(opts)
        }, 250)
        return () => { if (debounceRefEdit.current) window.clearTimeout(debounceRefEdit.current) }
    }, [secQueryEdit, editOpen])

    const applyFilters = async () => {
        setPage(0)
        await load()
    }

    const clearFilters = async () => {
        setQ('')
        setFilterSecretariaId(null)
        setFilterSecQuery('')
        setPage(0)
        await load()
    }

    // ——— Modal de confirmação: handlers ———
    const askRemove = (r: Resp) => {
        setToDelete(r)
        setConfirmOpen(true)
    }

    const cancelRemove = () => {
        setConfirmOpen(false)
        setToDelete(null)
    }

    const confirmRemove = async () => {
        if (!toDelete) return
        setBusy(true)
        try {
            await deleteResponsavel(toDelete.id)
            setConfirmOpen(false)
            setToDelete(null)
            await load()
        } finally {
            setBusy(false)
        }
    }

    return (
        <>
            {busy && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/20 backdrop-blur-sm">
                    <div className="relative bg-white/90 border border-gray-100 rounded-2xl shadow-2xl px-6 py-5">
                        <div className="flex items-center gap-3">
                            <Spinner />
                            <span className="text-sm font-medium text-gray-800">Processando…</span>
                        </div>
                        <div className="absolute -inset-0.5 -z-10 rounded-2xl bg-gradient-to-br from-primary-200/40 to-transparent blur-lg" />
                    </div>
                </div>
            )}

            <div className="space-y-6">
                <div>
                    <h2 className="text-xl font-semibold text-gray-800">Responsáveis</h2>
                    <p className="text-sm text-gray-500">Gerencie pessoas responsáveis</p>
                </div>

                {/* Filtros */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                    <div className="mx-auto">
                        <div className="grid md:grid-cols-2 gap-3 items-end">
                            <div className="w-full">
                                <label className="text-sm text-gray-600 block">Pesquisar por nome</label>
                                <input
                                    className="mt-1 w-full border rounded-lg px-4 py-3"
                                    placeholder="Digite um nome…"
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    onKeyDown={(e)=>{ if(e.key==='Enter') applyFilters() }}
                                />
                            </div>

                            <div className="w-full relative" ref={filterDropdownRef}>
                                <label className="text-sm text-gray-600 block">Filtrar por secretaria</label>
                                <div className="mt-1 relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-gray-400">
                      <path fill="currentColor" d="M15.5 14h-.79l-.28-.27a6 6 0 10-.71.71l.27.28v.79L20 20.49 21.49 19 15.5 14zM10 15a5 5 0 110-10 5 5 0 010 10z"/>
                    </svg>
                  </span>
                                    <input
                                        className="w-full border rounded-lg pl-9 pr-10 py-3"
                                        placeholder="Buscar secretaria…"
                                        value={filterSecQuery}
                                        onChange={(e)=>{ setFilterSecQuery(e.target.value); setFilterSecOpen(!!e.target.value.trim()) }}
                                        onFocus={()=> setFilterSecOpen(!!filterSecQuery.trim())}
                                    />
                                    {filterSecretariaId != null && (
                                        <button
                                            type="button"
                                            className="absolute inset-y-0 right-0 pr-3 text-gray-400 hover:text-gray-600"
                                            title="Limpar filtro"
                                            onClick={clearFilters}
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                                {filterSecOpen && filterSecQuery.trim() && (
                                    <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-auto">
                                        {filterSecOptions.length === 0 && (
                                            <div className="px-3 py-2 text-sm text-gray-500">Nenhuma secretaria encontrada</div>
                                        )}
                                        {filterSecOptions.map((s)=>(
                                            <button
                                                key={s.id}
                                                type="button"
                                                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${filterSecretariaId===s.id ? 'bg-gray-50' : ''}`}
                                                onClick={()=>{ setFilterSecretariaId(s.id); setFilterSecQuery(s.nome); setFilterSecOpen(false); setPage(0); load() }}
                                            >
                                                {s.nome}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="pt-4 flex flex-wrap items-center justify-center gap-2">
                            <button
                                onClick={applyFilters}
                                className="px-5 py-2.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200"
                                title="Aplicar filtros"
                            >
                                Pesquisar
                            </button>
                            <button
                                onClick={clearFilters}
                                className="px-5 py-2.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                                title="Limpar filtros"
                            >
                                Limpar
                            </button>
                            <button
                                onClick={openCreate}
                                className="px-5 py-2.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                title="Cadastrar novo responsável"
                            >
                                Novo
                            </button>
                        </div>
                    </div>
                </div>

                {/* Lista */}
                <div className="bg-white p-4 rounded-2xl border border-gray-100 overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="text-left text-gray-500">
                            <th className="py-2">Nome</th>
                            <th className="py-2">Email</th>
                            <th className="py-2">Cargo</th>
                            <th className="py-2">Secretaria</th>
                            <th className="py-2 w-36">Ações</th>
                        </tr>
                        </thead>
                        <tbody>
                        {list.map((r) => (
                            <tr key={r.id} className="border-t hover:bg-gray-50 transition-colors">
                                <td className="py-2">{r.nome}</td>
                                <td className="py-2">{r.email}</td>
                                <td className="py-2">{r.cargo}</td>
                                <td className="py-2">{resolveSecName((r as any).secretariaId)}</td>
                                <td className="py-2">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => openEdit(r)}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 text-blue-700 border border-blue-200 hover:bg-blue-50 rounded-lg"
                                            title="Editar responsável"
                                        >
                                            <svg viewBox="0 0 24 24" className="h-4 w-4">
                                                <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 000-1.42l-2.34-2.34a1.003 1.003 0 00-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"/>
                                            </svg>
                                            <span className="hidden sm:inline">Editar</span>
                                        </button>
                                        <button
                                            onClick={() => askRemove(r)}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 text-red-700 border border-red-200 hover:bg-red-50 rounded-lg"
                                            title="Excluir responsável"
                                        >
                                            <svg viewBox="0 0 24 24" className="h-4 w-4">
                                                <path fill="currentColor" d="M6 7h12l-1 13H7L6 7zm3-3h6l1 2H8l1-2z"/>
                                            </svg>
                                            <span className="hidden sm:inline">Excluir</span>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {list.length === 0 && (
                            <tr>
                                <td className="py-4 text-gray-400" colSpan={5}>
                                    {loading ? 'Carregando…' : 'Sem registros'}
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>

                    {/* Paginação */}
                    <div className="mt-4 flex items-center justify-between">
                        <div className="text-xs text-gray-500">
                            Página {totalPages === 0 ? 0 : page + 1} de {totalPages}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                disabled={page <= 0}
                            >
                                Anterior
                            </button>
                            <button
                                className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                                onClick={() => setPage(p => (totalPages ? Math.min(totalPages - 1, p + 1) : p))}
                                disabled={totalPages === 0 || page >= totalPages - 1}
                            >
                                Próxima
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal (criar/editar) */}
            {editOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
                    <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-gray-100">
                        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-gray-800">
                                {createMode ? 'Cadastrar responsável' : 'Editar responsável'}
                            </h3>
                            <button className="text-gray-400 hover:text-gray-600" onClick={() => setEditOpen(false)}>✕</button>
                        </div>

                        <div className="p-5 grid md:grid-cols-2 gap-4">
                            {/* Nome */}
                            <div>
                                <label className="text-sm text-gray-600">Nome</label>
                                <input
                                    className={`mt-1 w-full border rounded-lg px-3 py-2 ${errors.nome ? 'border-rose-300 bg-rose-50' : ''}`}
                                    value={editForm.nome}
                                    onChange={(e) => { setEditForm({ ...editForm, nome: e.target.value }); if (errors.nome) setErrors({ ...errors, nome: undefined }) }}
                                />
                                {errors.nome && <p className="mt-1 text-xs text-rose-600">{errors.nome}</p>}
                            </div>

                            {/* Email */}
                            <div>
                                <label className="text-sm text-gray-600">Email</label>
                                <input
                                    className={`mt-1 w-full border rounded-lg px-3 py-2 ${errors.email ? 'border-rose-300 bg-rose-50' : ''}`}
                                    value={editForm.email}
                                    onChange={(e) => { setEditForm({ ...editForm, email: e.target.value }); if (errors.email) setErrors({ ...errors, email: undefined }) }}
                                    placeholder="nome@dominio.gov.br"
                                />
                                {errors.email && <p className="mt-1 text-xs text-rose-600">{errors.email}</p>}
                            </div>

                            {/* Cargo */}
                            <div>
                                <label className="text-sm text-gray-600">Cargo</label>
                                <input
                                    className="mt-1 w-full border rounded-lg px-3 py-2"
                                    value={editForm.cargo || ''}
                                    onChange={(e) => setEditForm({ ...editForm, cargo: e.target.value })}
                                />
                            </div>

                            {/* Secretaria */}
                            <div className="relative" ref={dropdownRefEdit}>
                                <label className="text-sm text-gray-600">
                                    Secretaria <span className="text-red-500">*</span>
                                </label>
                                <div className="mt-1 relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-gray-400">
                      <path fill="currentColor" d="M15.5 14h-.79l-.28-.27a6 6 0 10-.71.71l.27.28v.79L20 20.49 21.49 19 15.5 14zM10 15a5 5 0 110-10 5 5 0 010 10z"/>
                    </svg>
                  </span>
                                    <input
                                        className={`w-full border rounded-lg pl-9 pr-10 py-2 ${errors.secretariaId ? 'border-rose-300 bg-rose-50' : ''}`}
                                        placeholder="Buscar por nome..."
                                        value={secQueryEdit}
                                        onChange={(e) => { setSecQueryEdit(e.target.value); setSecOpenEdit(!!e.target.value.trim()); if (errors.secretariaId) setErrors({ ...errors, secretariaId: undefined }) }}
                                        onFocus={() => setSecOpenEdit(!!secQueryEdit.trim())}
                                    />
                                    {editForm.secretariaId != null && (
                                        <button
                                            type="button"
                                            className="absolute inset-y-0 right-0 pr-2 text-gray-400 hover:text-gray-600"
                                            title="Limpar seleção"
                                            onClick={() => { setEditForm({ ...editForm, secretariaId: null }); setSecQueryEdit(''); setSecOptionsEdit([]); setSecOpenEdit(false) }}
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                                {errors.secretariaId && <p className="mt-1 text-xs text-rose-600">{errors.secretariaId}</p>}

                                {secOpenEdit && secQueryEdit.trim() && (
                                    <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-auto">
                                        {secOptionsEdit.length === 0 && (
                                            <div className="px-3 py-2 text-sm text-gray-500">Nenhuma secretaria encontrada</div>
                                        )}
                                        {secOptionsEdit.map((s) => (
                                            <button
                                                key={s.id}
                                                type="button"
                                                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${editForm.secretariaId === s.id ? 'bg-gray-50' : ''}`}
                                                onClick={() => { setEditForm({ ...editForm, secretariaId: s.id }); setSecQueryEdit(s.nome); setSecOpenEdit(false) }}
                                            >
                                                {s.nome}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
                            <button
                                className="px-4 py-2 rounded-lg border hover:bg-gray-50"
                                onClick={() => setEditOpen(false)}
                            >
                                Cancelar
                            </button>
                            <button
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
                                onClick={saveEdit}
                                disabled={busy}
                            >
                                {busy ? <Spinner /> : null}
                                {busy ? 'Salvando…' : (createMode ? 'Criar' : 'Salvar')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Confirmação de Exclusão */}
            {confirmOpen && toDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="w-full max-w-md relative">
                        {/* glow */}
                        <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-red-200 via-rose-200 to-transparent blur" />
                        <div className="relative bg-white rounded-2xl border border-gray-100 shadow-2xl overflow-hidden">
                            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-gray-800">Confirmar exclusão</h3>
                                <button
                                    className="text-gray-400 hover:text-gray-600"
                                    onClick={cancelRemove}
                                    aria-label="Fechar"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="p-5">
                                <p className="text-sm text-gray-700">
                                    Tem certeza que deseja excluir o responsável{' '}
                                    <span className="font-medium text-gray-900">“{toDelete.nome}”</span>?
                                </p>
                                <p className="mt-1 text-xs text-gray-500">
                                    Esta ação não pode ser desfeita.
                                </p>
                            </div>

                            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-center gap-3">
                                <button
                                    className="px-5 py-2.5 rounded-lg border hover:bg-gray-50"
                                    onClick={cancelRemove}
                                    disabled={busy}
                                >
                                    Cancelar
                                </button>
                                <button
                                    className="px-5 py-2.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
                                    onClick={confirmRemove}
                                    disabled={busy}
                                >
                                    Excluir
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

export default ResponsaveisPage
