import * as Comlink from 'comlink'
import type { WasmSchemaResult, WasmRow, JsonlEngine as JsonlEngineType } from '~/types/wasm'

let engine: JsonlEngineType | null = null
let wasmReady = false
let fileText: string | null = null

async function ensureWasm() {
  if (wasmReady) return
  const wasmModule = await import('~/wasm/jsonl_wasm.js')
  await wasmModule.default()
  wasmReady = true
}

/** Flatten a parsed JSON object into dot-notation keys (mirrors Rust flatten_to_map) */
function flattenToMap(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const nested = value as Record<string, unknown>
      if (Object.keys(nested).length === 0) {
        result[fullKey] = value
      } else {
        Object.assign(result, flattenToMap(nested, fullKey))
      }
    } else {
      result[fullKey] = value
    }
  }
  return result
}

const api = {
  async initFile(file: File): Promise<WasmSchemaResult> {
    await ensureWasm()

    // Store file text for JS-side row parsing fallback
    fileText = await file.text()

    const { JsonlEngine } = await import('~/wasm/jsonl_wasm.js')
    engine = new JsonlEngine() as JsonlEngineType
    engine.set_total_size(file.size)

    const CHUNK_SIZE = 1024 * 1024
    let offset = 0
    while (offset < file.size) {
      const chunk = file.slice(offset, offset + CHUNK_SIZE)
      const buffer = await chunk.arrayBuffer()
      engine.feed_chunk(new Uint8Array(buffer))
      offset += CHUNK_SIZE
    }

    return JSON.parse(JSON.stringify(engine.finalize_scan())) as WasmSchemaResult
  },

  getRows(start: number, end: number): WasmRow[] {
    if (!fileText) throw new Error('No file loaded')

    // Parse rows using JS (WASM scanner gave us line offsets, we parse here)
    const lines = fileText.split('\n')
    // Filter out empty trailing line from split
    const nonEmptyLines = lines.filter((l) => l.trim().length > 0)

    const rows: WasmRow[] = []
    for (let i = start; i < end && i < nonEmptyLines.length; i++) {
      const lineText = nonEmptyLines[i]
      try {
        const parsed = JSON.parse(lineText)
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          rows.push({
            index: i,
            data: flattenToMap(parsed as Record<string, unknown>),
            error: undefined,
          })
        } else {
          rows.push({ index: i, data: {}, error: `Not a JSON object: ${typeof parsed}` })
        }
      } catch (e) {
        rows.push({
          index: i,
          data: {},
          error: e instanceof Error ? e.message : 'Parse error',
        })
      }
    }
    return rows
  },
}

export type WorkerApi = typeof api

Comlink.expose(api)
