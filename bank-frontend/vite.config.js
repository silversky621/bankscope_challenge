import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:8080'
const aiTarget = process.env.VITE_AI_PROXY_TARGET || 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 1. 기존 Spring Boot (Java) 서버 연결
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        secure: false,
      },
      // 2. 신규 FastAPI (Python/AI) 서버 연결
      '/py': {
        target: aiTarget,
        changeOrigin: true,
        secure: false
      },
    },
  },
})

