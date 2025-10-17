import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
    console.log('🚀 Building with mode:', mode)

    return {
        plugins: [react()],

        // Configuração do servidor de desenvolvimento
        server: {
            port: 5173,
            host: '0.0.0.0', // Aceita conexões de qualquer IP
            strictPort: false,
        },

        // Configuração do preview (para testar o build)
        preview: {
            port: 4173,
            host: '0.0.0.0', // Aceita conexões de qualquer IP em homolog/prod
            strictPort: false,
        },

        // Garante que as variáveis de ambiente sejam carregadas
        envDir: './',

        // Define explicitamente quais variáveis devem ser expostas
        envPrefix: 'VITE_',
    }
})