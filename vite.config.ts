import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Keep this standalone demo clear of Vite's shared default port.
    port: 5174,
    strictPort: true,
    host: '0.0.0.0',
    proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: true } },
  },
})
