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

    return engine.finalize_scan() as WasmSchemaResult
  },

  getRows(start: number, end: number): WasmRow[] {
    if (!engine) throw new Error('Engine not initialized')
    return engine.get_rows(start, end) as WasmRow[]
  },
}

export type WorkerApi = typeof api

Comlink.expose(api)
