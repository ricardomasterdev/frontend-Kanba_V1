import React, { createContext, useContext, useMemo, useState } from 'react'
import { publicApi } from '../services/api'

type User = {
    email: string
} | null

type AuthState = {
    token: string | null
    /** timestamp em ms (Date.now()) quando o token expira */
    expiresAt: number | null
    user: User
}

type AuthCtx = {
    user: User
    token: string | null
    loading: boolean
    login: (email: string, password: string) => Promise<void>
    logout: () => void
}

const AuthContext = createContext<AuthCtx | undefined>(undefined)

function loadStored(): AuthState {
    try {
        const raw = localStorage.getItem('auth')
        if (!raw) return { token: null, expiresAt: null, user: null }
        const parsed = JSON.parse(raw)
        return {
            token: parsed?.token ?? null,
            expiresAt: typeof parsed?.expiresAt === 'number' ? parsed.expiresAt : null,
            user: parsed?.user ?? null,
        }
    } catch {
        return { token: null, expiresAt: null, user: null }
    }
}

function isExpired(expiresAt: number | null): boolean {
    if (!expiresAt) return true
    return Date.now() >= expiresAt
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<AuthState>(() => {
        const s = loadStored()
        // se expirado ao iniciar, zera
        if (!s.token || isExpired(s.expiresAt)) {
            return { token: null, expiresAt: null, user: null }
        }
        return s
    })
    const [loading, setLoading] = useState(false)

    async function login(email: string, password: string) {
        setLoading(true)
        try {
            // seu endpoint real:
            // POST /api/v1/auth/login  -> { token, expiresIn }
            const { data } = await publicApi.post('/api/v1/auth/login', { email, password })

            const token: string | null = data?.token ?? null
            const expiresIn: number = Number(data?.expiresIn ?? 0) // segundos

            if (!token || !expiresIn) {
                throw new Error('Resposta de login inválida')
            }

            const expiresAt = Date.now() + expiresIn * 1000

            const next: AuthState = {
                token,
                expiresAt,
                user: { email },
            }

            setState(next)
            localStorage.setItem('auth', JSON.stringify(next))
        } finally {
            setLoading(false)
        }
    }

    function logout() {
        setState({ token: null, expiresAt: null, user: null })
        localStorage.removeItem('auth')
    }

    const value = useMemo<AuthCtx>(() => ({
        user: state.user,
        token: state.token && !isExpired(state.expiresAt) ? state.token : null,
        loading,
        login,
        logout,
    }), [state, loading])

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used within AuthProvider')
    return ctx
}
