// services/projetos.ts
import api from './api'
import type { SecretariaDTO } from './responsaveis'

/* =========================
   Tipos
   ========================= */
export type ProjetoForm = {
    nome: string
    secretariaId: number | null
    responsaveisIds: number[]
    inicioPrevisto?: string   // YYYY-MM-DD
    terminoPrevisto?: string  // YYYY-MM-DD
}

// compatível com novo JSON e legados
export type Projeto = {
    id: string
    nome: string
    status: 'A_INICIAR' | 'EM_ANDAMENTO' | 'ATRASADO' | 'CONCLUIDO' | string

    // legados
    secretariaId?: number | null
    responsaveisIds?: number[]

    // novos
    secretaria?: { id: number; nome: string } | null
    responsaveis?: Array<{ id: number; nome: string }>

    // datas
    inicioPrevisto?: string
    terminoPrevisto?: string
    inicioRealizado?: string
    terminoRealizado?: string

    diasAtraso?: number
    percentualTempoRestante?: number
}

export type PageProjeto<T> = {
    content: T[]
    totalElements: number
    totalPages: number
    number: number
    size: number
}

export type RespLite = { id: number; nome: string; email?: string }

/* =========================
   Helpers
   ========================= */
const dateOrUndefined = (s?: string) => (s && s.trim() ? s.trim() : undefined)

function emptyPage<T>(size: number, page = 0): PageProjeto<T> {
    return { content: [], totalElements: 0, totalPages: 0, number: page, size }
}

/* =========================
   Listagem/Persistência de Projetos
   ========================= */
export async function listarProjetos(
    page = 0,
    size = 10,
    q?: string,
    secretariaId?: number,
    status?: string
): Promise<PageProjeto<Projeto>> {
    try {
        const params: Record<string, any> = { page, size }
        if (q && q.trim()) params.q = q.trim()
        if (typeof secretariaId === 'number' && !Number.isNaN(secretariaId)) params.secretariaId = secretariaId
        if (status && status.trim()) params.status = status.trim()

        const { data } = await api.get<PageProjeto<Projeto> | Projeto[]>('/api/v1/projetos', { params })

        // API pode retornar array simples (sem paginação)
        if (Array.isArray(data)) {
            return {
                content: data.map((p: any) => normalizeProjeto(p)),
                totalElements: data.length,
                totalPages: 1,
                number: 0,
                size
            }
        }

        if (!data?.content) return emptyPage<Projeto>(size, page)

        const content = (data.content || []).map((p: any) => normalizeProjeto(p))
        return { ...(data as any), content }
    } catch {
        // Falha de rede/servidor -> não quebrar UI
        return emptyPage<Projeto>(size, page)
    }
}

function normalizeProjeto(p: any): Projeto {
    const secretaria =
        (p?.secretaria && typeof p.secretaria === 'object')
            ? { id: Number(p.secretaria.id), nome: String(p.secretaria.nome ?? '') }
            : (p?.secretariaId != null
                ? { id: Number(p.secretariaId), nome: String(p?.secretariaNome ?? '') }
                : null)

    const responsaveis = Array.isArray(p?.responsaveis)
        ? p.responsaveis
            .filter((r: any) => r != null)
            .map((r: any) => ({ id: Number(r.id), nome: String(r.nome) }))
        : undefined

    return { ...p, secretaria, responsaveis }
}

export async function criarProjeto(payload: ProjetoForm) {
    const body = {
        nome: payload.nome?.trim(),
        secretariaId: payload.secretariaId ?? null,
        responsaveisIds: Array.isArray(payload.responsaveisIds) ? payload.responsaveisIds : [],
        inicioPrevisto: dateOrUndefined(payload.inicioPrevisto),
        terminoPrevisto: dateOrUndefined(payload.terminoPrevisto),
    }
    await api.post('/api/v1/projetos', body)
}

export async function atualizarProjeto(id: string, payload: ProjetoForm) {
    const body = {
        nome: payload.nome?.trim(),
        secretariaId: payload.secretariaId ?? null,
        responsaveisIds: Array.isArray(payload.responsaveisIds) ? payload.responsaveisIds : [],
        inicioPrevisto: dateOrUndefined(payload.inicioPrevisto),
        terminoPrevisto: dateOrUndefined(payload.terminoPrevisto),
    }
    await api.put(`/api/v1/projetos/${id}`, body)
}

export async function excluirProjeto(id: string) {
    await api.delete(`/api/v1/projetos/${id}`)
}

/* =========================
   Autocomplete Secretarias (defensivo)
   ========================= */
export async function searchSecretariasProjetos(q: string, limit = 10): Promise<SecretariaDTO[]> {
    try {
        const { data } = await api.get<any>('/api/v1/secretarias', { params: { q: q?.trim(), limit } })
        if (Array.isArray(data)) return data
        return Array.isArray(data?.content) ? data.content : []
    } catch {
        return []
    }
}

export async function listAllSecretariasProjetos(limit = 500): Promise<SecretariaDTO[]> {
    try {
        const { data } = await api.get<any>('/api/v1/secretarias', { params: { limit } })
        if (Array.isArray(data)) return data
        return Array.isArray(data?.content) ? data.content : []
    } catch {
        return []
    }
}

/* =========================
   Autocomplete Responsáveis (escopado por secretaria + à prova de falhas)
   ========================= */
export async function searchResponsaveis(
    q: string,
    limit = 10,
    secretariaId: number
): Promise<RespLite[]> {
    try {
        const query = (q ?? '').trim()
        const sid = Number(secretariaId)

        if (!query || !Number.isFinite(sid)) return []

        // Chamada única — sempre enviar secretariaId; se o back ignorar, filtramos aqui
        const resp = await api
            .get<any>('/api/v1/responsaveis', { params: { q: query, size: limit, page: 0, secretariaId: sid } })
            .catch(() => ({ data: [] } as any)) // garante que não explode

        const raw = Array.isArray(resp?.data) ? resp.data : resp?.data?.content
        if (!Array.isArray(raw)) return []

        // Filtragem defensiva no cliente (caso o servidor ignore secretariaId)
        const filtrados = raw.filter((r: any) => {
            if (Number(r?.secretariaId) === sid) return true
            if (Number(r?.secretaria?.id) === sid) return true
            if (Array.isArray(r?.secretarias)) {
                return r.secretarias.some((s: any) => Number(s?.id) === sid)
            }
            // Sem metadados de secretaria — para não misturar de outras, descarte
            return false
        })

        const base = (filtrados.length ? filtrados : []).slice(0, limit)

        return base
            .filter((r: any) => r != null && r.id != null && r.nome != null)
            .map((r: any) => ({
                id: Number(r.id),
                nome: String(r.nome),
                email: r?.email,
            }))
    } catch {
        return []
    }
}

/* =========================
   Vínculos de responsáveis (liga/desliga com fallback)
   ========================= */
/*
 - Tenta endpoint dedicado: POST/DELETE /api/v1/projetos/{id}/responsaveis/{rid}
 - Se não existir (404/400/405), faz fallback em PUT /projetos/{id} com snapshot de ids
 - Envia secretariaId e snapshot para back-compat e validações
*/
export async function vincularResponsavelAoProjeto(
    projetoId: string,
    responsavelId: number,
    secretariaId: number | null,
    responsaveisIdsSnapshot: number[]
) {
    const url = `/api/v1/projetos/${projetoId}/responsaveis/${responsavelId}`
    // tentativa 1: endpoint dedicado
    try {
        return (await api.post(url, { secretariaId, responsaveisIds: responsaveisIdsSnapshot })).data
    } catch (e: any) {
        const st = e?.response?.status
        if (st !== 404 && st !== 400 && st !== 405) throw e
    }
    // fallback: PUT no projeto com merge
    const body = {
        secretariaId,
        responsaveisIds: Array.isArray(responsaveisIdsSnapshot)
            ? Array.from(new Set(responsaveisIdsSnapshot))
            : [],
    }
    return (await api.put(`/api/v1/projetos/${projetoId}`, body)).data
}

export async function desvincularResponsavelDoProjeto(
    projetoId: string,
    responsavelId: number,
    secretariaId: number | null,
    responsaveisIdsSnapshotAntes: number[]
) {
    const url = `/api/v1/projetos/${projetoId}/responsaveis/${responsavelId}`
    // tentativa 1: endpoint dedicado
    try {
        return (await api.delete(url, { data: { secretariaId, responsaveisIds: responsaveisIdsSnapshotAntes } })).data
    } catch (e: any) {
        const st = e?.response?.status
        if (st !== 404 && st !== 400 && st !== 405) throw e
    }
    // fallback: PUT filtrando o id removido
    const nextIds = (responsaveisIdsSnapshotAntes || []).filter(id => Number(id) !== Number(responsavelId))
    const body = {
        secretariaId,
        responsaveisIds: Array.from(new Set(nextIds)),
    }
    return (await api.put(`/api/v1/projetos/${projetoId}`, body)).data
}
