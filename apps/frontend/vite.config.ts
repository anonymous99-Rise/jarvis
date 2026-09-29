import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: {
    alias: {
      '@jarvis/contracts': resolve(__dirname, '../../packages/contracts/src/index.ts')
    }
  },
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true
  }
})
