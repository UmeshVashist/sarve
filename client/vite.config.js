import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Unique build timestamp to prevent stale browser chunk caching across deployments
const buildId = Date.now().toString(36)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-${buildId}-[hash].js`,
        chunkFileNames: `assets/[name]-${buildId}-[hash].js`,
        assetFileNames: `assets/[name]-${buildId}-[hash].[ext]`
      }
    }
  }
})

