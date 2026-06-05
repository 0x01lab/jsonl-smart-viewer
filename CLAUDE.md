# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**JSONL Smart Viewer** — a high-performance, privacy-first JSONL (JSON Lines) file viewer running entirely in the browser. Designed to handle GB-scale files with smooth 60fps virtualized scrolling, powered by Rust WASM for parsing and the TanStack ecosystem for the UI.

**Current status:** Planning/specification phase. Only `docs/PRD.md` and `docs/UI_UX_SPEC.md` exist — no source code yet.

## Intended Tech Stack

- **Framework:** TanStack Start (React 19)
- **Table:** TanStack Table v8 (column model, sorting, filtering, visibility)
- **Virtualization:** TanStack Virtual v3 (only 30-50 DOM rows rendered at once)
- **Data caching:** TanStack Query (pagination, prefetching, GC eviction)
- **Routing:** TanStack Router with `validateSearch` + Zod (URL-as-state)
- **Backend/parsing:** Rust compiled to WASM, running in Web Workers
- **Styling:** Tailwind CSS v4.0
- **Icons:** Lucide Icons
- **Fonts:** JetBrains Mono (data cells), Inter (UI text)
- **Deployment:** Static site generation (SSG) — single HTML/JS/CSS/WASM bundle

## Architecture

```
Browser main thread                    Web Worker (background)
┌─────────────────────┐               ┌─────────────────────┐
│ TanStack Router      │               │ Rust WASM            │
│ (URL state sync)     │               │ - Newline scanner    │
│         │            │   postMessage  │ - Byte offset index  │
│ TanStack Query       │ ◄──────────►  │ - Schema extraction  │
│ (data cache/prefetch)│  ArrayBuffer  │ - On-demand parsing  │
│         │            │               └─────────────────────┘
│ TanStack Table+Virtual│
│ (render visible rows) │
└─────────────────────┘
```

- **Privacy-first:** 100% client-side. No file uploads to any server.
- **On-demand parsing:** Rust scans `\n` to build a byte-offset index, then uses `file.slice` to parse only requested rows.
- **Schema extraction:** Incremental union algorithm flattens nested JSON (e.g., `{"a":{"b":1}}` → column `a.b`).
- **Fault tolerance:** Invalid JSON rows are marked as `Error Row` with red highlight, not crashes.

## Development Roadmap (from PRD)

1. **Phase 1 (weeks 1-2):** Rust core parser + WASM compilation (`serde_json`/`simd-json`, `wasm-bindgen`)
2. **Phase 2 (week 3):** TanStack Start scaffold, React 19 + Tailwind v4, typed routes with Zod, Worker bridge
3. **Phase 3 (weeks 4-5):** TanStack Table/Virtual/Query integration, virtual scrolling, pagination cache
4. **Phase 4 (week 6):** UI polish (detail drawer, JSON tree viewer), cross-browser testing, SSG build & deploy

## Key Design Decisions

- All table state (page, size, hiddenColumns, sort, filters) lives in the URL via TanStack Router search params — enables shareable links and browser back/forward.
- Column model is dynamic — columns are derived from the union of all JSON keys across the file, with null rendered for missing keys.
- Memory cap target: ≤150MB peak regardless of file size, achieved via on-demand slice fetching and TanStack Query GC.
- First-screen target: ≤300ms to show total row count and headers after dropping a 1GB file.

## UI Layout

IDE-style three-panel layout (see `docs/UI_UX_SPEC.md` for full specs):
- **Toolbar** (48px, top): filename, global search (`Cmd/Ctrl+F`), filter tags, export, theme toggle
- **Left Schema Panel** (240px, collapsible): field checkboxes with type badges, sort/filter controls
- **Center Data Grid**: sticky header, virtualized rows, zebra striping, type-aware cell rendering
- **Right Detail Drawer** (400px, slide-in): JSON tree view with syntax coloring, copy/format buttons
- **Status Bar** (32px, bottom): row counts, pagination, selected row, load time, memory estimate

## Documentation

- `docs/PRD.md` — Full product requirements (Chinese), architecture diagrams, performance KPIs
- `docs/UI_UX_SPEC.md` — Detailed UI spec (Chinese): color palette, typography, spacing, cell rendering rules, keyboard shortcuts, animations, accessibility
