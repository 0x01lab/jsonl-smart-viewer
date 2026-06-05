/**
 * TypeScript types for the WASM JsonlEngine API.
 *
 * These types describe the JS values returned by the wasm-bindgen exports
 * from crates/jsonl-wasm. The auto-generated .d.ts marks return types as
 * `any` because wasm-bindgen uses `serde_wasm_bindgen` to serialize Rust
 * structs into plain JS objects. This file provides the proper shapes.
 *
 * Rust source of truth: crates/jsonl-wasm/src/lib.rs
 * Auto-generated types:  app/public/wasm/jsonl_wasm.d.ts
 */

// ---------------------------------------------------------------------------
// Data types — mirror Rust structs serialized via serde_wasm_bindgen
// ---------------------------------------------------------------------------

/** Column definition returned inside WasmSchemaResult by finalize_scan(). */
export interface WasmColumnDef {
  /** Flattened column key, e.g. "address.city" */
  key: string;
  /** Nesting depth (0 = top-level) */
  depth: number;
  /**
   * Inferred value type.
   * One of: "String" | "Number" | "Boolean" | "Object" | "Array" | "Null" | "Mixed"
   */
  inferred_type: string;
  /** Whether this column has been observed with null / missing values */
  nullable: boolean;
}

/** Schema result returned by finalize_scan(). */
export interface WasmSchemaResult {
  columns: WasmColumnDef[];
  total_rows: number;
  error_rows: number;
}

/** Single row returned inside the array from get_rows(). */
export interface WasmRow {
  /** Zero-based row index */
  index: number;
  /** Flattened key-value data */
  data: Record<string, unknown>;
  /** Error message if JSON parsing failed for this row */
  error?: string;
}

// ---------------------------------------------------------------------------
// Module types — describe the wasm-bindgen "web" target exports
// ---------------------------------------------------------------------------

/**
 * Typed wrapper around the wasm-bindgen JsonlEngine class.
 *
 * The auto-generated class exposes `finalize_scan(): any` and
 * `get_rows(): any` because serde_wasm_bindgen returns opaque JsValue.
 * Consumers should cast those returns to the typed interfaces above:
 *
 *   const schema = engine.finalize_scan() as WasmSchemaResult;
 *   const rows   = engine.get_rows(0, 50) as WasmRow[];
 */
export interface JsonlEngine {
  /** Set the expected total file size. Creates the NewlineScanner and SchemaExtractor. */
  set_total_size(size: number): void;

  /**
   * Feed a chunk of raw bytes. Appends to internal buffer and scans for newlines.
   * Returns progress as a fraction 0.0 – 1.0.
   */
  feed_chunk(chunk: Uint8Array): number;

  /**
   * Finalize the scan. Returns a serialized WasmSchemaResult.
   * Cast the return value: `engine.finalize_scan() as WasmSchemaResult`
   */
  finalize_scan(): WasmSchemaResult;

  /**
   * Parse rows in range [start, end) and return serialized WasmRow[].
   * Cast the return value: `engine.get_rows(0, 50) as WasmRow[]`
   */
  get_rows(start: number, end: number): WasmRow[];

  /** Free WASM memory. Called automatically by Symbol.dispose if available. */
  free(): void;
}

/**
 * Shape of the WASM module imported via `import init, { JsonlEngine } from './wasm/jsonl_wasm.js'`.
 *
 * Usage:
 * ```ts
 * import type { WasmModule } from '@/types/wasm';
 * import init, { JsonlEngine } from '../../public/wasm/jsonl_wasm.js';
 *
 * await init();
 * const engine = new JsonlEngine() as import('@/types/wasm').JsonlEngine;
 * ```
 */
export interface WasmModule {
  /** Initialise the WASM module (fetches + compiles the .wasm binary). */
  default: (input?: RequestInfo | URL | Response | BufferSource) => Promise<void>;
  /** Constructor for the JsonlEngine WASM class. */
  JsonlEngine: new () => JsonlEngine;
}
