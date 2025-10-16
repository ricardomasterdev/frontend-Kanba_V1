// src/pages/SecretariasPage.tsx
import React, { useEffect, useState } from 'react'
import {
    listarSecretarias,
    criarSecretaria,
    excluirSecretaria,
    atualizarSecretaria,
    type SecretariaDTO,
} from '../services/secretarias'

const PAGE_SIZE = 10

const SecretariasPage: React.FC = () => {
    const [list, setList] = useState<SecretariaDTO[]>([])
    const [q, setQ] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Paginação
    const [page, setPage] = useState(0)
    const [totalPages, setTotalPages] = useState(0)

    // Modal: create/edit
    const [modalOpen, setModalOpen] = useState(false)
    const [modalTitle, setModalTitle] =
        useState<'Nova secretaria' | 'Editar secretaria'>('Nova secretaria')
    const [editingId, setEditingId] = useState<number | null>(null)
    const [modalNome, setModalNome] = useState('')

    // Erros de validação do modal
    const [formErrors, setFormErrors] = useState<{ nome?: string }>({})

    // Modal: confirmar exclusão
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [toDelete, setToDelete] = useState<SecretariaDTO | null>(null)

    const load = async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await listarSecretarias({ q, page, size: PAGE_SIZE })
            setList(res.content ?? [])
            setTotalPages(res.totalPages ?? 0)
        } catch (e: any) {
            setError(e?.message ?? 'Falha ao listar secretarias')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page])

    // Ações do modal de criar/editar
    const openCreate = () => {
        setModalTitle('Nova secretaria')
        setEditingId(null)
        setModalNome('')
        setFormErrors({})
        setModalOpen(true)
    }

    const openEdit = (s: SecretariaDTO) => {
        setModalTitle('Editar secretaria')
        setEditingId(s.id)
        setModalNome(s.nome ?? '')
        setFormErrors({})
        setModalOpen(true)
    }

    const closeModal = () => setModalOpen(false)

    const saveModal = async () => {
        // validação simples
        const nome = modalNome.trim()
        const nextErrors: { nome?: string } = {}
        if (!nome) nextErrors.nome = 'Informe o nome da secretaria'

        if (Object.keys(nextErrors).length > 0) {
            setFormErrors(nextErrors)
            return
        }

        setLoading(true)
        setError(null)
        try {
            if (editingId == null) {
                await criarSecretaria(nome) // back espera { id:0, nome } (o service já monta)
                setPage(0)
            } else {
                await atualizarSecretaria(editingId, nome)
            }
            closeModal()
            await load()
        } catch (e: any) {
            setError(e?.message ?? 'Falha ao salvar secretaria')
        } finally {
            setLoading(false)
        }
    }

    // Ações do modal de confirmação
    const askRemove = (s: SecretariaDTO) => {
        setToDelete(s)
        setConfirmOpen(true)
    }

    const cancelRemove = () => {
        setConfirmOpen(false)
        setToDelete(null)
    }

    const confirmRemove = async () => {
        if (!toDelete) return
        setLoading(true)
        setError(null)
        try {
            await excluirSecretaria(toDelete.id)
            setConfirmOpen(false)
            setToDelete(null)
            // se removeu o último item da página, volta uma página (quando possível)
            if (list.length === 1 && page > 0) setPage(p => p - 1)
            await load()
        } catch (e: any) {
            setError(e?.message ?? 'Falha ao excluir secretaria')
        } finally {
            setLoading(false)
        }
    }

    const onSearch = async () => {
        setPage(0)
        await load()
    }

    const onClear = async () => {
        setQ('')
        setPage(0)
        await load()
    }

    return (
        <>
            <div className="space-y-6">
                <div>
                    <h2 className="text-xl font-semibold text-gray-800">Secretarias</h2>
                    <p className="text-sm text-gray-500">Cadastro simples de secretarias</p>
                </div>

                {/* Busca + botões (botões abaixo e centralizados) */}
                <div className="bg-white p-4 rounded-2xl border border-gray-100">
                    <div className="grid md:grid-cols-3 gap-3 items-end">
                        <div className="md:col-span-3">
                            <label className="text-sm text-gray-600">Pesquisar</label>
                            <input
                                className="mt-1 w-full border rounded-lg px-3 py-2"
                                placeholder="Buscar por nome…"
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') onSearch() }}
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex flex-wrap items-center justify-center gap-2">
                        <button
                            onClick={onSearch}
                            className="px-5 py-2.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50"
                            disabled={loading}
                        >
                            Pesquisar
                        </button>
                        <button
                            onClick={onClear}
                            className="px-5 py-2.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                            disabled={loading}
                        >
                            Limpar
                        </button>
                        <button
                            onClick={openCreate}
                            className="px-5 py-2.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-50"
                            disabled={loading}
                        >
                            Novo
                        </button>
                    </div>
                </div>

                {/* Lista */}
                <div className="bg-white p-4 rounded-2xl border border-gray-100">
                    {error && (
                        <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                            {error}
                        </div>
                    )}
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="text-left text-gray-500">
                            <th className="py-2">Nome</th>
                            <th className="py-2 w-28">Ações</th>
                        </tr>
                        </thead>
                        <tbody>
                        {list.map((s) => (
                            <tr key={s.id} className="border-t">
                                <td className="py-2">{s.nome}</td>
                                <td className="py-2">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => openEdit(s)}
                                            className="px-2 py-1 text-blue-700 border border-blue-200 hover:bg-blue-50 rounded-lg disabled:opacity-50"
                                            disabled={loading}
                                        >
                                            Editar
                                        </button>
                                        <button
                                            onClick={() => askRemove(s)}
                                            className="px-2 py-1 text-red-700 border border-red-200 hover:bg-red-50 rounded-lg disabled:opacity-50"
                                            disabled={loading}
                                        >
                                            Excluir
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {list.length === 0 && (
                            <tr>
                                <td className="py-4 text-gray-400" colSpan={2}>
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

            {/* Modal Criar/Editar */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
                    <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-gray-100">
                        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-gray-800">{modalTitle}</h3>
                            <button className="text-gray-400 hover:text-gray-600" onClick={closeModal}>✕</button>
                        </div>

                        <div className="p-5">
                            <label className="text-sm text-gray-600">Nome</label>
                            <input
                                className={`mt-1 w-full border rounded-lg px-3 py-2 ${formErrors.nome ? 'border-rose-300 bg-rose-50' : ''}`}
                                value={modalNome}
                                onChange={(e) => { setModalNome(e.target.value); if (formErrors.nome) setFormErrors({ ...formErrors, nome: undefined }) }}
                                placeholder="Ex.: Secretaria de Planejamento"
                            />
                            {formErrors.nome && <p className="mt-1 text-xs text-rose-600">{formErrors.nome}</p>}
                        </div>

                        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-center gap-3">
                            <button
                                className="px-5 py-2.5 rounded-lg border hover:bg-gray-50 disabled:opacity-50"
                                onClick={closeModal}
                                disabled={loading}
                            >
                                Cancelar
                            </button>
                            <button
                                className="px-5 py-2.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-50"
                                onClick={saveModal}
                                disabled={loading}
                            >
                                Salvar
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
                                    Tem certeza que deseja excluir a secretaria{' '}
                                    <span className="font-medium text-gray-900">“{toDelete.nome}”</span>?
                                </p>
                                <p className="mt-1 text-xs text-gray-500">Esta ação não pode ser desfeita.</p>
                            </div>

                            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-center gap-3">
                                <button
                                    className="px-5 py-2.5 rounded-lg border hover:bg-gray-50"
                                    onClick={cancelRemove}
                                    disabled={loading}
                                >
                                    Cancelar
                                </button>
                                <button
                                    className="px-5 py-2.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
                                    onClick={confirmRemove}
                                    disabled={loading}
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

export default SecretariasPage
