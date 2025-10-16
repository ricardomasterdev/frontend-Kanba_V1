import React, { useEffect, useMemo, useState } from 'react'
import {
    DragDropContext, Droppable, Draggable,
    DropResult
} from '@hello-pangea/dnd'
import {
    getBoard,
    transitionProjeto,
    Status,
    getProjeto,
    updateProjeto,
} from '../services/kanban'

/* =========================
   Tipos locais
   ========================= */
type Projeto = {
    id: string
    nome: string
    status: Status
    percentualTempoRestante: number
    diasAtraso: number
    inicioPrevisto?: string | null
    terminoPrevisto?: string | null
    inicioRealizado?: string | null
    terminoRealizado?: string | null
}

type Board = Record<Status, Projeto[]>

type RespMin = { id?: string | number; nome: string; email?: string; cargo?: string }

/* =========================
   Títulos das colunas
   ========================= */
const COLUMN_TITLES: Record<Status, string> = {
    A_INICIAR: 'A INICIAR',
    EM_ANDAMENTO: 'EM ANDAMENTO',
    ATRASADO: 'ATRASADO',
    CONCLUIDO: 'CONCLUÍDO'
}

/* =========================
   Header da coluna
   ========================= */
const ColumnHeader: React.FC<{ title: string; className?: string }> = ({ title, className }) => (
    <h3 className={`font-semibold mb-3 ${className || ''}`}>{title}</h3>
)

/* =========================
   Helpers de data e regra de status
   ========================= */
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x }
const today = () => startOfDay(new Date())

const parseDateFlexible = (s?: string | null): Date | null => {
    if (!s) return null
    let v = String(s).trim()
    if (v.length >= 10) v = v.slice(0,10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { const [y,m,d]=v.split('-').map(Number); return new Date(y,m-1,d) }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) { const [d,m,y]=v.split('/').map(Number); return new Date(y,m-1,d) }
    if (/^\d{2}-\d{2}-\d{4}$/.test(v)) { const [d,m,y]=v.split('-').map(Number); return new Date(y,m-1,d) }
    const dt = new Date(v)
    return Number.isNaN(dt.getTime()) ? null : startOfDay(dt)
}
const dateOnly = (d: Date | null) => (d ? startOfDay(d) : null)

const formatLocalYYYYMMDD_T000000 = (d: Date) => {
    const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0')
    return `${y}-${m}-${day}T00:00:00`
}

const formatBR = (s?: string | null) => {
    const d = parseDateFlexible(s)
    if (!d) return '–'
    const dd = String(d.getDate()).padStart(2,'0'), mm = String(d.getMonth()+1).padStart(2,'0'), yy = d.getFullYear()
    return `${dd}/${mm}/${yy}`
}

/** Dias inteiros entre duas datas (ignorando horas) */
const daysBetween = (from: Date, to: Date) => {
    const ms = startOfDay(to).getTime() - startOfDay(from).getTime()
    return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)))
}

/** Calcula o maior atraso entre:
 * - não iniciou após o início previsto (sem inícioRealizado)
 * - não concluiu após o término previsto (sem terminoRealizado)
 */
function computeDiasAtraso(p: {
    inicioPrevisto?: string | null
    terminoPrevisto?: string | null
    inicioRealizado?: string | null
    terminoRealizado?: string | null
}): number {
    const td = today()
    const ip = dateOnly(parseDateFlexible(p.inicioPrevisto))
    const tp = dateOnly(parseDateFlexible(p.terminoPrevisto))
    const ir = parseDateFlexible(p.inicioRealizado)
    const tr = parseDateFlexible(p.terminoRealizado)

    let atraso = 0
    if (ip && ip < td && !ir) atraso = Math.max(atraso, daysBetween(ip, td))
    if (tp && tp < td && !tr) atraso = Math.max(atraso, daysBetween(tp, td))
    return atraso
}

/** Regras de classificação */
function computeStatus(p: Projeto | {
    inicioPrevisto?: string | null
    terminoPrevisto?: string | null
    inicioRealizado?: string | null
    terminoRealizado?: string | null
}): Status | null {
    const ip = dateOnly(parseDateFlexible(p.inicioPrevisto))
    const tp = dateOnly(parseDateFlexible(p.terminoPrevisto))
    const ir = parseDateFlexible(p.inicioRealizado)
    const tr = parseDateFlexible(p.terminoRealizado)
    const td = today()

    if (tr) return 'CONCLUIDO'
    const cond1 = ip !== null && ip < td && !ir
    const cond2 = tp !== null && tp < td && !tr
    if (cond1 || cond2) return 'ATRASADO'
    if (ir && !tr && tp && tp > td) return 'EM_ANDAMENTO'
    if (!ir && !tr) return 'A_INICIAR'
    return null
}

/** Reclassifica o board conforme datas (se existirem) */
function normalizeBoard(data: Board): Board {
    const out: Board = { A_INICIAR: [], EM_ANDAMENTO: [], ATRASADO: [], CONCLUIDO: [] }
    ;(['A_INICIAR','EM_ANDAMENTO','ATRASADO','CONCLUIDO'] as Status[]).forEach(col => {
        (data[col] || []).forEach((p) => {
            const st = computeStatus(p as Projeto) || p.status
            out[st].push({ ...p, status: st })
        })
    })
    return out
}

/** Indica se o card precisa hidratar datas via GET /api/v1/projetos/{id} */
const needsPrevistas = (p: Projeto) => (!p.inicioPrevisto || !p.terminoPrevisto)

/** Hidrata as datas previstas que não vierem no /kanban */
async function hydrateBoardDates(b: Board): Promise<Board> {
    const cols: Status[] = ['A_INICIAR','EM_ANDAMENTO','ATRASADO','CONCLUIDO']
    const out: Board = { A_INICIAR: [], EM_ANDAMENTO: [], ATRASADO: [], CONCLUIDO: [] }

    for (const col of cols) {
        const items = b[col] || []
        const hydrated = await Promise.all(items.map(async (p) => {
            if (needsPrevistas(p)) {
                try {
                    const det = await getProjeto(p.id)
                    return {
                        ...p,
                        inicioPrevisto: det.inicioPrevisto ?? p.inicioPrevisto ?? null,
                        terminoPrevisto: det.terminoPrevisto ?? p.terminoPrevisto ?? null,
                        inicioRealizado: det.inicioRealizado ?? p.inicioRealizado ?? null,
                        terminoRealizado: det.terminoRealizado ?? p.terminoRealizado ?? null,
                    } as Projeto
                } catch { return p }
            }
            return p
        }))
        out[col] = hydrated
    }
    return out
}

/* =========================
   Ícones e Card do projeto
   ========================= */
const UsersIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg viewBox="0 0 24 24" className={className || 'h-4 w-4'}>
        <path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h8v-2c0-.7.18-1.36.5-1.94C8.86 14.41 8.43 14 8 14zm8 0c-.43 0-.86.41-1.5 1.06.32.58.5 1.24.5 1.94v2h8v-2.5C23 15.17 18.33 14 16 14z"/>
    </svg>
)

const CalendarIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg viewBox="0 0 24 24" className={className || 'h-4 w-4'}>
        <path fill="currentColor" d="M7 2h2v2h6V2h2v2h3v18H4V4h3V2zm12 6H5v12h14V8z"/>
    </svg>
)

const ProjetoCard: React.FC<{
    p: Projeto
    provided?: any
    onMoveClick: (to: Status) => void
    onShowResponsaveis: (projeto: Projeto) => void
}> = ({ p, provided, onMoveClick, onShowResponsaveis }) => (
    <div
        ref={provided?.innerRef}
        {...(provided?.draggableProps || {})}
        {...(provided?.dragHandleProps || {})}
        className="border rounded-xl p-3 bg-white shadow-sm"
    >
        <div className="flex items-start justify-between gap-2">
            <div className="font-medium text-gray-800">{p.nome}</div>
            <button
                title="Ver responsáveis"
                className="p-1 rounded-md hover:bg-gray-50 border border-gray-200"
                onClick={() => onShowResponsaveis(p)}
            >
                <UsersIcon className="h-4 w-4 text-gray-600" />
            </button>
        </div>

        <div className="mt-1 flex items-center gap-2 text-xs text-gray-600">
            <CalendarIcon className="h-3.5 w-3.5" />
            <span>Previsto:</span>
            <span className="font-medium">{formatBR(p.inicioPrevisto)}</span>
            <span>→</span>
            <span className="font-medium">{formatBR(p.terminoPrevisto)}</span>
        </div>

        <div className="mt-1 text-xs text-gray-500">
            Tempo restante: {p.percentualTempoRestante}% · Atraso: {p.diasAtraso}d
        </div>

        <div className="mt-2 text-[10px] uppercase tracking-wide text-gray-400">
            Realizar ação abaixo
        </div>

        <div className="mt-1.5 flex flex-wrap gap-2">
            {(['A_INICIAR','EM_ANDAMENTO','ATRASADO','CONCLUIDO'] as Status[])
                .filter(s => s !== p.status)
                .map(s => (
                    <button
                        key={s}
                        onClick={() => onMoveClick(s)}
                        className="text-xs px-2 py-1 border rounded-lg hover:bg-gray-50"
                        title={`Mover para ${COLUMN_TITLES[s]}`}
                    >
                        {COLUMN_TITLES[s]}
                    </button>
                ))}
        </div>
    </div>
)

/* =========================
   Modal para ajuste de datas
   ========================= */
type ProjetoDetalhe = {
    id: string
    nome: string
    inicioPrevisto?: string | null
    terminoPrevisto?: string | null
    inicioRealizado?: string | null
    terminoRealizado?: string | null
    // vínculos para preservar no PUT
    secretariaId?: number | null
    secretaria?: { id?: number | null } | null
    responsaveis?: RespMin[]
    responsaveisDTO?: RespMin[]
    responsaveisIds?: Array<number | string>
}

const AjusteDatasModal: React.FC<{
    projetoId: string
    visible: boolean
    onClose: () => void
    dica?: string
    onSaved: (destino: Status) => void
    destino: Status
}> = ({ projetoId, visible, onClose, dica, onSaved, destino }) => {
    const [loading, setLoading] = useState(false)
    const [det, setDet] = useState<ProjetoDetalhe | null>(null)
    const [inicioPrevisto, setInicioPrevisto] = useState<string>('')
    const [terminoPrevisto, setTerminoPrevisto] = useState<string>('')

    const [clearInicioRealizado, setClearInicioRealizado] = useState(false)
    const [clearTerminoRealizado, setClearTerminoRealizado] = useState(false)
    const [lockInicioRealizado, setLockInicioRealizado] = useState(false)
    const [lockTerminoRealizado, setLockTerminoRealizado] = useState(false)

    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!visible) return
            ;(async () => {
            setLoading(true); setError(null)
            try {
                const full = await getProjeto(projetoId) as ProjetoDetalhe
                setDet(full)
                setInicioPrevisto(full.inicioPrevisto?.substring(0,10) || '')
                setTerminoPrevisto(full.terminoPrevisto?.substring(0,10) || '')
            } catch { setError('Não foi possível carregar o projeto.') }
            finally { setLoading(false) }
        })()
    }, [visible, projetoId])

    useEffect(() => {
        if (!visible) return
        const mustClearIR = /remover o início realizado|remova o início realizado/i.test(dica || '')
        const mustClearTR = /remover o término realizado|remova o término realizado/i.test(dica || '')
        if (mustClearIR) { setClearInicioRealizado(true); setLockInicioRealizado(true) }
        if (mustClearTR) { setClearTerminoRealizado(true); setLockTerminoRealizado(true) }
    }, [visible, dica])

    const salvar = async () => {
        if (!det) return
        setLoading(true); setError(null)
        try {
            const currentSecretariaId = Number(det.secretaria?.id ?? det.secretariaId ?? NaN)
            const secId = Number.isFinite(currentSecretariaId) ? currentSecretariaId : null
            const currentRespIds: number[] = (() => {
                const ids = det?.responsaveisIds
                if (Array.isArray(ids)) return ids.map(Number).filter(n => Number.isFinite(n))
                const arr = det?.responsaveis || det?.responsaveisDTO
                if (Array.isArray(arr)) return arr.map((r: any) => Number(r?.id)).filter(n => Number.isFinite(n))
                return []
            })()

            const payload: any = {
                nome: det.nome,
                inicioPrevisto: inicioPrevisto || undefined,
                terminoPrevisto: terminoPrevisto || undefined,
                inicioRealizado: clearInicioRealizado ? null : det.inicioRealizado ?? null,
                terminoRealizado: clearTerminoRealizado ? null : det.terminoRealizado ?? null,
                secretariaId: secId,
                responsaveisIds: currentRespIds,
            }

            // estado efetivo após edição
            const effectiveForDelay = {
                inicioPrevisto: payload.inicioPrevisto ?? det.inicioPrevisto,
                terminoPrevisto: payload.terminoPrevisto ?? det.terminoPrevisto,
                inicioRealizado: payload.inicioRealizado ?? det.inicioRealizado,
                terminoRealizado: payload.terminoRealizado ?? det.terminoRealizado,
            }

            const st = computeStatus({
                ...effectiveForDelay,
                // campos fake só para satisfazer a assinatura
                id: det.id, nome: det.nome, status: 'A_INICIAR', percentualTempoRestante: 0, diasAtraso: 0
            } as any)

            if (st === 'ATRASADO') {
                payload.diasAtraso = computeDiasAtraso(effectiveForDelay)
            }

            await updateProjeto(det.id, payload)
            onSaved(destino)
        } catch (e: any) {
            const msg = e?.response?.data?.message || e?.message || 'Falha ao salvar alterações.'
            setError(msg)
        } finally { setLoading(false) }
    }

    if (!visible) return null

    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-100 p-5">
                <div className="flex items-start justify-between">
                    <h4 className="text-base font-semibold text-gray-800">Ajustar datas do projeto</h4>
                    <button className="text-gray-400 hover:text-gray-600" onClick={onClose} aria-label="Fechar">✕</button>
                </div>

                {dica && <p className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2">{dica}</p>}
                {error && <p className="mt-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg p-2">{error}</p>}

                <div className="mt-4 grid grid-cols-1 gap-3">
                    <label className="text-sm">
                        Início Previsto
                        <input type="date" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                               value={inicioPrevisto} onChange={e=>setInicioPrevisto(e.target.value)} />
                    </label>
                    <label className="text-sm">
                        Término Previsto
                        <input type="date" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                               value={terminoPrevisto} onChange={e=>setTerminoPrevisto(e.target.value)} />
                    </label>

                    <div className="flex items-center gap-2">
                        <input
                            id="clrInicio"
                            type="checkbox"
                            className="h-4 w-4"
                            checked={clearInicioRealizado}
                            onChange={e=>!lockInicioRealizado && setClearInicioRealizado(e.target.checked)}
                            disabled={lockInicioRealizado}
                            title={lockInicioRealizado ? 'Obrigatório por regra' : 'Remover Início Realizado'}
                        />
                        <label htmlFor="clrInicio" className={`text-sm ${lockInicioRealizado ? 'text-gray-500' : ''}`}>
                            Remover Início Realizado {lockInicioRealizado ? '(obrigatório)' : ''}
                        </label>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            id="clrTermino"
                            type="checkbox"
                            className="h-4 w-4"
                            checked={clearTerminoRealizado}
                            onChange={e=>!lockTerminoRealizado && setClearTerminoRealizado(e.target.checked)}
                            disabled={lockTerminoRealizado}
                            title={lockTerminoRealizado ? 'Obrigatório por regra' : 'Remover Término Realizado'}
                        />
                        <label htmlFor="clrTermino" className={`text-sm ${lockTerminoRealizado ? 'text-gray-500' : ''}`}>
                            Remover Término Realizado {lockTerminoRealizado ? '(obrigatório)' : ''}
                        </label>
                    </div>
                </div>

                <div className="mt-5 flex justify-end gap-2">
                    <button onClick={onClose} className="px-3 py-2 text-sm rounded-lg border">Cancelar</button>
                    <button onClick={salvar} className="px-3 py-2 text-sm rounded-lg bg-gray-900 text-white disabled:opacity-60">
                        {loading ? 'Salvando…' : 'Salvar e tentar novamente'}
                    </button>
                </div>
            </div>
        </div>
    )
}

/* =========================
   Modal de BLOQUEIO (alerta bonito)
   ========================= */
const BlockModal: React.FC<{
    visible: boolean
    title?: string
    message: string
    onClose: () => void
}> = ({ visible, title = 'Ação bloqueada pelas regras', message, onClose }) => {
    if (!visible) return null
    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 backdrop-blur-sm">
            <div className="w-full max-w-md relative">
                <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-red-200 via-rose-200 to-transparent blur" />
                <div className="relative w-full rounded-2xl bg-white shadow-2xl border border-gray-100 p-6">
                    <div className="flex items-start gap-3">
                        <div className="shrink-0 mt-1">
                            <svg viewBox="0 0 24 24" className="h-6 w-6 text-rose-600">
                                <path fill="currentColor" d="M11 7h2v6h-2V7zm0 8h2v2h-2v-2zm1-13C6.48 2 2 6.48 2 12s4.48 10 10 10
                10-4.48 10-10S17.52 2 12 2z"/>
                            </svg>
                        </div>
                        <div className="grow">
                            <h4 className="text-base font-semibold text-gray-800">{title}</h4>
                            <p className="mt-1 text-sm text-gray-700">{message}</p>
                        </div>
                    </div>
                    <div className="mt-5 flex justify-end">
                        <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:opacity-90">
                            Entendi
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

/* =========================
   Popover/Modal de Responsáveis
   ========================= */
const ResponsaveisModal: React.FC<{
    visible: boolean
    projetoId: string
    projetoNome?: string
    onClose: () => void
}> = ({ visible, projetoId, projetoNome, onClose }) => {
    const [loading, setLoading] = useState(false)
    const [lista, setLista] = useState<RespMin[]>([])
    const [erro, setErro] = useState<string | null>(null)

    useEffect(() => {
        if (!visible || !projetoId) return
            ;(async () => {
            setLoading(true); setErro(null)
            try {
                const det = await getProjeto(projetoId) as ProjetoDetalhe
                const arr = (det as any)?.responsaveis || (det as any)?.responsaveisDTO || []
                setLista(Array.isArray(arr) ? arr : [])
                if (!Array.isArray(arr)) setErro('Nenhum responsável vinculado ao projeto.')
            } catch (e: any) {
                setErro(e?.message || 'Falha ao carregar responsáveis.')
            } finally {
                setLoading(false)
            }
        })()
    }, [visible, projetoId])

    if (!visible) return null

    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-100 p-5">
                <div className="flex items-start justify-between">
                    <div>
                        <h4 className="text-base font-semibold text-gray-800">Responsáveis</h4>
                        {projetoNome && <p className="text-xs text-gray-500 mt-0.5">{projetoNome}</p>}
                    </div>
                </div>

                {loading && <p className="mt-3 text-sm text-gray-600">Carregando…</p>}
                {erro && <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg p-2">{erro}</p>}

                {!loading && !erro && (
                    <ul className="mt-3 divide-y divide-gray-100">
                        {lista.length === 0 && <li className="py-2 text-sm text-gray-500">Nenhum responsável.</li>}
                        {lista.map((r, i) => (
                            <li key={(r.id ?? i).toString()} className="py-2">
                                <div className="text-sm text-gray-800">{r.nome}</div>
                                {(r.email || r.cargo) && (
                                    <div className="text-xs text-gray-500">
                                        {r.cargo ? `${r.cargo}` : ''}{r.cargo && r.email ? ' · ' : ''}{r.email || ''}
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}

                <div className="mt-4 flex justify-end">
                    <button onClick={onClose} className="px-3 py-2 text-sm rounded-lg border">Fechar</button>
                </div>
            </div>
        </div>
    )
}

/* =========================
   Regras de transição (ações + validações)
   ========================= */
function humanStatus(s: Status) {
    return ({
        A_INICIAR: 'A INICIAR',
        EM_ANDAMENTO: 'EM ANDAMENTO',
        ATRASADO: 'ATRASADO',
        CONCLUIDO: 'CONCLUÍDO'
    } as const)[s]
}

async function attemptTransitionWithRules(
    id: string,
    from: Status,
    to: Status,
    openAssistModal: (projetoId: string, destino: Status, dica?: string) => void,
    openBlockModal: (message: string) => void
) {
    const det: any = await getProjeto(id)

    // preserva responsáveis
    const currentRespIds: number[] = (() => {
        const ids = det?.responsaveisIds
        if (Array.isArray(ids)) return ids.map(Number).filter((v: any) => Number.isFinite(v))
        const arr = det?.responsaveis || det?.responsaveisDTO
        if (Array.isArray(arr)) return arr.map((r: any) => Number(r?.id)).filter((v: any) => Number.isFinite(v))
        return []
    })()

    // preserva secretaria
    const currentSecretariaId = Number(det?.secretaria?.id ?? det?.secretariaId ?? NaN)
    const safeSecretariaId = Number.isFinite(currentSecretariaId) ? currentSecretariaId : null

    const base: Projeto = {
        id: det.id, nome: det.nome, status: from, percentualTempoRestante: 0, diasAtraso: det.diasAtraso ?? 0,
        inicioPrevisto: det.inicioPrevisto ?? null,
        terminoPrevisto: det.terminoPrevisto ?? null,
        inicioRealizado: det.inicioRealizado ?? null,
        terminoRealizado: det.terminoRealizado ?? null,
    }

    const payload: any = {
        nome: det.nome,
        responsaveisIds: currentRespIds,
        secretariaId: safeSecretariaId,
    }

    const td = today()
    const todayStr = formatLocalYYYYMMDD_T000000(td)
    const tip = (msg: string) => openAssistModal(id, to, msg)

    const ipDate = dateOnly(parseDateFlexible(base.inicioPrevisto))
    const tpDate = dateOnly(parseDateFlexible(base.terminoPrevisto))

    // regras por transição
    if (from === 'A_INICIAR' && to === 'EM_ANDAMENTO') {
        if (!base.inicioRealizado && !base.terminoRealizado) { payload.inicioRealizado = todayStr }
    }
    else if (from === 'A_INICIAR' && to === 'ATRASADO') {
        if (ipDate && td < ipDate) {
            openBlockModal('O projeto ainda não está atrasado. Ajuste o Término Previsto para o passado ou remova datas realizadas conforme necessário.')
            return
        }
    }
    else if (from === 'A_INICIAR' && to === 'CONCLUIDO') {
        payload.terminoRealizado = todayStr
    }
    else if (from === 'EM_ANDAMENTO' && to === 'A_INICIAR') {
        return tip('Remover o Início Realizado é obrigatório para voltar a A INICIAR. Remover Início Realizado.')
    }
    else if (from === 'EM_ANDAMENTO' && to === 'CONCLUIDO') {
        payload.terminoRealizado = todayStr
    }
    else if (from === 'ATRASADO' && to === 'A_INICIAR') {
        return tip('Para voltar a A INICIAR a partir de ATRASADO, é obrigatório remover o Início Realizado. Remover Início Realizado.')
    }
    else if (from === 'ATRASADO' && to === 'EM_ANDAMENTO') {
        return tip('Para ir para EM ANDAMENTO a partir de ATRASADO, ajuste Início/Término Previsto para datas futuras.')
    }
    else if (from === 'ATRASADO' && to === 'CONCLUIDO') {
        payload.terminoRealizado = todayStr
    }
    else if (from === 'CONCLUIDO' && to === 'A_INICIAR') {
        return tip('Para voltar a A INICIAR a partir de CONCLUÍDO, é obrigatório limpar os realizados. Remover Início Realizado. Remover Término Realizado.')
    }
    else if (from === 'CONCLUIDO' && to === 'EM_ANDAMENTO') {
        const simulated = { ...base, terminoRealizado: null }
        const st = computeStatus(simulated)
        if (st === 'ATRASADO') { return tip('Remover o Término Realizado deixaria o projeto como ATRASADO. Ajuste as datas previstas antes.') }
        payload.terminoRealizado = null
        if (!base.inicioRealizado) payload.inicioRealizado = todayStr
    }
    else if (from === 'CONCLUIDO' && to === 'ATRASADO') {
        if (!tpDate || tpDate >= td) {
            openBlockModal('Não é possível mover para ATRASADO: o Término Previsto não está vencido.')
            return
        }
        payload.terminoRealizado = null
    }

    // estado efetivo (det + payload)
    const effective = {
        ...base,
        inicioPrevisto: payload.inicioPrevisto ?? base.inicioPrevisto,
        terminoPrevisto: payload.terminoPrevisto ?? base.terminoPrevisto,
        inicioRealizado: payload.inicioRealizado ?? base.inicioRealizado,
        terminoRealizado: payload.terminoRealizado ?? base.terminoRealizado,
    }

    const finalStatus = computeStatus(effective)

    if (to === 'ATRASADO' && finalStatus !== 'ATRASADO') {
        if (from === 'EM_ANDAMENTO') {
            return tip('O projeto ainda não está atrasado. Ajuste o Término Previsto para o passado ou remova datas realizadas conforme necessário.')
        }
        openBlockModal('O projeto ainda não está atrasado. Ajuste o Término Previsto para o passado ou remova datas realizadas conforme necessário.')
        return
    }

    if (finalStatus && finalStatus !== to) {
        return tip(
            `Após aplicar as ações, o status resultante seria "${humanStatus(finalStatus)}", não "${humanStatus(to)}". ` +
            'Ajuste Início/Término Previsto/Realizado conforme as regras.'
        )
    }

    // completa previstas (sem perder vínculos)
    if (payload.inicioPrevisto === undefined && det.inicioPrevisto) payload.inicioPrevisto = det.inicioPrevisto
    if (payload.terminoPrevisto === undefined && det.terminoPrevisto) payload.terminoPrevisto = det.terminoPrevisto

    // ✅ se ficou ATRASADO, envia diasAtraso calculado do estado efetivo
    if (finalStatus === 'ATRASADO') {
        payload.diasAtraso = computeDiasAtraso(effective)
    }

    // PUT preservando secretaria/responsáveis
    if (Object.keys(payload).some(k => k !== 'nome')) {
        try { await updateProjeto(id, payload) }
        catch (e: any) { const st = e?.response?.status; if (st !== 400 && st !== 422) throw e }
    }

    await transitionProjeto(id, to)
}

/* =========================
   Página Kanban
   ========================= */
const KanbanPage: React.FC = () => {
    const [board, setBoard] = useState<Board>({ A_INICIAR: [], EM_ANDAMENTO: [], ATRASADO: [], CONCLUIDO: [] })
    const [loading, setLoading] = useState(false)
    const [busy, setBusy] = useState(false)

    // modal de ajuste
    const [modalOpen, setModalOpen] = useState(false)
    const [modalProjetoId, setModalProjetoId] = useState<string>('')
    const [modalDestino, setModalDestino] = useState<Status>('EM_ANDAMENTO')
    const [modalDica, setModalDica] = useState<string | undefined>(undefined)

    // modal de bloqueio
    const [blockOpen, setBlockOpen] = useState(false)
    const [blockMsg, setBlockMsg] = useState('')

    // modal de responsáveis
    const [respOpen, setRespOpen] = useState(false)
    const [respProjetoId, setRespProjetoId] = useState<string>('')
    const [respProjetoNome, setRespProjetoNome] = useState<string>('')

    const load = async () => {
        setLoading(true)
        try {
            const data = await getBoard()
            const normalized = normalizeBoard(data as Board)
            const withDates = await hydrateBoardDates(normalized)
            setBoard(withDates)
        } finally { setLoading(false) }
    }

    const openAssistModal = (projetoId: string, destino: Status, dica?: string) => {
        setModalProjetoId(projetoId); setModalDestino(destino); setModalDica(dica); setModalOpen(true)
    }
    const openBlockModal = (message: string) => { setBlockMsg(message); setBlockOpen(true) }

    useEffect(() => { load() }, [])

    const moveStatus = async (id: string, to: Status, from?: Status) => {
        if (busy) return
        const fromCol = from ?? (['A_INICIAR','EM_ANDAMENTO','ATRASADO','CONCLUIDO'] as Status[])
            .find(col => (board[col] || []).some(p => p.id === id)) as Status

        setBusy(true)
        try { await attemptTransitionWithRules(id, fromCol, to, openAssistModal, openBlockModal) }
        catch (e: any) { const msg = e?.response?.data?.message as string | undefined; openAssistModal(id, to, msg) }
        finally { await load(); setBusy(false) }
    }

    const onDragEnd = async (result: DropResult) => {
        if (busy) return
        const { destination, source, draggableId } = result
        if (!destination) return
        const fromCol = source.droppableId as Status
        const toCol = destination.droppableId as Status
        if (fromCol === toCol && source.index === destination.index) return

        setBusy(true)
        try { await attemptTransitionWithRules(draggableId, fromCol, toCol, openAssistModal, openBlockModal) }
        catch (e: any) { const msg = e?.response?.data?.message as string | undefined; openAssistModal(draggableId, toCol, msg) }
        finally { await load(); setBusy(false) }
    }

    const cols = useMemo(() => ([
        { key: 'A_INICIAR' as Status, cls: 'text-blue-700' },
        { key: 'EM_ANDAMENTO' as Status, cls: 'text-amber-700' },
        { key: 'ATRASADO' as Status, cls: 'text-red-700' },
        { key: 'CONCLUIDO' as Status, cls: 'text-green-700' },
    ]), [])

    return (
        <>
            {busy && (
                <div className="fixed inset-0 z-40 grid place-items-center bg-black/20 backdrop-blur-sm">
                    <div className="relative bg-white/90 border border-gray-100 rounded-2xl shadow-2xl px-6 py-5">
                        <div className="flex items-center gap-3">
                            <svg className="animate-spin h-5 w-5 text-gray-800" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                            </svg>
                            <span className="text-sm font-medium text-gray-800">Aplicando mudança…</span>
                        </div>
                        <div className="absolute -inset-0.5 -z-10 rounded-2xl bg-gradient-to-br from-gray-200/40 to-transparent blur-lg" />
                    </div>
                </div>
            )}

            <BlockModal visible={blockOpen} message={blockMsg} onClose={() => setBlockOpen(false)} />

            <AjusteDatasModal
                projetoId={modalProjetoId}
                visible={modalOpen}
                destino={modalDestino}
                dica={modalDica}
                onClose={() => setModalOpen(false)}
                onSaved={(dest) => {
                    attemptTransitionWithRules(
                        modalProjetoId,
                        (['A_INICIAR','EM_ANDAMENTO','ATRASADO','CONCLUIDO'] as Status[])
                            .find(col => (board[col] || []).some(p => p.id === modalProjetoId)) as Status,
                        dest,
                        openAssistModal,
                        (msg) => { setBlockMsg(msg); setBlockOpen(true) }
                    ).finally(() => { load(); setBusy(false); setModalOpen(false) })
                }}
            />

            <ResponsaveisModal
                visible={respOpen}
                projetoId={respProjetoId}
                projetoNome={respProjetoNome}
                onClose={() => setRespOpen(false)}
            />

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-800">Kanban</h2>
                    {loading && <span className="text-xs text-gray-500">Atualizando…</span>}
                </div>

                <DragDropContext onDragEnd={onDragEnd}>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {cols.map(c => (
                            <Droppable droppableId={c.key} key={c.key}>
                                {(provided) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm min-h-[400px]"
                                    >
                                        <ColumnHeader title={COLUMN_TITLES[c.key]} className={c.cls} />
                                        <div className="space-y-3">
                                            {(board[c.key] || []).map((p, idx) => (
                                                <Draggable draggableId={p.id} index={idx} key={p.id}>
                                                    {(prov) => (
                                                        <ProjetoCard
                                                            p={p}
                                                            provided={prov}
                                                            onMoveClick={(to) => moveStatus(p.id, to, c.key)}
                                                            onShowResponsaveis={(proj) => {
                                                                setRespProjetoId(proj.id)
                                                                setRespProjetoNome(proj.nome)
                                                                setRespOpen(true)
                                                            }}
                                                        />
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                        </div>
                                    </div>
                                )}
                            </Droppable>
                        ))}
                    </div>
                </DragDropContext>
            </div>
        </>
    )
}
export default KanbanPage
