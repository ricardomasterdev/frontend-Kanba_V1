// src/services/api.ts
import axios from 'axios'

const MODE = import.meta?.env?.MODE
const isHml = MODE === 'hml'
const isProd = MODE === 'prod'

const DEFAULTS = {
    dev: 'http://localhost:8080',
    hml: 'http://177.53.148.179:8080', // ajuste a porta/https se necessário
    prod: 'https://seu-dominio-de-producao.com.br'
}

const baseURL =
    import.meta?.env?.VITE_API_BASE
    || (isHml ? DEFAULTS.hml : isProd ? DEFAULTS.prod : DEFAULTS.dev)

const api = axios.create({
    baseURL,
    timeout: 30000,
    // withCredentials: true, // habilite se precisar enviar cookies p/ o back
})

if (typeof window !== 'undefined') {
    console.info('[API] baseURL =', baseURL, '| mode =', MODE)
}

export default api
