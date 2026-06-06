import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  // GitHub Pages: serves at /jsonl-smart-viewer/
  // Override with VITE_BASE_URL env var if needed
  base: process.env.VITE_BASE_URL || '/',
  server: {
    port: 3000,
  },
  resolve: {
    tsconfigPaths: true,
    alias: {
      '~': path.resolve(__dirname, 'src'),
    },
  },
  plugins: [
    tanstackStart(),
    tailwindcss(),
    viteReact(),
  ],
  worker: {
    format: 'es',
  },
})
