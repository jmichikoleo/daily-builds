import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const API = process.env.WST_API ?? 'http://127.0.0.1:5341'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/socket.io': { target: API, ws: true },
      '/healthz': API,
    },
  },
  build: { outDir: 'dist', chunkSizeWarningLimit: 900 },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
})
