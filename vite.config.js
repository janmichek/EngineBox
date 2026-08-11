import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'events', 'url'],
      globals: { Buffer: true, global: true },
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
      '/output': 'http://localhost:8787',
    },
  },
  build: {
    outDir: 'dist',
    target: 'esnext',
  },
  optimizeDeps: {
    exclude: ['sql.js'],
  },
  assetsInclude: ['**/*.wasm'],
})
