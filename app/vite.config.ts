import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  server: {
    port: 3000,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tanstackStart(),
    tailwindcss(),
    viteReact(),
  ],
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['/wasm/jsonl_wasm.js'],
  },
})
