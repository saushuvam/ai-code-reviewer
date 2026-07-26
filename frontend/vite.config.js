import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['react-simple-code-editor'],
  },
  server: {
    proxy: {
      '/ai': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  }
})