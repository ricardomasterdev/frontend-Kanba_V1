import React, { useEffect, useState, useCallback } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
    LayoutDashboard,
    KanbanSquare,
    List,
    Users,
    Building2,
    LogOut,
    ChevronDown,
    Menu,
    X
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const Sidebar: React.FC = () => {
    const { logout } = useAuth()
    const { pathname } = useLocation()

    // controla drawer mobile
    const [openMobile, setOpenMobile] = useState(false)

    const closeMobile = useCallback(() => setOpenMobile(false), [])
    const toggleMobile = useCallback(() => setOpenMobile(v => !v), [])

    // fecha ao mudar de rota (mobile)
    useEffect(() => {
        closeMobile()
    }, [pathname, closeMobile])

    // fecha com ESC (mobile)
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeMobile()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [closeMobile])

    // abre "Cadastros" se a rota atual for algum item dele
    const isOnCadastro =
        pathname.startsWith('/projetos') ||
        pathname.startsWith('/responsaveis') ||
        pathname.startsWith('/secretarias')

    const [openCadastros, setOpenCadastros] = useState<boolean>(isOnCadastro)
    useEffect(() => {
        if (isOnCadastro) setOpenCadastros(true)
    }, [isOnCadastro])

    const linkCls = ({ isActive }: { isActive: boolean }) =>
        `flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            isActive ? 'bg-primary-600 text-white' : 'text-gray-700 hover:bg-primary-50'
        }`

    const subLinkCls = ({ isActive }: { isActive: boolean }) =>
        `ml-10 flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
            isActive ? 'bg-primary-600 text-white' : 'text-gray-700 hover:bg-primary-50'
        }`

    return (
        <>
            {/* Botão flutuante (apenas mobile) */}
            <button
                type="button"
                onClick={toggleMobile}
                className="md:hidden fixed top-3 left-3 z-50 inline-flex items-center justify-center rounded-lg border bg-white/90 backdrop-blur px-2.5 py-2 shadow"
                aria-label={openMobile ? 'Fechar menu' : 'Abrir menu'}
            >
                {openMobile ? <X size={18} /> : <Menu size={18} />}
            </button>

            {/* Overlay (apenas quando aberto no mobile) */}
            {openMobile && (
                <div
                    className="fixed inset-0 bg-black/40 md:hidden z-40"
                    onClick={closeMobile}
                    aria-hidden="true"
                />
            )}

            {/* Sidebar */}
            <aside
                className={[
                    'fixed md:static inset-y-0 left-0 z-50 md:z-0',
                    'w-64 h-full bg-white border-r border-gray-200 flex flex-col overflow-y-auto',
                    'transform transition-transform duration-200 ease-in-out',
                    openMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
                ].join(' ')}
                role="navigation"
                aria-label="Menu lateral"
            >
                {/* Cabeçalho com nome do sistema */}
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="text-xl font-bold text-primary-700">SisProj-K</div>
                    {/* Fechar dentro do drawer (mobile) */}
                    <button
                        type="button"
                        onClick={closeMobile}
                        className="md:hidden inline-flex items-center justify-center rounded-lg p-1.5 hover:bg-gray-100"
                        aria-label="Fechar menu"
                    >
                        <X size={18} />
                    </button>
                </div>

                <nav className="p-4 space-y-2 flex-1">
                    {/* Dashboard / Início */}
                    <NavLink to="/" className={linkCls}>
                        <LayoutDashboard size={18} /> Dashboard
                    </NavLink>

                    {/* Grupo: Cadastros */}
                    <div className="space-y-1">
                        <button
                            type="button"
                            onClick={() => setOpenCadastros(s => !s)}
                            aria-expanded={openCadastros}
                            className="w-full flex items-center justify-between px-4 py-2 rounded-lg text-gray-700 hover:bg-primary-50 transition-colors"
                        >
              <span className="flex items-center gap-2">
                <List size={18} />
                Cadastros
              </span>
                            <ChevronDown
                                size={18}
                                className={`transition-transform ${openCadastros ? 'rotate-180' : ''}`}
                            />
                        </button>

                        {openCadastros && (
                            <div className="space-y-1">
                                <NavLink to="/projetos" className={subLinkCls}>
                                    <List size={16} /> Projetos
                                </NavLink>
                                <NavLink to="/responsaveis" className={subLinkCls}>
                                    <Users size={16} /> Responsáveis
                                </NavLink>
                                <NavLink to="/secretarias" className={subLinkCls}>
                                    <Building2 size={16} /> Secretarias
                                </NavLink>
                            </div>
                        )}
                    </div>

                    {/* Kanban (fora do grupo) */}
                    <NavLink to="/kanban" className={linkCls}>
                        <KanbanSquare size={18} /> Kanban
                    </NavLink>
                </nav>

                <div className="p-4 border-t border-gray-100">
                    <button
                        onClick={logout}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border text-gray-700 hover:bg-gray-50"
                    >
                        <LogOut size={18} /> Sair
                    </button>
                </div>
            </aside>
        </>
    )
}

export default Sidebar
