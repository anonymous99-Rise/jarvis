import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

const alias = {
  '@jarvis/contracts': resolve(__dirname, 'packages/contracts/src/index.ts')
}

export default defineConfig({
  main: {
    resolve: { alias },
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'apps/backend/src/main/index.ts')
      }
    }
  },
  preload: {
    resolve: { alias },
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'apps/backend/src/preload/index.ts'),
        output: {
          format: 'cjs',
          entryFileNames: 'index.cjs'
        }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'apps/frontend'),
    resolve: { alias },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'apps/frontend/index.html')
      }
    }
  }
})
