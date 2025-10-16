import React, { useEffect, useRef, useState } from 'react'
import {
    listarProjetos,
    criarProjeto,
    atualizarProjeto,
    excluirProjeto,
    searchResponsaveis,
    searchSecretariasProjetos,
    listAllSecretariasProjetos,
    vincularResponsavelAoProjeto,     // vincula no back imediatamente
    desvincularResponsavelDoProjeto,  // desvincula no back imediatamente
    type Projeto,
    type ProjetoForm,
} from '../services/projetos'
import { getProjeto } from '../services/kanban'
import type { SecretariaDTO } from '../services/responsaveis'

const Spinner: React.FC = () => (
    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
    </svg>
)

const PeopleIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg viewBox="0 0 24 24" className={className || 'h-4 w-4'}>
        <path
            fill="currentColor"
            d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.67 0-8 1.34-8 4v2h8v-2c0-.7.18-1.36.5-1.94C9.14 14.41 8.57 14 8 14zm8 0c-.57 0-1.14.41-1.5 1.06.32.58.5 1.24.5 1.94v2h8v-2c0-2.66-5.33-4-7-4z"
        />
    </svg>
)

const PAGE_SIZE = 10
const STATUS_OPTIONS = ['A_INICIAR', 'EM_ANDAMENTO', 'ATRASADO', 'CONCLUIDO'] as const

const ProjetosPage: React.FC = () => {
    // listagem
    const [list, setList] = useState<Projeto[]>([])
    const [loading, setLoading] = useState(false)
    const [busy, setBusy] = useState(false)

    // paginação / filtros
    const [page, setPage] = useState(0)
    const [totalPages, setTotalPages] = useState(0)
    const [q, setQ] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('')

    // filtro secretaria
    const [filterSecQuery, setFilterSecQuery] = useState('')
    const [filterSecOptions, setFilterSecOptions] = useState<SecretariaDTO[]>([])
    const [filterSecOpen, setFilterSecOpen] = useState(false)
    const [filterSecretariaId, setFilterSecretariaId] = useState<number | null>(null)
    const filterDropdownRef = useRef<HTMLDivElement | null>(null)
    const filterDebounceRef = useRef<number | null>(null)

    // índice local: secretariaId -> nome
    const [secIndex, setSecIndex] = useState<Record<number, string>>({})

    // modal (criar/editar)
    const [modalOpen, setModalOpen] = useState(false)
    const [createMode, setCreateMode] = useState(false)
    const [editId, setEditId] = useState<string | null>(null)
    const [form, setForm] = useState<ProjetoForm>({
        nome: '',
        secretariaId: null,
        responsaveisIds: [],
        inicioPrevisto: '',
        terminoPrevisto: '',
    })

    // erros por campo
    const [errors, setErrors] = useState<Record<string, string>>({})
    // erro do modal (vínculo)
    const [modalError, setModalError] = useState<string | null>(null)

    // secretaria autocomplete (modal)
    const [secQuery, setSecQuery] = useState('')
    const [secOptions, setSecOptions] = useState<SecretariaDTO[]>([])
    const [secOpen, setSecOpen] = useState(false)
    const secDropdownRef = useRef<HTMLDivElement | null>(null)
    const secDebounceRef = useRef<number | null>(null)

    // responsáveis autocomplete (modal)
    const [respQuery, setRespQuery] = useState('')
    const [respOptions, setRespOptions] = useState<{ id: number; nome: string; email?: string }[]>([])
    const [respOpen, setRespOpen] = useState(false)
    const respDropdownRef = useRef<HTMLDivElement | null>(null)
    const respDebounceRef = useRef<number | null>(null)

    // índice local: responsavelId -> {nome,email}
    const [respIndex, setRespIndex] = useState<Record<number, { nome: string; email?: string }>>({})

    // modal de confirmação de exclusão
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [toDelete, setToDelete] = useState<Projeto | null>(null)

    // modal de responsáveis (listagem)
    const [respModalOpen, setRespModalOpen] = useState(false)
    const [respModalLoading, setRespModalLoading] = useState(false)
    const [respModalProjetoNome, setRespModalProjetoNome] = useState<string>('')
    const [respModalLista, setRespModalLista] = useState<{ id: number; nome: string; email?: string }[]>([])

    // ======= helpers =======
    const ensureSecIndex = async (ids: number[]) => {
        const unique = Array.from(new Set(ids.filter((id) => id != null)))
        const missing = unique.filter(id => secIndex[id] === undefined)
        if (missing.length === 0) return
        const all = await listAllSecretariasProjetos()
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

    const resolveSecName = (proj: Projeto) => {
        if (proj.secretaria && typeof proj.secretaria.nome === 'string' && proj.secretaria.nome.trim() !== '') {
            return proj.secretaria.nome
        }
        const sid = proj.secretariaId
        return sid == null ? '–' : (secIndex[sid] ?? `#${sid}`)
    }

    const resolveRespName = (id: number) => respIndex[id]?.nome ?? `#${id}`

    // ======= data loading =======
    const load = async () => {
        setLoading(true)
        try {
            const res = await listarProjetos(page, PAGE_SIZE, q || undefined, filterSecretariaId || undefined, statusFilter || undefined)
            const content = (res.content ?? []) as Projeto[]

            // alimentar índice de secretarias
            const secIdsFromNew = content.map(p => p.secretaria?.id).filter((v): v is number => typeof v === 'number')
            const secIdsFromLegacy = content.map(p => p.secretariaId).filter((v): v is number => typeof v === 'number')
            const allSecIds = [...secIdsFromNew, ...secIdsFromLegacy]
            if (allSecIds.length) await ensureSecIndex(allSecIds)

            // cache de responsáveis
            setRespIndex(prev => {
                const next = { ...prev }
                for (const p of content) {
                    if (Array.isArray(p.responsaveis)) {
                        for (const r of p.responsaveis) {
                            if (r?.id != null && typeof r?.nome === 'string') {
                                const id = Number(r.id)
                                if (!Number.isNaN(id)) next[id] = next[id] ?? { nome: r.nome }
                            }
                        }
                    }
                }
                return next
            })

            setList(content)
            setTotalPages(res.totalPages ?? 0)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page])

    // clique fora dos dropdowns
    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) setFilterSecOpen(false)
            if (secDropdownRef.current && !secDropdownRef.current.contains(e.target as Node)) setSecOpen(false)
            if (respDropdownRef.current && !respDropdownRef.current.contains(e.target as Node)) setRespOpen(false)
        }
        document.addEventListener('mousedown', onClick)
        return () => document.removeEventListener('mousedown', onClick)
    }, [])

    // debounce filtros/auto completes
    useEffect(() => {
        if (filterDebounceRef.current) window.clearTimeout(filterDebounceRef.current)
        filterDebounceRef.current = window.setTimeout(async () => {
            const q = filterSecQuery.trim()
            if (!q) { setFilterSecOptions([]); return }
            const opts = await searchSecretariasProjetos(q, 10)
            setFilterSecOptions(opts)
        }, 250)
        return () => { if (filterDebounceRef.current) window.clearTimeout(filterDebounceRef.current) }
    }, [filterSecQuery])

    useEffect(() => {
        if (!modalOpen) return
        if (secDebounceRef.current) window.clearTimeout(secDebounceRef.current)
        secDebounceRef.current = window.setTimeout(async () => {
            const q = secQuery.trim()
            if (!q) { setSecOptions([]); return }
            const opts = await searchSecretariasProjetos(q, 10)
            setSecOptions(opts)
        }, 250)
        return () => { if (secDebounceRef.current) window.clearTimeout(secDebounceRef.current) }
    }, [secQuery, modalOpen])

    useEffect(() => {
        if (!modalOpen) return
        if (respDebounceRef.current) window.clearTimeout(respDebounceRef.current)
        respDebounceRef.current = window.setTimeout(async () => {
            const q = respQuery.trim()
            if (!q) { setRespOptions([]); return }

            // ⚠️ Agora a busca de responsáveis é SEMPRE escopada pela secretaria selecionada
            if (!form.secretariaId) { setRespOptions([]); return }

            const opts = await searchResponsaveis(q, 10, form.secretariaId)
            setRespOptions(opts)
        }, 250)
        return () => { if (respDebounceRef.current) window.clearTimeout(respDebounceRef.current) }
    }, [respQuery, form.secretariaId, modalOpen])

    // sincroniza nome secretaria no input quando índice popular
    useEffect(() => {
        if (!modalOpen) return
        const sid = form.secretariaId
        if (sid == null) return
        const indexedName = secIndex[sid]
        if (!indexedName) return
        if (secQuery.trim() === '' || secQuery === String(sid) || secQuery === `#${sid}`) {
            setSecQuery(indexedName)
        }
    }, [modalOpen, form.secretariaId, secIndex, secQuery])

    // ======= filtros =======
    const applyFilters = async () => { setPage(0); await load() }
    const clearFilters = async () => {
        setQ(''); setFilterSecretariaId(null); setFilterSecQuery(''); setStatusFilter('')
        setPage(0); await load()
    }

    // ======= ações =======
    const openCreate = () => {
        setCreateMode(true)
        setEditId(null)
        setErrors({})
        setModalError(null)
        setForm({ nome: '', secretariaId: null, responsaveisIds: [], inicioPrevisto: '', terminoPrevisto: '' })
        setSecQuery(''); setSecOptions([]); setSecOpen(false)
        setRespQuery(''); setRespOptions([]); setRespOpen(false)
        setRespIndex({})
        setModalOpen(true)
    }

    const openEdit = async (p: Projeto) => {
        setCreateMode(false)
        setEditId(p.id)
        setErrors({})
        setModalError(null)

        const ip = (p as any).inicioPrevisto ? String((p as any).inicioPrevisto).substring(0, 10) : ''
        const tp = (p as any).terminoPrevisto ? String((p as any).terminoPrevisto).substring(0, 10) : ''

        const secretariaId = p.secretaria?.id ?? (p as any).secretariaId ?? null
        const responsaveisIds = Array.isArray((p as any).responsaveisIds)
            ? (p as any).responsaveisIds
            : Array.isArray(p.responsaveis) ? p.responsaveis.map(r => Number(r.id)).filter(n => Number.isFinite(n)) : []

        setForm({ nome: p.nome ?? '', secretariaId, responsaveisIds, inicioPrevisto: ip, terminoPrevisto: tp })

        const secName = p.secretaria?.nome ?? (secretariaId != null ? (secIndex[secretariaId] ?? `#${secretariaId}`) : '')
        setSecQuery(secName || '')

        // seed cache nomes responsáveis
        setRespIndex(prev => {
            const next = { ...prev }
            if (Array.isArray(p.responsaveis)) {
                for (const r of p.responsaveis) {
                    if (r?.id != null && typeof r?.nome === 'string') {
                        const id = Number(r.id)
                        if (!Number.isNaN(id)) next[id] = next[id] ?? { nome: r.nome }
                    }
                }
            }
            return next
        })

        setSecOptions([]); setSecOpen(false)
        setRespQuery(''); setRespOptions([]); setRespOpen(false)
        setModalOpen(true)

        // garantir índice e nome pós-índice
        if (secretariaId != null && secIndex[secretariaId] === undefined) {
            await ensureSecIndex([secretariaId]).catch(() => void 0)
            if (secQuery === `#${secretariaId}` && secIndex[secretariaId]) {
                setSecQuery(secIndex[secretariaId])
            }
        }

        // se não temos nome, tentar detalhe
        if (!p.secretaria?.nome) {
            try {
                const det: any = await getProjeto(p.id)
                const detNome = det?.secretaria?.nome ?? det?.secretariaNome ?? (det?.secretariaId != null ? secIndex[det.secretariaId] : '')
                if (det?.secretaria?.id && (form.secretariaId == null)) {
                    setForm(prev => ({ ...prev, secretariaId: Number(det.secretaria.id) }))
                }
                if (typeof detNome === 'string' && detNome.trim()) {
                    setSecQuery(detNome)
                }
            } catch {/* noop */}
        }
    }

    const validate = (f: ProjetoForm) => {
        const errs: Record<string, string> = {}
        if (!f.nome?.trim()) errs.nome = 'Campo obrigatório'
        if (f.secretariaId == null) errs.secretariaId = 'Campo obrigatório'
        if (!f.responsaveisIds || f.responsaveisIds.length === 0) errs.responsaveisIds = 'Selecione ao menos 1 responsável'
        if (!f.inicioPrevisto) errs.inicioPrevisto = 'Campo obrigatório'
        if (!f.terminoPrevisto) errs.terminoPrevisto = 'Campo obrigatório'
        if (f.inicioPrevisto && f.terminoPrevisto && f.terminoPrevisto <= f.inicioPrevisto) {
            errs.terminoPrevisto = 'Término deve ser maior que o Início'
        }
        return errs
    }

    const save = async () => {
        const errs = validate(form)
        setErrors(errs)
        if (Object.keys(errs).length > 0) return

        setBusy(true)
        try {
            if (createMode) {
                await criarProjeto({ ...form, inicioPrevisto: form.inicioPrevisto!, terminoPrevisto: form.terminoPrevisto! })
                setPage(0)
            } else if (editId) {
                await atualizarProjeto(editId, { ...form, inicioPrevisto: form.inicioPrevisto!, terminoPrevisto: form.terminoPrevisto! })
            }
            setModalOpen(false)
            await load()
        } finally { setBusy(false) }
    }

    // ——— confirmação de exclusão ———
    const askRemove = (p: Projeto) => { setToDelete(p); setConfirmOpen(true) }
    const cancelRemove = () => { setConfirmOpen(false); setToDelete(null) }
    const confirmRemove = async () => {
        if (!toDelete) return
        setBusy(true)
        try {
            await excluirProjeto(toDelete.id)
            setConfirmOpen(false); setToDelete(null)
            await load()
        } finally { setBusy(false) }
    }

    // ========= Modal de responsáveis (listagem) =========
    const openResponsaveisModal = async (p: Projeto) => {
        setRespModalProjetoNome(p.nome ?? '')
        setRespModalOpen(true)
        setRespModalLoading(true)
        setRespModalLista([])

        const normalizeAnyArray = (arr: any[]): { id: number; nome: string; email?: string }[] =>
            arr.map((r: any, i: number) => {
                if (typeof r === 'number' || typeof r === 'string') {
                    const numId = Number(r)
                    const cache = respIndex[numId]
                    return { id: numId, nome: cache?.nome ?? `#${numId}`, email: cache?.email }
                }
                const idNum = Number(r?.id ?? r?.idUsuario ?? r?.usuarioId ?? r?.userId ?? r?.usuario?.id ?? -(i + 1))
                const hasValidId = Number.isFinite(idNum) && idNum > 0
                const nome = r?.nome ?? r?.nomeUsuario ?? r?.usuario?.nome ?? (hasValidId ? (respIndex[idNum]?.nome ?? `#${idNum}`) : '#?')
                const email = r?.email ?? r?.emailUsuario ?? r?.usuario?.email ?? (hasValidId ? respIndex[idNum]?.email : undefined)
                return { id: hasValidId ? idNum : -(i + 1), nome, email }
            })

        try {
            if (Array.isArray(p.responsaveis) && p.responsaveis.length) {
                const base = p.responsaveis.map(r => ({ id: Number(r.id), nome: r.nome })).filter(r => Number.isFinite(r.id))
                setRespModalLista(base)
                setRespIndex(prev => {
                    const next = { ...prev }
                    for (const r of base) next[r.id] = next[r.id] ?? { nome: r.nome }
                    return next
                })
                return
            }

            const idsList: Array<number> = Array.isArray((p as any).responsaveisIds) ? (p as any).responsaveisIds : []
            if (idsList.length) {
                const resolved = idsList.map(id => {
                    const cache = respIndex[id]
                    return { id, nome: cache?.nome ?? `#${id}`, email: cache?.email }
                })
                setRespModalLista(resolved)
                return
            }

            try {
                const det: any = await getProjeto(p.id)
                const pool = det?.responsaveis ?? det?.responsaveisDTO ?? det?.usuariosResponsaveis ?? det?.vinculosUsuarios ?? det?.responsaveisIds ?? []
                const lista = Array.isArray(pool) ? normalizeAnyArray(pool) : []
                setRespModalLista(lista)
                setRespIndex(prev => {
                    const next = { ...prev }
                    for (const r of lista) if (r.id > 0 && r.nome && !r.nome.startsWith('#')) next[r.id] = { nome: r.nome, email: r.email }
                    return next
                })
            } catch { setRespModalLista([]) }
        } finally { setRespModalLoading(false) }
    }

    // ============ VÍNCULO IMEDIATO (edição) ============
    const handlePickResponsavel = async (r: { id: number; nome: string; email?: string }) => {
        setModalError(null)
        const idNum = Number(r.id)
        if (!Number.isFinite(idNum)) return

        if ((form.responsaveisIds || []).includes(idNum)) {
            setRespOpen(false); setRespQuery(''); setRespOptions([])
            return
        }

        const nextIds = [ ...(form.responsaveisIds || []), idNum ]
        setForm(prev => ({ ...prev, responsaveisIds: nextIds }))
        setRespIndex(prev => ({ ...prev, [idNum]: { nome: r.nome, email: r.email } }))
        setRespOpen(false); setRespQuery(''); setRespOptions([])

        if (createMode || !editId) return

        try {
            await vincularResponsavelAoProjeto(
                editId,
                idNum,
                form.secretariaId ?? null,
                nextIds
            )
        } catch (e: any) {
            // rollback
            setForm(prev => ({ ...prev, responsaveisIds: (prev.responsaveisIds || []).filter(x => x !== idNum) }))
            setModalError(e?.response?.data?.message || e?.message || 'Falha ao vincular responsável.')
        }
    }

    const handleRemoveResponsavel = async (id: number) => {
        setModalError(null)
        const idNum = Number(id)
        if (!Number.isFinite(idNum)) return

        const prevIds = form.responsaveisIds || []
        const nextIds = prevIds.filter(x => x !== idNum)
        setForm(prev => ({ ...prev, responsaveisIds: nextIds }))

        if (createMode || !editId) return

        try {
            await desvincularResponsavelDoProjeto(
                editId,
                idNum,
                form.secretariaId ?? null,
                prevIds
            )
        } catch (e: any) {
            // rollback
            setForm(prev => ({ ...prev, responsaveisIds: prevIds }))
            setModalError(e?.response?.data?.message || e?.message || 'Falha ao desvincular responsável.')
        }
    }

    // handler para selecionar a secretaria no modal — agora limpando responsáveis
    const handleSelectSecretaria = (s: SecretariaDTO) => {
        setForm(prev => ({
            ...prev,
            secretariaId: s.id,
            responsaveisIds: [] // ⚠️ limpa responsáveis ao trocar de secretaria
        }))
        setSecQuery(s.nome)
        setSecOpen(false)
        setRespQuery('')
        setRespOptions([])
        setRespIndex({})
        // também limpa erro de responsáveis, se houver
        setErrors(prev => {
            const { responsaveisIds, ...rest } = prev
            return rest
        })
    }

    return (
        <>
            {busy && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/20">
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
                    <h2 className="text-xl font-semibold text-gray-800">Projetos</h2>
                    <p className="text-sm text-gray-500">Gerencie projetos, secretaria e responsáveis</p>
                </div>

                {/* Filtros + ações */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                    <div className="grid md:grid-cols-3 gap-3 items-end">
                        <div>
                            <label className="text-sm text-gray-600">Pesquisar por nome</label>
                            <input
                                className="mt-1 w-full border rounded-lg px-4 py-3 text-sm md:text-base"
                                placeholder="Digite um nome…"
                                value={q}
                                onChange={e => setQ(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') applyFilters() }}
                            />
                        </div>

                        <div className="relative" ref={filterDropdownRef}>
                            <label className="text-sm text-gray-600">Filtrar por secretaria</label>
                            <div className="mt-1 relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-gray-400">
                    <path fill="currentColor" d="M15.5 14h-.79l-.28-.27a6 6 0 10-.71.71l.27.28v.79L20 20.49 21.49 19 15.5 14zM10 15a5 5 0 110-10 5 5 0 010 10z"/>
                  </svg>
                </span>
                                <input
                                    className="w-full border rounded-lg pl-9 pr-10 py-3 text-sm md:text-base"
                                    placeholder="Buscar secretaria…"
                                    value={filterSecQuery}
                                    onChange={e => { setFilterSecQuery(e.target.value); setFilterSecOpen(!!e.target.value.trim()) }}
                                    onFocus={() => setFilterSecOpen(!!filterSecQuery.trim())}
                                />
                                {filterSecretariaId != null && (
                                    <button type="button" className="absolute inset-y-0 right-0 pr-3 text-gray-400 hover:text-gray-600" title="Limpar filtro" onClick={clearFilters}>✕</button>
                                )}
                            </div>
                            {filterSecOpen && filterSecQuery.trim() && (
                                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-auto">
                                    {filterSecOptions.length === 0 && (
                                        <div className="px-3 py-2 text-sm text-gray-500">Nenhuma secretaria encontrada</div>
                                    )}
                                    {filterSecOptions.map(s => (
                                        <button
                                            key={s.id}
                                            type="button"
                                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${filterSecretariaId === s.id ? 'bg-gray-50' : ''}`}
                                            onClick={() => { setFilterSecretariaId(s.id); setFilterSecQuery(s.nome); setFilterSecOpen(false); setPage(0); load() }}
                                        >
                                            {s.nome}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="text-sm text-gray-600">Status</label>
                            <select
                                className="mt-1 w-full border rounded-lg px-4 py-3 bg-white text-sm md:text-base"
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)}
                            >
                                <option value="">Todos</option>
                                {STATUS_OPTIONS.map(s => (<option key={s} value={s}>{s}</option>))}
                            </select>
                        </div>
                    </div>

                    <div className="pt-4 flex flex-wrap items-center justify-center gap-2">
                        <button onClick={applyFilters} className="px-5 py-2.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200">Pesquisar</button>
                        <button onClick={clearFilters} className="px-5 py-2.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200">Limpar</button>
                        <button onClick={openCreate} className="px-5 py-2.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200">Novo</button>
                    </div>
                </div>

                {/* Lista */}
                <div className="bg-white p-4 rounded-2xl border border-gray-100 overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="text-left text-gray-500">
                            <th className="py-2">Nome</th>
                            <th className="py-2">Status</th>
                            <th className="py-2">Secretaria</th>
                            <th className="py-2 w-44">Ações</th>
                        </tr>
                        </thead>
                        <tbody>
                        {list.map(p => (
                            <tr key={p.id} className="border-t hover:bg-gray-50 transition-colors">
                                <td className="py-2">{p.nome}</td>
                                <td className="py-2">{p.status}</td>
                                <td className="py-2">{resolveSecName(p)}</td>
                                <td className="py-2">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => openResponsaveisModal(p)}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 text-gray-700 border border-gray-200 hover:bg-gray-50 rounded-lg"
                                            title="Ver responsáveis do projeto"
                                        >
                                            <PeopleIcon />
                                            <span className="hidden sm:inline">Responsáveis</span>
                                        </button>

                                        <button
                                            onClick={() => openEdit(p)}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 text-blue-700 border border-blue-200 hover:bg-blue-50 rounded-lg"
                                            title="Editar projeto"
                                        >
                                            <svg viewBox="0 0 24 24" className="h-4 w-4">
                                                <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 000-1.42l-2.34-2.34a1.003 1.003 0 00-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"/>
                                            </svg>
                                            <span className="hidden sm:inline">Editar</span>
                                        </button>

                                        <button
                                            onClick={() => askRemove(p)}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 text-red-700 border border-red-200 hover:bg-red-50 rounded-lg"
                                            title="Excluir projeto"
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
                                <td className="py-4 text-gray-400" colSpan={4}>
                                    {loading ? 'Carregando…' : 'Sem registros'}
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>

                    {/* Paginação */}
                    <div className="mt-4 flex items-center justify-between">
                        <div className="text-xs text-gray-500">Página {totalPages === 0 ? 0 : page + 1} de {totalPages}</div>
                        <div className="flex items-center gap-2">
                            <button className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                                    onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page <= 0}>Anterior</button>
                            <button className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                                    onClick={() => setPage(p => (totalPages ? Math.min(totalPages - 1, p + 1) : p))}
                                    disabled={totalPages === 0 || page >= totalPages - 1}>Próxima</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal (criar/editar) */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
                    <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl border border-gray-100">
                        {/* header */}
                        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-gray-800">{createMode ? 'Cadastrar projeto' : 'Editar projeto'}</h3>
                            <button className="text-gray-400 hover:text-gray-600" onClick={() => setModalOpen(false)}>✕</button>
                        </div>

                        {/* body */}
                        <div className="p-5 grid md:grid-cols-2 gap-4 overflow-visible">
                            {/* Nome */}
                            <div className="md:col-span-2">
                                <label className="text-sm text-gray-600">Nome do projeto <span className="text-red-500">*</span></label>
                                <input
                                    className={`mt-1 w-full border rounded-lg px-4 py-3 text-sm md:text-base ${errors.nome ? 'border-red-500' : ''}`}
                                    value={form.nome}
                                    onChange={e => setForm({ ...form, nome: e.target.value })}
                                />
                                {errors.nome && <p className="mt-1 text-xs text-red-600">{errors.nome}</p>}
                            </div>

                            {/* Secretaria (dropdown) */}
                            <div className="relative md:col-span-2" ref={secDropdownRef}>
                                <label className="text-sm text-gray-600">Secretaria <span className="text-red-500">*</span></label>
                                <div className="mt-1 relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-gray-400">
                      <path fill="currentColor" d="M15.5 14h-.79l-.28-.27a6 6 0 10-.71.71l.27.28v.79L20 20.49 21.49 19 15.5 14zM10 15a5 5 0 110-10 5 5 0 010 10z"/>
                    </svg>
                  </span>
                                    <input
                                        className={`w-full border rounded-lg pl-9 pr-10 py-3 text-sm md:text-base ${errors.secretariaId ? 'border-red-500' : ''}`}
                                        placeholder="Buscar por nome..."
                                        value={secQuery}
                                        onChange={e => { setSecQuery(e.target.value); setSecOpen(!!e.target.value.trim()) }}
                                        onFocus={() => setSecOpen(!!secQuery.trim())}
                                    />
                                    {form.secretariaId != null && (
                                        <button
                                            type="button"
                                            className="absolute inset-y-0 right-0 pr-3 text-gray-400 hover:text-gray-600"
                                            title="Limpar seleção"
                                            onClick={() => {
                                                setForm(prev => ({ ...prev, secretariaId: null, responsaveisIds: [] }))
                                                setSecQuery(''); setSecOptions([]); setSecOpen(false)
                                                setRespQuery(''); setRespOptions([]); setRespIndex({})
                                            }}
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                                {errors.secretariaId && <p className="mt-1 text-xs text-red-600">{errors.secretariaId}</p>}
                                {secOpen && secQuery.trim() && (
                                    <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-auto">
                                        {secOptions.length === 0 && (<div className="px-3 py-2 text-sm text-gray-500">Nenhuma secretaria encontrada</div>)}
                                        {secOptions.map(s => (
                                            <button
                                                key={s.id}
                                                type="button"
                                                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${form.secretariaId === s.id ? 'bg-gray-50' : ''}`}
                                                onClick={() => handleSelectSecretaria(s)}
                                            >
                                                {s.nome}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Datas lado a lado */}
                            <div>
                                <label className="text-sm text-gray-600">Previsão de Início <span className="text-red-500">*</span></label>
                                <input type="date" className={`mt-1 w-full border rounded-lg px-3 py-3 ${errors.inicioPrevisto ? 'border-red-500' : ''}`}
                                       value={form.inicioPrevisto || ''} onChange={e => setForm({ ...form, inicioPrevisto: e.target.value })} />
                                {errors.inicioPrevisto && <p className="mt-1 text-xs text-red-600">{errors.inicioPrevisto}</p>}
                            </div>

                            <div>
                                <label className="text-sm text-gray-600">Previsão de Término <span className="text-red-500">*</span></label>
                                <input type="date" className={`mt-1 w-full border rounded-lg px-3 py-3 ${errors.terminoPrevisto ? 'border-red-500' : ''}`}
                                       value={form.terminoPrevisto || ''} onChange={e => setForm({ ...form, terminoPrevisto: e.target.value })} />
                                {errors.terminoPrevisto && <p className="mt-1 text-xs text-red-600">{errors.terminoPrevisto}</p>}
                            </div>

                            {/* Responsáveis */}
                            <div className="md:col-span-2">
                                <label className="text-sm text-gray-600">Responsáveis <span className="text-red-500">*</span></label>

                                <div className={`flex flex-wrap gap-2 mt-1 mb-2 border rounded-lg p-2 ${errors.responsaveisIds ? 'border-red-500' : 'border-gray-200'}`}>
                                    {(form.responsaveisIds || []).map(id => (
                                        <span
                                            key={id}
                                            className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs"
                                            title={respIndex[Number(id)]?.email || undefined}
                                        >
                      {resolveRespName(Number(id))}
                                            <button className="text-gray-400 hover:text-gray-600" onClick={() => handleRemoveResponsavel(Number(id))} title="Remover">✕</button>
                    </span>
                                    ))}
                                    {(!form.responsaveisIds || form.responsaveisIds.length === 0) && (
                                        <span className="text-xs text-gray-400">Nenhum responsável selecionado</span>
                                    )}
                                </div>
                                {errors.responsaveisIds && <p className="mt-1 text-xs text-red-600">{errors.responsaveisIds}</p>}
                                {modalError && <p className="mt-1 text-xs text-red-600">{modalError}</p>}

                                <div className="relative" ref={respDropdownRef}>
                                    <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg viewBox="0 0 24 24" className="h-4 w-4 text-gray-400"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27a6 6 0 10-.71.71l.27.28v.79L20 20.49 21.49 19 15.5 14zM10 15a5 5 0 110-10 5 5 0 010 10z"/></svg>
                    </span>
                                        <input
                                            className="w-full border rounded-lg pl-9 pr-10 py-3 text-sm md:text-base disabled:bg-gray-50 disabled:text-gray-400"
                                            placeholder={form.secretariaId ? "Buscar responsável por nome…" : "Selecione uma secretaria primeiro"}
                                            value={respQuery}
                                            onChange={e => { setRespQuery(e.target.value); setRespOpen(!!e.target.value.trim() && !!form.secretariaId) }}
                                            onFocus={() => setRespOpen(!!respQuery.trim() && !!form.secretariaId)}
                                            disabled={!form.secretariaId} // ⚠️ só habilita com secretaria selecionada
                                        />
                                    </div>
                                    {respOpen && respQuery.trim() && form.secretariaId && (
                                        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-auto">
                                            {respOptions.length === 0 && (<div className="px-3 py-2 text-sm text-gray-500">Nenhum responsável encontrado</div>)}
                                            {respOptions.map(r => (
                                                <button key={r.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                                                        onClick={() => handlePickResponsavel(r)}>
                                                    {r.nome} {r.email ? <span className="text-gray-400">({r.email})</span> : null}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* footer */}
                        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-center gap-3">
                            <button className="px-5 py-2.5 rounded-lg border hover:bg-gray-50" onClick={() => setModalOpen(false)}>Cancelar</button>
                            <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-50"
                                    onClick={save} disabled={busy}>
                                {busy ? <Spinner/> : null}
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
                        <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-red-200 via-rose-200 to-transparent blur" />
                        <div className="relative bg-white rounded-2xl border border-gray-100 shadow-2xl overflow-hidden">
                            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-gray-800">Confirmar exclusão</h3>
                                <button className="text-gray-400 hover:text-gray-600" onClick={cancelRemove} aria-label="Fechar">✕</button>
                            </div>

                            <div className="p-5">
                                <p className="text-sm text-gray-700">Tem certeza que deseja excluir o projeto <span className="font-medium text-gray-900">“{toDelete.nome}”</span>?</p>
                                <p className="mt-1 text-xs text-gray-500">Esta ação não pode ser desfeita.</p>
                            </div>

                            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-center gap-3">
                                <button className="px-5 py-2.5 rounded-lg border hover:bg-gray-50" onClick={cancelRemove} disabled={busy}>Cancelar</button>
                                <button className="px-5 py-2.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50" onClick={confirmRemove} disabled={busy}>Excluir</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal simples para listar responsáveis do projeto */}
            {respModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
                    <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-100 p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <h4 className="text-base font-semibold text-gray-800">Responsáveis</h4>
                                {respModalProjetoNome && <p className="text-xs text-gray-500 mt-0.5">{respModalProjetoNome}</p>}
                            </div>
                            <button className="text-gray-400 hover:text-gray-600" onClick={() => setRespModalOpen(false)} aria-label="Fechar">✕</button>
                        </div>

                        {respModalLoading && <p className="mt-3 text-sm text-gray-600">Carregando…</p>}

                        {!respModalLoading && (
                            <ul className="mt-3 divide-y divide-gray-100">
                                {respModalLista.length === 0 && <li className="py-2 text-sm text-gray-500">Nenhum responsável vinculado.</li>}
                                {respModalLista.map(r => (
                                    <li key={r.id} className="py-2">
                                        <div className="text-sm text-gray-800">{r.nome}</div>
                                        {r.email && <div className="text-xs text-gray-500">{r.email}</div>}
                                    </li>
                                ))}
                            </ul>
                        )}

                        <div className="mt-4 flex justify-end">
                            <button onClick={() => setRespModalOpen(false)} className="px-3 py-2 text-sm rounded-lg border">Fechar</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

export default ProjetosPage
