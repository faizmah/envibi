import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('three')) return 'three'
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('react-router-dom') || id.includes('react-dom') || id.includes('react')) return 'vendor'
        },
      },
    },
  },
  server: {
    port: 5173,
    headers: {
      'Permissions-Policy': 'nfc=*',
    },
  },
})
