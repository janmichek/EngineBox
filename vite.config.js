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
  build: {
    outDir: 'dist',
    target: 'esnext',
    commonjsOptions: {
      include: [/sql\.js/, /node_modules/],
      transformMixedEsModules: true,
    },
  },
  optimizeDeps: {
    include: ['sql.js', 'sql.js/dist/sql-wasm-browser.js'],
    needsInterop: ['sql.js', 'sql.js/dist/sql-wasm-browser.js'],
  },
  assetsInclude: ['**/*.wasm'],
})
