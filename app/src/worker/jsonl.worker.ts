import * as Comlink from 'comlink'
import type { WasmSchemaResult, WasmRow, JsonlEngine as JsonlEngineType } from '~/types/wasm'

let engine: JsonlEngineType | null = null
let wasmReady = false

async function ensureWasm() {
  if (wasmReady) return
  const wasmModule = await import('~/wasm/jsonl_wasm.js')
  await wasmModule.default()
  wasmReady = true
}

const api = {
  async initFile(file: File): Promise<WasmSchemaResult> {
    await ensureWasm()

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

    // JSON round-trip to ensure plain JS objects that survive structured cloning
    return JSON.parse(JSON.stringify(engine.finalize_scan())) as WasmSchemaResult
  },

  getRows(start: number, end: number): WasmRow[] {
    if (!engine) throw new Error('Engine not initialized')
    const raw = engine.get_rows(start, end)
    // Debug: inspect raw WASM output
    console.log('[WORKER] get_rows raw type:', typeof raw, Array.isArray(raw) ? `array[${raw.length}]` : '')
    if (Array.isArray(raw) && raw.length > 0) {
      const first = raw[0] as any
      console.log('[WORKER] first row keys:', Object.keys(first).join(', '))
      console.log('[WORKER] first row.data type:', typeof first.data, first.data ? JSON.stringify(first.data).slice(0, 200) : 'null/undefined')
      console.log('[WORKER] first row.error:', first.error)
      console.log('[WORKER] first row.index:', first.index)
    }
    // JSON round-trip to ensure plain JS objects that survive structured cloning
    return JSON.parse(JSON.stringify(raw)) as WasmRow[]
  },
}

export type WorkerApi = typeof api

Comlink.expose(api)
