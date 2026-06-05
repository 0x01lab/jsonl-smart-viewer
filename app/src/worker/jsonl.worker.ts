import * as Comlink from 'comlink'
import type { WasmSchemaResult, WasmRow, JsonlEngine as JsonlEngineType } from '~/types/wasm'

let engine: JsonlEngineType | null = null

const api = {
  async initFile(file: File): Promise<WasmSchemaResult> {
    // Dynamic import from public/ — Vite serves /wasm/* at runtime.
    // @ts-expect-error -- absolute public-path import not resolvable by tsc
    const wasmModule = await import('/wasm/jsonl_wasm.js')
    await wasmModule.default()

    engine = new wasmModule.JsonlEngine() as JsonlEngineType
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
