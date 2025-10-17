// src/services/api.ts
import axios from 'axios'

// O Vite sempre seta MODE como 'production' no build
// Então vamos usar a presença da variável VITE_API_BASE para determinar o ambiente
const VITE_API_BASE = import.meta.env.VITE_API_BASE
const MODE = import.meta.env.MODE

const DEFAULTS = {
    dev: 'http://localhost:8080',
    hml: 'http://177.53.148.179:8080',
    prod: 'http://177.53.148.179:8080'
}

// Usa VITE_API_BASE se definido, senão usa localhost (dev)
const baseURL = VITE_API_BASE || DEFAULTS.dev

// Determina ambiente pela URL para logs
const isDev = baseURL.includes('localhost')
const ambiente = isDev ? '🟢 DEV' : baseURL.includes('177.53.148.179') ? '🟡 HML/PROD' : '🔴 PROD'

// API para requisições públicas (login, etc)
export const publicApi = axios.create({
    baseURL,
    timeout: 30000,
})

// API para requisições autenticadas
const api = axios.create({
    baseURL,
    timeout: 30000,
})

// Interceptor para adicionar o token automaticamente nas requisições autenticadas
api.interceptors.request.use((config) => {
    try {
        const auth = localStorage.getItem('auth')
        if (auth) {
            const parsed = JSON.parse(auth)
            const token = parsed?.token
            const expiresAt = parsed?.expiresAt

            // Verifica se o token não expirou
            if (token && expiresAt && Date.now() < expiresAt) {
                config.headers.Authorization = `Bearer ${token}`
            }
        }
    } catch (error) {
        console.error('Erro ao adicionar token:', error)
    }
    return config
})

// Interceptor para tratar erros de autenticação
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Token inválido ou expirado
            localStorage.removeItem('auth')
            window.location.href = '/login'
        }
        return Promise.reject(error)
    }
)

if (typeof window !== 'undefined') {
    console.info(`[API] ${ambiente} | baseURL =`, baseURL, '| mode =', MODE, '| VITE_API_BASE =', VITE_API_BASE)
}

export default api