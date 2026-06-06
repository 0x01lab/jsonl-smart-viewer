/**
 * Prerender script for static hosting (GitHub Pages).
 * Runs the production server in-memory and saves the HTML output.
 *
 * Usage: node scripts/prerender.mjs [distDir] [basePath]
 */
import server from '../app/dist/server/server.js'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const distDir = process.argv[2] || 'app/dist/client'
const basePath = process.argv[3] || '/'

async function prerender() {
  const url = `http://localhost${basePath === '/' ? '/' : basePath}`
  const res = await server.fetch(new Request(url))

  if (res.status >= 300 && res.status < 400) {
    // Follow redirect
    const location = res.headers.get('location')
    console.log(`Following redirect → ${location}`)
    const res2 = await server.fetch(new Request(`http://localhost${location}`))
    return await res2.text()
  }

  if (res.status !== 200) {
    throw new Error(`Prerender failed: HTTP ${res.status}`)
  }

  return await res.text()
}

const html = await prerender()

const indexPath = join(distDir, 'index.html')
mkdirSync(dirname(indexPath), { recursive: true })
writeFileSync(indexPath, html)

console.log(`✓ Prerendered ${indexPath} (${html.length} bytes)`)
