import api from './api'

export type Status = 'A_INICIAR' | 'EM_ANDAMENTO' | 'ATRASADO' | 'CONCLUIDO'

/** Modelo mínimo usado no modal de ajuste e nas regras */
export type ProjetoDetalhe = {
    id: string
    nome: string
    inicioPrevisto?: string | null
    terminoPrevisto?: string | null
    inicioRealizado?: string | null
    terminoRealizado?: string | null
    // extras para preservar vínculos
    secretariaId?: number | null
    secretaria?: { id?: number | null } | null
    responsaveisIds?: Array<number | string>
}

export async function getBoard() {
    const { data } = await api.get('/api/v1/kanban')
    return data as Record<Status, any[]>
}

/** Transição no back — tentativas com chaves diferentes */
export async function transitionProjeto(id: string, to: Status) {
    const url = `/api/v1/kanban/${id}/transicao`

    try {
        return (await api.post(url, { para: to })).data
    } catch (e: any) {
        const st = e?.response?.status
        if (st !== 400 && st !== 422) throw e
    }
    try {
        return (await api.post(url, { status: to })).data
    } catch (e: any) {
        const st = e?.response?.status
        if (st !== 400 && st !== 422) throw e
    }
    return (await api.post(url, { novoStatus: to })).data
}

export async function getProjeto(id: string) {
    const { data } = await api.get(`/api/v1/projetos/${id}`)
    return data as ProjetoDetalhe
}

export async function updateProjeto(
    id: string,
    payload: Partial<{
        nome: string
        inicioPrevisto: string | null | undefined
        terminoPrevisto: string | null | undefined
        inicioRealizado: string | null
        terminoRealizado: string | null
        secretariaId: number | string | null
        responsaveisIds: Array<number | string>
        diasAtraso: number // ✅ permitir enviar diasAtraso quando ficar ATRASADO
    }>
) {
    const { data } = await api.put(`/api/v1/projetos/${id}`, payload)
    return data
}
