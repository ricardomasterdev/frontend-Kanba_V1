import api from './api'

export type SecretariaDTO = { id: number; nome: string }

export type RespForm = {
    nome: string
    email: string
    cargo?: string
    secretariaId: number | null
}

export type Resp = {
    id: number
    nome: string
    email: string
    cargo?: string
    secretariaId?: number
    // secretariaNome não vem mais do back; resolvemos no front via índice
}

export type PageResp<T> = {
    content: T[]
    totalElements: number
    totalPages: number
    number: number
    size: number
}

/**
 * Lista paginada de responsáveis com filtros opcionais (q, secretariaId).
 * Aceita tanto resposta paginada quanto array simples.
 */
export async function listResponsaveis(
    page = 0,
    size = 10,
    q?: string,
    secretariaId?: number
) {
    const params: Record<string, any> = { page, size }
    if (q && q.trim()) params.q = q.trim()
    if (typeof secretariaId === 'number' && !Number.isNaN(secretariaId)) {
        params.secretariaId = secretariaId
    }

    const { data } = await api.get<PageResp<Resp> | Resp[]>('/api/v1/responsaveis', {
        params,
    })

    // Back pode devolver Page ou array simples
    if (Array.isArray(data)) {
        return {
            content: data,
            totalElements: data.length,
            totalPages: 1,
            number: 0,
            size,
        } as PageResp<Resp>
    }

    // Garantia mínima quando o back não enviar o objeto paginado completo
    if (!data?.content) {
        return {
            content: [],
            totalElements: 0,
            totalPages: 0,
            number: page,
            size,
        } as PageResp<Resp>
    }

    return data
}

/** Cria responsável */
export async function createResponsavel(payload: RespForm) {
    // normaliza secretariaId para número ou null
    const secretariaId =
        payload.secretariaId == null || Number.isNaN(payload.secretariaId)
            ? null
            : Number(payload.secretariaId)

    const { data } = await api.post<Resp>('/api/v1/responsaveis', {
        ...payload,
        secretariaId,
    })
    return data
}

/** Exclui responsável */
export async function deleteResponsavel(id: number) {
    await api.delete(`/api/v1/responsaveis/${id}`)
}

/**
 * Busca secretarias para autocomplete.
 * O back pode devolver array puro ou um page com content.
 */
export async function searchSecretarias(q: string, limit = 10): Promise<SecretariaDTO[]> {
    const query = q?.trim() ?? ''
    if (!query) return []
    const { data } = await api.get<SecretariaDTO[] | any>('/api/v1/secretarias', {
        params: { q: query, limit },
    })
    if (Array.isArray(data)) return data as SecretariaDTO[]
    return Array.isArray(data?.content) ? (data.content as SecretariaDTO[]) : []
}

/**
 * Carrega todas (ou o máximo permitido) para montar índice local (id->nome).
 * Suporta tanto array puro quanto page/content.
 */
export async function listAllSecretarias(limit = 500): Promise<SecretariaDTO[]> {
    const { data } = await api.get<SecretariaDTO[] | any>('/api/v1/secretarias', {
        params: { limit },
    })
    if (Array.isArray(data)) return data as SecretariaDTO[]
    return Array.isArray(data?.content) ? (data.content as SecretariaDTO[]) : []
}
