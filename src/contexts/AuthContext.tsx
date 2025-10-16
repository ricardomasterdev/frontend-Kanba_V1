import React, { createContext, useContext, useEffect, useState } from 'react'
import api from '../services/api'

type User = { email: string } | null

type AuthCtx = {
  user: User
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthCtx | undefined>(undefined)

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [user, setUser] = useState<User>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const email = localStorage.getItem('email')
    if (token && email) setUser({ email })
  }, [])

  const login = async (email: string, password: string) => {
    setLoading(true)
    try {
      const res = await api.post('/api/v1/auth/login', { email, password })
      const { token } = res.data
      localStorage.setItem('token', token)
      localStorage.setItem('email', email)
      setUser({ email })
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('email')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
