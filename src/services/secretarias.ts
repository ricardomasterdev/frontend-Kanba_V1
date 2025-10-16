import api from './api'

export type SecretariaDTO = {
    id: number
    nome: string
}

export type Page<T> = {
    content: T[]
    totalElements: number
    totalPages: number
    number: number
    size: number
}

/** Normaliza resposta do back: aceita array puro ou objeto paginado */
function normalizeList<T>(data: any, page = 0, size = 50): Page<T> {
    if (Array.isArray(data)) {
        return {
            content: data,
            totalElements: data.length,
            totalPages: 1,
            number: 0,
            size,
        }
    }
    if (data?.content) {
        return {
            content: Array.isArray(data.content) ? data.content : [],
            totalElements: Number.isFinite(data.totalElements) ? data.totalElements : (data.content?.length ?? 0),
            totalPages: Number.isFinite(data.totalPages) ? data.totalPages : 1,
            number: Number.isFinite(data.number) ? data.number : page,
            size: Number.isFinite(data.size) ? data.size : size,
        }
    }
    return { content: [], totalElements: 0, totalPages: 0, number: page, size }
}

/** Lista secretarias (opcionais: q, page, size) */
export async function listarSecretarias(params?: {
    q?: string
    page?: number
    size?: number
}): Promise<Page<SecretariaDTO>> {
    const page = params?.page ?? 0
    const size = params?.size ?? 50
    const q = params?.q?.trim()
    const { data } = await api.get('/api/v1/secretarias', { params: { q, page, size } })
    return normalizeList<SecretariaDTO>(data, page, size)
}

/** Cria secretaria — backend espera { id: 0, nome } */
export async function criarSecretaria(nome: string): Promise<SecretariaDTO> {
    const payload: SecretariaDTO = { id: 0, nome: (nome ?? '').trim() }
    const { data } = await api.post('/api/v1/secretarias', payload)
    return data
}

/** Atualiza secretaria — backend espera { id, nome } */
export async function atualizarSecretaria(id: number, nome: string): Promise<SecretariaDTO> {
    const payload: SecretariaDTO = { id, nome: (nome ?? '').trim() }
    const { data } = await api.put(`/api/v1/secretarias/${id}`, payload)
    return data
}

/** Exclui secretaria */
export async function excluirSecretaria(id: number): Promise<void> {
    await api.delete(`/api/v1/secretarias/${id}`)
}

/** Autocomplete: busca por nome (aceita array ou page/content) */
export async function searchSecretarias(q: string, limit = 10): Promise<SecretariaDTO[]> {
    const query = q?.trim() ?? ''
    if (!query) return []
    const { data } = await api.get<any>('/api/v1/secretarias', { params: { q: query, limit } })
    if (Array.isArray(data)) return data as SecretariaDTO[]
    return Array.isArray(data?.content) ? (data.content as SecretariaDTO[]) : []
}

/** Carrega todas (ou o máximo) para montar índice id->nome (array ou page/content) */
export async function listAllSecretarias(limit = 500): Promise<SecretariaDTO[]> {
    const { data } = await api.get<any>('/api/v1/secretarias', { params: { limit } })
    if (Array.isArray(data)) return data as SecretariaDTO[]
    return Array.isArray(data?.content) ? (data.content as SecretariaDTO[]) : []
}
