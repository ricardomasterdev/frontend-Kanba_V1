import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import logo from '../assets/login-logo.png'

const LoginPage: React.FC = () => {
    const { login, loading } = useAuth()
    const navigate = useNavigate()

    // pré-preenchido conforme solicitado
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        try {
            await login(email, password)
            navigate('/', { replace: true })
        } catch {
            setError('Credenciais inválidas ou servidor indisponível')
        }
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-start pt-0 bg-gradient-to-br from-primary-50 to-white">
            {/* Logo bem próxima do topo */}
            <div className="mb-2 mt-2 flex justify-center">
                <img
                    src={logo}
                    alt="Logo"
                    className="w-[180px] h-[180px] object-contain"
                />
            </div>

            {/* Card de login, colado na logo */}
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100 -mt-2">
                {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}

                <form onSubmit={onSubmit} className="space-y-4">
                    <div>
                        <label className="text-sm text-gray-600">E-mail</label>
                        <input
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            type="email"
                            className="w-full mt-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                    </div>

                    <div>
                        <label className="text-sm text-gray-600">Senha</label>
                        <input
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            type="password"
                            className="w-full mt-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                    </div>

                    <button
                        disabled={loading}
                        className="w-full py-2 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 transition disabled:opacity-60"
                    >
                        {loading ? 'Entrando...' : 'Entrar'}
                    </button>
                </form>
            </div>
        </div>
    )
}

export default LoginPage
