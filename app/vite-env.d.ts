/// <reference types="vite/client" />

/**
 * Type declaration for the WASM module imported from the public directory.
 * At runtime Vite serves /wasm/jsonl_wasm.js from public/wasm/.
 * The concrete types live in public/wasm/jsonl_wasm.d.ts.
 */
declare module '*.wasm.js' {
  export class JsonlEngine {
    free(): void
    [Symbol.dispose](): void
    feed_chunk(chunk: Uint8Array): number
    finalize_scan(): any
    get_rows(start: number, end: number): any
    set_total_size(size: number): void
  }
  export default function init(
    input?: RequestInfo | URL | Response | BufferSource,
  ): Promise<void>
}
