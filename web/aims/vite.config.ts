import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: process.env.AIMS_API_PROXY_TARGET ?? 'http://3.25.132.153:8000',
        changeOrigin: true,
      },
    },
  },
})
