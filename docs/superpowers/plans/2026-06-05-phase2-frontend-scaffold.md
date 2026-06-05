# Phase 2: Frontend Scaffold + Worker Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a TanStack Start + shadcn/ui frontend that loads a JSONL file via drag-and-drop, scans it in a Web Worker using the Phase 1 WASM engine, and displays parsed rows in a paged data table.

**Architecture:** Single-page app with two states (drop zone → table). A Web Worker wraps the Rust WASM `JsonlEngine` and exposes it via Comlink. React hooks bridge the Worker into component state. TanStack Table v8 handles column generation and pagination. All UI uses shadcn/ui Nova compact components with OKLCH color tokens.

**Tech Stack:** TanStack Start (React 19), shadcn/ui Nova, Tailwind CSS v4, TanStack Table v8, Comlink, wasm-pack, Vitest, pnpm workspaces

**Spec:** `docs/superpowers/specs/2026-06-05-phase2-frontend-scaffold-design.md`

**Deviation from spec:** Source code goes in `app/src/` (TanStack Start default) instead of `app/app/`. This avoids custom `srcDir` configuration and matches official TanStack Start documentation.

---

## File Map

| File | Responsibility |
|------|---------------|
| `package.json` (root) | pnpm workspace root, build:wasm script |
| `pnpm-workspace.yaml` | workspace package list |
| `.gitignore` | ignore build artifacts |
| `app/package.json` | Frontend dependencies & scripts |
| `app/vite.config.ts` | Vite + TanStack Start plugin + Worker config |
| `app/tsconfig.json` | TypeScript strict config with path aliases |
| `app/components.json` | shadcn/ui Nova configuration |
| `app/src/index.css` | Tailwind v4 import + OKLCH color tokens + font imports |
| `app/src/client.tsx` | TanStack Start client entry point |
| `app/src/router.tsx` | TanStack Router configuration |
| `app/src/routes/__root.tsx` | Root layout: HTML shell + CSS import |
| `app/src/routes/index.tsx` | Home page: drop zone ↔ table state switch |
| `app/src/lib/utils.ts` | shadcn `cn()` utility |
| `app/src/types/wasm.ts` | TypeScript types matching WASM API |
| `app/src/worker/jsonl.worker.ts` | Worker entry: WASM init + Comlink expose |
| `app/src/worker/use-jsonl-worker.ts` | React hook: Worker lifecycle + state management |
| `app/src/components/file-drop-zone.tsx` | Drag-and-drop file input |
| `app/src/components/data-table.tsx` | TanStack Table with dynamic columns + pagination |
| `app/src/components/ui/*` | shadcn components (auto-generated) |
| `app/vitest.config.ts` | Vitest configuration |

---

### Task 1: Root pnpm Workspace

**Files:**
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`
- Modify: `.gitignore`

- [ ] **Step 1: Create root package.json**

```jsonc
// package.json
{
  "name": "josnl-viewer",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "pnpm --filter app dev",
    "build": "pnpm --filter app build",
    "build:wasm": "cd crates/jsonl-wasm && wasm-pack build --target web --out-dir ../../app/public/wasm --out-name jsonl_wasm",
    "lint": "pnpm --filter app lint",
    "test": "pnpm --filter app test"
  }
}
```

- [ ] **Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - "app"
```

- [ ] **Step 3: Update .gitignore**

Append to `.gitignore`:

```
/node_modules
app/public/wasm/
```

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-workspace.yaml .gitignore
git commit -m "chore: add pnpm workspace root with WASM build script"
```

---

### Task 2: TanStack Start App Skeleton

**Files:**
- Create: `app/package.json`
- Create: `app/tsconfig.json`
- Create: `app/vite.config.ts`
- Create: `app/src/router.tsx`
- Create: `app/src/client.tsx`
- Create: `app/src/routes/__root.tsx`

- [ ] **Step 1: Create app directory structure**

```bash
mkdir -p app/src/routes app/src/lib app/src/types app/src/worker app/src/components app/public
```

- [ ] **Step 2: Create app/package.json**

```jsonc
// app/package.json
{
  "name": "app",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@tanstack/react-router": "^1.120.17",
    "@tanstack/react-start": "^1.120.17",
    "@tanstack/react-table": "^8.21.3",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "comlink": "^4.4.2",
    "zod": "^3.25.42"
  },
  "devDependencies": {
    "@tanstack/react-router-devtools": "^1.120.17",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.3.0",
    "@types/react": "^19.1.6",
    "@types/react-dom": "^19.1.6",
    "@vitejs/plugin-react": "^4.5.2",
    "jsdom": "^26.1.0",
    "typescript": "^5.8.3",
    "vite": "^6.3.5",
    "vitest": "^3.2.3"
  }
}
```

> **Note:** Use latest versions available at `pnpm add` time. The versions above are approximate minimums.

- [ ] **Step 3: Create app/tsconfig.json**

```jsonc
// app/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "strictNullChecks": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "~/*": ["./src/*"]
    },
    "types": ["vite/client", "vitest/globals"]
  },
  "include": ["src/**/*", "vite-env.d.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create app/vite-env.d.ts**

```typescript
// app/vite-env.d.ts
/// <reference types="vite/client" />
```

- [ ] **Step 5: Create app/vite.config.ts**

```typescript
// app/vite.config.ts
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
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
    // React plugin must come after TanStack Start plugin
    viteReact(),
  ],
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['/wasm/jsonl_wasm.js'],
  },
})
```

- [ ] **Step 6: Create app/src/router.tsx**

```typescript
// app/src/router.tsx
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
```

- [ ] **Step 7: Create app/src/client.tsx**

```typescript
// app/src/client.tsx
import { StartClient } from '@tanstack/react-start/client'
import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { getRouter } from './router'

const router = getRouter()

hydrateRoot(
  document,
  import.meta.env.DEV ? (
    <StrictMode>
      <StartClient router={router} />
    </StrictMode>
  ) : (
    <StartClient router={router} />
  ),
)
```

- [ ] **Step 8: Create app/src/routes/__root.tsx**

```typescript
// app/src/routes/__root.tsx
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'JSONL Smart Viewer' },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <html lang="zh-CN" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground antialiased">
        <Outlet />
        <Scripts />
      </body>
    </html>
  )
}
```

> **Note:** `className="dark"` on `<html>` sets the default theme to dark. The `bg-background` and `text-foreground` use shadcn CSS variables that resolve to OKLCH values.

- [ ] **Step 9: Install dependencies**

```bash
cd app && pnpm install
```

Expected: dependencies installed successfully, no errors.

- [ ] **Step 10: Verify dev server boots**

```bash
cd app && pnpm dev
```

Expected: Vite dev server starts on port 3000. The page may show a blank or error state (no index route yet) — that's fine. Kill the server after confirming it starts.

- [ ] **Step 11: Commit**

```bash
git add app/
git commit -m "feat: TanStack Start app skeleton with Vite config"
```

---

### Task 3: Tailwind CSS v4 + OKLCH Color Tokens + Fonts

**Files:**
- Create: `app/src/index.css`
- Modify: `app/src/routes/__root.tsx` (add CSS import to head)

- [ ] **Step 1: Install Tailwind CSS v4 and PostCSS**

```bash
cd app && pnpm add -D tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: Update app/vite.config.ts — add Tailwind plugin**

Add `tailwindcss()` Vite plugin. The file should now read:

```typescript
// app/vite.config.ts
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
```

- [ ] **Step 3: Create app/src/index.css with Tailwind + OKLCH tokens + font imports**

```css
/* app/src/index.css */
@import "tailwindcss";

/* Fonts — Google Fonts CDN (Phase 2); optimize to self-hosted later */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap');

/*
 * OKLCH Color Tokens — shadcn Nova Neutral base
 * Light theme (auto-generated by shadcn, included here for reference)
 */
:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
}

/* Dark theme */
.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.145 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.145 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.985 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.396 0.163 25.731);
  --border: oklch(0.269 0 0);
  --input: oklch(0.269 0 0);
  --ring: oklch(0.439 0 0);
}

/*
 * JSONL Viewer extended tokens
 * Light theme
 */
:root {
  --table-row-even: oklch(1 0 0);
  --table-row-odd: oklch(0.98 0 0);
  --table-row-hover: oklch(0.96 0.01 270);
  --table-row-selected: oklch(0.94 0.02 270);
  --table-row-error: oklch(0.97 0.02 25);
  --table-header-bg: oklch(0.97 0 0);
  --table-grid-line: oklch(0.922 0 0);
  --table-selected-indicator: oklch(0.45 0.18 270);

  --color-success: oklch(0.65 0.2 160);
  --color-warning: oklch(0.75 0.18 85);
  --color-error: oklch(0.577 0.245 27.325);
  --color-info: oklch(0.55 0.2 260);

  --json-key: oklch(0.55 0.2 260);
  --json-string: oklch(0.55 0.16 150);
  --json-number: oklch(0.65 0.18 65);
  --json-boolean: oklch(0.55 0.2 310);
  --json-null: oklch(0.556 0 0);

  --null-text: oklch(0.65 0 0);
}

/* Dark theme extended tokens */
.dark {
  --table-row-even: oklch(0.145 0 0);
  --table-row-odd: oklch(0.178 0 0);
  --table-row-hover: oklch(0.22 0.02 270);
  --table-row-selected: oklch(0.28 0.05 270);
  --table-row-error: oklch(0.18 0.03 25);
  --table-header-bg: oklch(0.178 0 0);
  --table-grid-line: oklch(0.269 0 0);
  --table-selected-indicator: oklch(0.55 0.2 270);
}

/* Base styles */
body {
  font-family: 'Inter', system-ui, sans-serif;
}

/* Tailwind theme extension for custom fonts */
@theme {
  --font-mono: 'JetBrains Mono', ui-monospace, 'Cascadia Code', 'Fira Code', monospace;
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
}
```

- [ ] **Step 4: Update __root.tsx — add CSS import in head links**

Update `app/src/routes/__root.tsx`:

```typescript
// app/src/routes/__root.tsx
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import appCss from '~/index.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'JSONL Smart Viewer' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <html lang="zh-CN" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground antialiased">
        <Outlet />
        <Scripts />
      </body>
    </html>
  )
}
```

- [ ] **Step 5: Verify styles apply**

```bash
cd app && pnpm dev
```

Open http://localhost:3000. The page background should be dark (`oklch(0.145 0 0)` ≈ #111827), text should be light. Kill the server.

- [ ] **Step 6: Commit**

```bash
git add app/
git commit -m "feat: Tailwind CSS v4 + OKLCH color tokens + Inter/JetBrains Mono fonts"
```

---

### Task 4: shadcn/ui Integration

**Files:**
- Create: `app/components.json`
- Create: `app/src/lib/utils.ts`
- Create: `app/src/components/ui/*` (auto-generated)

- [ ] **Step 1: Install shadcn dependencies**

```bash
cd app && pnpm add clsx tailwind-merge class-variance-authority lucide-react
```

- [ ] **Step 2: Create app/components.json**

```jsonc
// app/components.json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "base-nova",
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "~/components",
    "utils": "~/lib/utils",
    "ui": "~/components/ui",
    "hooks": "~/hooks",
    "lib": "~/lib"
  }
}
```

- [ ] **Step 3: Create app/src/lib/utils.ts**

```typescript
// app/src/lib/utils.ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 4: Install shadcn components**

```bash
cd app && npx shadcn@latest add button card input table badge progress skeleton tooltip sonner
```

This creates files in `app/src/components/ui/`. Accept all prompts with defaults.

> **Note:** If `shadcn add` fails for a specific component, create a minimal version manually. The key components needed are: `Button`, `Card`, `Table`, `Badge`, `Progress`, `Skeleton`, `Sonner`, `Tooltip`.

- [ ] **Step 5: Verify component installation**

```bash
ls app/src/components/ui/
```

Expected: see files for button, card, input, table, badge, progress, skeleton, tooltip, sonner (and their dependencies like separator).

- [ ] **Step 6: Commit**

```bash
git add app/
git commit -m "feat: shadcn/ui Nova integration with required components"
```

---

### Task 5: WASM Build Pipeline + TypeScript Types

**Files:**
- Create: `app/src/types/wasm.ts`

- [ ] **Step 1: Build WASM with wasm-pack**

```bash
cd crates/jsonl-wasm && wasm-pack build --target web --out-dir ../../app/public/wasm --out-name jsonl_wasm
```

Expected: `app/public/wasm/` contains `jsonl_wasm.js`, `jsonl_wasm_bg.wasm`, `jsonl_wasm_bg.js`, `jsonl_wasm.d.ts`.

- [ ] **Step 2: Verify WASM output**

```bash
ls -la app/public/wasm/
```

Expected: see `.js`, `.wasm`, `.d.ts` files.

- [ ] **Step 3: Create app/src/types/wasm.ts**

These types match the Rust structs from `crates/jsonl-wasm/src/lib.rs`:

```typescript
// app/src/types/wasm.ts

/**
 * TypeScript types for the WASM JsonlEngine API.
 * Mirrors Rust structs: WasmColumnDef, WasmSchemaResult, WasmRow
 * from crates/jsonl-wasm/src/lib.rs
 */

/** Column definition returned by finalize_scan() */
export interface WasmColumnDef {
  /** Flattened column key, e.g. "address.city" */
  key: string
  /** Nesting depth (0 = top-level) */
  depth: number
  /** Inferred type: "String" | "Number" | "Boolean" | "Object" | "Array" | "Null" | "Mixed" */
  inferred_type: string
  /** Whether this column has null values */
  nullable: boolean
}

/** Schema result returned by finalize_scan() */
export interface WasmSchemaResult {
  columns: WasmColumnDef[]
  total_rows: number
  error_rows: number
}

/** Single row returned by get_rows() */
export interface WasmRow {
  /** Zero-based row index */
  index: number
  /** Flattened key-value data */
  data: Record<string, unknown>
  /** Error message if JSON parsing failed for this row */
  error?: string
}

/** The WASM JsonlEngine class — matches wasm-bindgen exports */
export interface JsonlEngine {
  /** Set expected file size. Creates scanner + schema extractor. */
  set_total_size(size: number): void
  /** Feed a byte chunk. Returns progress 0.0–1.0. */
  feed_chunk(chunk: Uint8Array): number
  /** Finalize scan. Returns WasmSchemaResult as plain object. */
  finalize_scan(): WasmSchemaResult
  /** Parse rows [start, end). Returns WasmRow[]. */
  get_rows(start: number, end: number): WasmRow[]
}

/** Type of the WASM module default export */
export interface WasmModule {
  default: () => Promise<void>
  JsonlEngine: new () => JsonlEngine
}
```

- [ ] **Step 4: Commit**

```bash
git add app/src/types/wasm.ts
git commit -m "feat: WASM TypeScript type definitions matching Rust API"
```

---

### Task 6: Vitest Configuration + Test Setup

**Files:**
- Create: `app/vitest.config.ts`
- Create: `app/src/test-setup.ts`

- [ ] **Step 1: Install test utilities**

```bash
cd app && pnpm add -D @testing-library/jest-dom jsdom
```

- [ ] **Step 2: Create app/vitest.config.ts**

```typescript
// app/vitest.config.ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, 'src'),
    },
  },
})
```

- [ ] **Step 3: Create app/src/test-setup.ts**

```typescript
// app/src/test-setup.ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 4: Verify test runner works**

Create a smoke test `app/src/lib/utils.test.ts`:

```typescript
// app/src/lib/utils.test.ts
import { describe, it, expect } from 'vitest'
import { cn } from '~/lib/utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1')
  })

  it('deduplicates conflicting Tailwind classes', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })
})
```

Run: `cd app && pnpm test`

Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/
git commit -m "feat: Vitest configuration with jsdom and testing-library"
```

---

### Task 7: Web Worker + Comlink + useJsonlWorker Hook

**Files:**
- Create: `app/src/worker/jsonl.worker.ts`
- Create: `app/src/worker/use-jsonl-worker.ts`
- Create: `app/src/worker/use-jsonl-worker.test.ts`

- [ ] **Step 1: Write failing test for useJsonlWorker**

```typescript
// app/src/worker/use-jsonl-worker.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useJsonlWorker } from './use-jsonl-worker'

// Mock Comlink to return a plain object as the proxy
vi.mock('comlink', () => ({
  wrap: () => ({
    initFile: vi.fn().mockResolvedValue({
      totalRows: 100,
      schema: {
        columns: [
          { key: 'id', depth: 0, inferred_type: 'Number', nullable: false },
          { key: 'name', depth: 0, inferred_type: 'String', nullable: true },
        ],
        total_rows: 100,
        error_rows: 0,
      },
    }),
    getRows: vi.fn().mockResolvedValue([
      { index: 0, data: { id: 1, name: 'Alice' } },
      { index: 1, data: { id: 2, name: null } },
    ]),
  }),
}))

describe('useJsonlWorker', () => {
  it('starts in idle state', () => {
    const { result } = renderHook(() => useJsonlWorker())
    expect(result.current.status).toBe('idle')
    expect(result.current.fileInfo).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('transitions idle → loading → ready on loadFile', async () => {
    const { result } = renderHook(() => useJsonlWorker())

    // Create a minimal File mock
    const file = new File(['{"id":1}\n{"id":2}\n'], 'test.jsonl', {
      type: 'application/jsonl',
    })

    await act(async () => {
      await result.current.loadFile(file)
    })

    expect(result.current.status).toBe('ready')
    expect(result.current.fileInfo).not.toBeNull()
    expect(result.current.fileInfo!.totalRows).toBe(100)
    expect(result.current.fileInfo!.schema.columns).toHaveLength(2)
  })

  it('transitions to error on loadFile failure', async () => {
    // Override the mock to reject for this test
    const { wrap } = await import('comlink')
    vi.mocked(wrap).mockReturnValueOnce({
      initFile: vi.fn().mockRejectedValue(new Error('WASM init failed')),
      getRows: vi.fn(),
    })

    const { result } = renderHook(() => useJsonlWorker())
    const file = new File(['bad'], 'bad.jsonl')

    await act(async () => {
      await result.current.loadFile(file)
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('WASM init failed')
  })

  it('resets to idle state', async () => {
    const { result } = renderHook(() => useJsonlWorker())

    const file = new File(['{"id":1}\n'], 'test.jsonl')
    await act(async () => {
      await result.current.loadFile(file)
    })
    expect(result.current.status).toBe('ready')

    act(() => {
      result.current.reset()
    })

    expect(result.current.status).toBe('idle')
    expect(result.current.fileInfo).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && pnpm test -- src/worker/use-jsonl-worker.test.ts`

Expected: FAIL — module `./use-jsonl-worker` not found.

- [ ] **Step 3: Create app/src/worker/jsonl.worker.ts**

```typescript
// app/src/worker/jsonl.worker.ts
import * as Comlink from 'comlink'
import type { WasmSchemaResult, WasmRow, WasmModule } from '~/types/wasm'

let engine: InstanceType<WasmModule['JsonlEngine']> | null = null

const api = {
  async initFile(file: File): Promise<WasmSchemaResult> {
    // Dynamically import the WASM glue code from public/wasm/
    const wasmModule = await import('/wasm/jsonl_wasm.js') as WasmModule
    await wasmModule.default()

    engine = new wasmModule.JsonlEngine()
    engine.set_total_size(file.size)

    const CHUNK_SIZE = 1024 * 1024 // 1MB
    let offset = 0
    while (offset < file.size) {
      const chunk = file.slice(offset, offset + CHUNK_SIZE)
      const buffer = await chunk.arrayBuffer()
      engine.feed_chunk(new Uint8Array(buffer))
      offset += CHUNK_SIZE
    }

    return engine.finalize_scan()
  },

  getRows(start: number, end: number): WasmRow[] {
    if (!engine) throw new Error('Engine not initialized')
    return engine.get_rows(start, end)
  },
}

export type WorkerApi = typeof api

Comlink.expose(api)
```

- [ ] **Step 4: Create app/src/worker/use-jsonl-worker.ts**

```typescript
// app/src/worker/use-jsonl-worker.ts
import { wrap, type Remote } from 'comlink'
import { useState, useRef, useCallback } from 'react'
import type { WasmSchemaResult, WasmRow } from '~/types/wasm'
import type { WorkerApi } from './jsonl.worker'

export type WorkerStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface FileInfo {
  totalRows: number
  errorRows: number
  schema: WasmSchemaResult
}

export function useJsonlWorker() {
  const workerRef = useRef<Worker | null>(null)
  const apiRef = useRef<Remote<WorkerApi> | null>(null)
  const [status, setStatus] = useState<WorkerStatus>('idle')
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadFile = useCallback(async (file: File) => {
    setStatus('loading')
    setError(null)

    try {
      if (!workerRef.current) {
        const worker = new Worker(
          new URL('./jsonl.worker.ts', import.meta.url),
          { type: 'module' },
        )
        workerRef.current = worker
        apiRef.current = wrap<WorkerApi>(worker)
      }

      const result = await apiRef.current!.initFile(file)
      setFileInfo({
        totalRows: result.total_rows,
        errorRows: result.error_rows,
        schema: result,
      })
      setStatus('ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      setStatus('error')
    }
  }, [])

  const getRows = useCallback(
    async (start: number, end: number): Promise<WasmRow[]> => {
      if (!apiRef.current) throw new Error('Worker not initialized')
      return apiRef.current.getRows(start, end)
    },
    [],
  )

  const reset = useCallback(() => {
    workerRef.current?.terminate()
    workerRef.current = null
    apiRef.current = null
    setStatus('idle')
    setFileInfo(null)
    setError(null)
  }, [])

  return { status, fileInfo, error, loadFile, getRows, reset } as const
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd app && pnpm test -- src/worker/use-jsonl-worker.test.ts`

Expected: 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/worker/ app/src/types/
git commit -m "feat: Web Worker + Comlink bridge with useJsonlWorker hook"
```

---

### Task 8: FileDropZone Component

**Files:**
- Create: `app/src/components/file-drop-zone.tsx`
- Create: `app/src/components/file-drop-zone.test.tsx`

- [ ] **Step 1: Write failing test for FileDropZone**

```typescript
// app/src/components/file-drop-zone.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FileDropZone } from './file-drop-zone'

describe('FileDropZone', () => {
  it('renders drop zone with file input', () => {
    render(<FileDropZone onFile={vi.fn()} />)
    expect(screen.getByText(/拖拽/i)).toBeInTheDocument()
    expect(screen.getByText(/选择文件/i)).toBeInTheDocument()
  })

  it('calls onFile when a file is selected via input', () => {
    const onFile = vi.fn()
    render(<FileDropZone onFile={onFile} />)

    const file = new File(['{"id":1}'], 'test.jsonl')
    const input = screen.getByLabelText(/选择文件/i) as HTMLInputElement

    fireEvent.change(input, { target: { files: [file] } })
    expect(onFile).toHaveBeenCalledWith(file)
  })

  it('calls onFile when a file is dropped', () => {
    const onFile = vi.fn()
    render(<FileDropZone onFile={onFile} />)

    const file = new File(['{"id":1}'], 'test.jsonl')
    const dropZone = screen.getByText(/拖拽/i).closest('div')!

    const dropEvent = new Event('drop', { bubbles: true })
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: { files: [file] },
    })
    dropZone.dispatchEvent(dropEvent)

    expect(onFile).toHaveBeenCalledWith(file)
  })

  it('shows loading state', () => {
    render(<FileDropZone onFile={vi.fn()} loading />)
    expect(screen.getByText(/正在扫描/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && pnpm test -- src/components/file-drop-zone.test.tsx`

Expected: FAIL — module not found.

- [ ] **Step 3: Create app/src/components/file-drop-zone.tsx**

```typescript
// app/src/components/file-drop-zone.tsx
import { useState, useCallback, useRef } from 'react'
import { Button } from '~/components/ui/button'
import { Progress } from '~/components/ui/progress'

interface FileDropZoneProps {
  onFile: (file: File) => void
  loading?: boolean
  error?: string | null
}

export function FileDropZone({ onFile, loading, error }: FileDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) onFile(file)
    },
    [onFile],
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) onFile(file)
    },
    [onFile],
  )

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-lg font-medium text-foreground mb-6">
          JSONL Smart Viewer
        </h1>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            mx-auto max-w-md cursor-pointer rounded-xl border-2 p-8
            transition-colors duration-100
            ${
              isDragOver
                ? 'border-primary bg-accent border-solid'
                : 'border-border border-dashed'
            }
          `}
          onClick={() => inputRef.current?.click()}
        >
          <p className="text-sm text-muted-foreground mb-4">
            拖拽 JSONL 文件到此处
          </p>

          <Button
            variant="default"
            className="h-9"
            onClick={(e) => {
              e.stopPropagation()
              inputRef.current?.click()
            }}
          >
            📂 选择文件
          </Button>

          <input
            ref={inputRef}
            type="file"
            accept=".jsonl,.json,.log,.jsonl.gz"
            onChange={handleInputChange}
            className="hidden"
            aria-label="选择文件"
          />
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          支持: .jsonl / .json / .jsonl.gz &nbsp;·&nbsp; 100% 本地解析 · 隐私安全
        </p>

        {loading && (
          <div className="mt-6 max-w-xs mx-auto">
            <Progress value={undefined} className="h-1.5" />
            <p className="mt-2 text-xs text-muted-foreground">正在扫描...</p>
          </div>
        )}

        {error && (
          <div className="mt-4 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && pnpm test -- src/components/file-drop-zone.test.tsx`

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/file-drop-zone.tsx app/src/components/file-drop-zone.test.tsx
git commit -m "feat: FileDropZone component with drag-and-drop support"
```

---

### Task 9: DataTable Component

**Files:**
- Create: `app/src/components/data-table.tsx`
- Create: `app/src/components/data-table.test.tsx`

- [ ] **Step 1: Write failing test for DataTable**

```typescript
// app/src/components/data-table.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DataTable } from './data-table'
import type { WasmSchemaResult, WasmRow } from '~/types/wasm'

const mockSchema: WasmSchemaResult = {
  columns: [
    { key: 'id', depth: 0, inferred_type: 'Number', nullable: false },
    { key: 'name', depth: 0, inferred_type: 'String', nullable: true },
    { key: 'active', depth: 0, inferred_type: 'Boolean', nullable: false },
    { key: 'meta', depth: 0, inferred_type: 'Object', nullable: true },
  ],
  total_rows: 3,
  error_rows: 1,
}

const mockRows: WasmRow[] = [
  { index: 0, data: { id: 1, name: 'Alice', active: true, meta: null } },
  { index: 1, data: { id: 2, name: 'Bob', active: false, meta: { city: 'NYC' } } },
  { index: 2, data: {}, error: 'Invalid JSON' },
]

describe('DataTable', () => {
  it('renders column headers from schema', () => {
    render(
      <DataTable
        schema={mockSchema}
        rows={mockRows}
        totalRows={3}
        errorRows={1}
        fileName="test.jsonl"
        fileSize={1024}
        currentPage={1}
        pageSize={100}
        selectedRowIndex={null}
        onPageChange={() => {}}
        onRowSelect={() => {}}
      />,
    )

    expect(screen.getByText('id')).toBeInTheDocument()
    expect(screen.getByText('name')).toBeInTheDocument()
    expect(screen.getByText('active')).toBeInTheDocument()
    expect(screen.getByText('meta')).toBeInTheDocument()
  })

  it('renders row data', () => {
    render(
      <DataTable
        schema={mockSchema}
        rows={mockRows}
        totalRows={3}
        errorRows={1}
        fileName="test.jsonl"
        fileSize={1024}
        currentPage={1}
        pageSize={100}
        selectedRowIndex={null}
        onPageChange={() => {}}
        onRowSelect={() => {}}
      />,
    )

    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('renders error row with error indicator', () => {
    render(
      <DataTable
        schema={mockSchema}
        rows={mockRows}
        totalRows={3}
        errorRows={1}
        fileName="test.jsonl"
        fileSize={1024}
        currentPage={1}
        pageSize={100}
        selectedRowIndex={null}
        onPageChange={() => {}}
        onRowSelect={() => {}},
    )

    expect(screen.getByText(/Invalid JSON/i)).toBeInTheDocument()
  })

  it('renders null values as italic "null"', () => {
    render(
      <DataTable
        schema={mockSchema}
        rows={mockRows}
        totalRows={3}
        errorRows={1}
        fileName="test.jsonl"
        fileSize={1024}
        currentPage={1}
        pageSize={100}
        selectedRowIndex={null}
        onPageChange={() => {}}
        onRowSelect={() => {}}
      />,
    )

    // Alice's meta is null
    const nullCells = screen.getAllByText('null')
    expect(nullCells.length).toBeGreaterThanOrEqual(1)
    // Verify italic styling
    expect(nullCells[0].className).toContain('italic')
  })

  it('displays total rows and file info in status bar', () => {
    render(
      <DataTable
        schema={mockSchema}
        rows={mockRows}
        totalRows={3}
        errorRows={1}
        fileName="test.jsonl"
        fileSize={1024}
        currentPage={1}
        pageSize={100}
        selectedRowIndex={null}
        onPageChange={() => {}}
        onRowSelect={() => {}}
      />,
    )

    expect(screen.getByText(/3 行/)).toBeInTheDocument()
    expect(screen.getByText(/test\.jsonl/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && pnpm test -- src/components/data-table.test.tsx`

Expected: FAIL — module not found.

- [ ] **Step 3: Create app/src/components/data-table.tsx**

```typescript
// app/src/components/data-table.tsx
import { useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import type { WasmSchemaResult, WasmRow } from '~/types/wasm'

interface DataTableProps {
  schema: WasmSchemaResult
  rows: WasmRow[]
  totalRows: number
  errorRows: number
  fileName: string
  fileSize: number
  currentPage: number
  pageSize: number
  selectedRowIndex: number | null
  onPageChange: (page: number) => void
  onRowSelect: (index: number | null) => void
}

/** Format number with locale thousands separator */
function formatNumber(value: unknown): string {
  if (typeof value === 'number') {
    return value.toLocaleString()
  }
  return String(value)
}

/** Format file size to human-readable string */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

/** Render a single cell value based on its type */
function CellRenderer({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="italic text-[var(--null-text)]">null</span>
  }

  if (typeof value === 'boolean') {
    return (
      <Badge variant={value ? 'default' : 'secondary'} className="text-[11px]">
        ● {String(value)}
      </Badge>
    )
  }

  if (typeof value === 'number') {
    return <span className="tabular-nums">{formatNumber(value)}</span>
  }

  if (typeof value === 'object') {
    const fields = Array.isArray(value) ? value.length : Object.keys(value).length
    return (
      <Badge variant="outline" className="text-[11px]">
        {Array.isArray(value) ? `[${fields}]` : `{${fields} fields}`}
      </Badge>
    )
  }

  // String
  const str = String(value)
  if (str.length > 50) {
    return <span title={str}>{str.slice(0, 50)}…</span>
  }
  return <>{str}</>
}

export function DataTable({
  schema,
  rows,
  totalRows,
  errorRows,
  fileName,
  fileSize,
  currentPage,
  pageSize,
  selectedRowIndex,
  onPageChange,
  onRowSelect,
}: DataTableProps) {
  const totalPages = Math.ceil(totalRows / pageSize)

  // Build TanStack Table columns from schema
  const columns = useMemo<ColumnDef<WasmRow>[]>(() => {
    const rowNumberCol: ColumnDef<WasmRow> = {
      id: '#',
      size: 52,
      header: '#',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.index + 1}
        </span>
      ),
    }

    const dataCols: ColumnDef<WasmRow>[] = schema.columns.map((col) => ({
      accessorKey: `data.${col.key}`,
      header: col.key,
      cell: ({ row }) => {
        if (row.original.error) return null
        const value = row.original.data[col.key]
        return <CellRenderer value={value} />
      },
    }))

    return [rowNumberCol, ...dataCols]
  }, [schema])

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="flex h-screen flex-col">
      {/* Header bar */}
      <div className="flex h-10 items-center justify-between border-b border-[var(--table-grid-line)] bg-[var(--table-header-bg)] px-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 font-sans text-sm font-medium">
            📄 {fileName}
          </Button>
          <span className="text-xs text-muted-foreground">
            ({formatFileSize(fileSize)})
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {totalRows.toLocaleString()} 行 · {schema.columns.length} 列
        </span>
      </div>

      {/* Table area */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="bg-[var(--table-header-bg)] hover:bg-[var(--table-header-bg)]"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="font-sans text-[13px] font-semibold"
                    style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => {
              const isError = !!row.original.error
              const isSelected = row.original.index === selectedRowIndex
              const isOdd = row.original.index % 2 === 1

              return (
                <TableRow
                  key={row.id}
                  onClick={() => onRowSelect(row.original.index)}
                  className={`
                    cursor-pointer font-mono text-[13px] transition-colors duration-100
                    ${isError
                      ? 'bg-[var(--table-row-error)] border-l-[3px] border-l-[var(--color-error)]'
                      : isSelected
                        ? 'bg-[var(--table-row-selected)] border-l-[3px] border-l-[var(--table-selected-indicator)]'
                        : isOdd
                          ? 'bg-[var(--table-row-odd)]'
                          : 'bg-[var(--table-row-even)]'
                    }
                    hover:bg-[var(--table-row-hover)]
                  `}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={`px-2 py-1 ${
                        isError && cell.column.id !== '#'
                          ? 'text-[var(--color-error)] text-xs'
                          : ''
                      } ${
                        // Right-align number columns
                        cell.column.id !== '#' &&
                        !row.original.error &&
                        typeof row.original.data[schema.columns.find(c =>
                          `data.${c.key}` === cell.column.id
                        )?.key ?? ''] === 'number'
                          ? 'text-right tabular-nums'
                          : cell.column.id === '#'
                            ? 'text-center'
                            : ''
                      }`}
                    >
                      {isError && cell.column.id !== '#'
                        ? row.original.error
                        : flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Status bar */}
      <div className="flex h-7 items-center justify-between border-t border-[var(--table-grid-line)] bg-[var(--table-header-bg)] px-3 text-xs text-muted-foreground font-sans">
        <div className="flex items-center gap-3">
          <span>📊 共 {totalRows.toLocaleString()} 行</span>
          {errorRows > 0 && (
            <span className="text-[var(--color-error)]">
              ⚠ 错误: {errorRows} 行
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {totalPages > 1 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1 text-xs"
                disabled={currentPage <= 1}
                onClick={() => onPageChange(currentPage - 1)}
              >
                ◀
              </Button>
              <span>
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1 text-xs"
                disabled={currentPage >= totalPages}
                onClick={() => onPageChange(currentPage + 1)}
              >
                ▶
              </Button>
            </>
          )}
          {selectedRowIndex !== null && (
            <span>选中: #{selectedRowIndex + 1}</span>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && pnpm test -- src/components/data-table.test.tsx`

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/data-table.tsx app/src/components/data-table.test.tsx
git commit -m "feat: DataTable component with dynamic columns, type-aware cells, pagination"
```

---

### Task 10: Page Integration — Wire Everything Together

**Files:**
- Create: `app/src/routes/index.tsx`

- [ ] **Step 1: Create the home page route**

This is the main integration point. It manages app-level state and connects FileDropZone → Worker → DataTable.

```typescript
// app/src/routes/index.tsx
import { useState, useEffect, useCallback } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { FileDropZone } from '~/components/file-drop-zone'
import { DataTable } from '~/components/data-table'
import { useJsonlWorker } from '~/worker/use-jsonl-worker'
import { Toaster, toast } from '~/components/ui/sonner'

export const Route = createFileRoute('/')({
  component: HomePage,
})

const PAGE_SIZE = 100

function HomePage() {
  const { status, fileInfo, error, loadFile, getRows, reset } = useJsonlWorker()
  const [file, setFile] = useState<File | null>(null)
  const [rows, setRows] = useState<import('~/types/wasm').WasmRow[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedRow, setSelectedRow] = useState<number | null>(null)

  // Load rows when page changes
  useEffect(() => {
    if (status !== 'ready' || !file || !fileInfo) return

    const start = (currentPage - 1) * PAGE_SIZE
    const end = Math.min(start + PAGE_SIZE, fileInfo.totalRows)

    getRows(start, end).then(setRows).catch((err) => {
      toast.error(`加载行数据失败: ${err.message}`)
    })
  }, [status, file, fileInfo, currentPage, getRows])

  const handleFile = useCallback(
    async (newFile: File) => {
      setFile(newFile)
      setCurrentPage(1)
      setSelectedRow(null)
      setRows([])

      try {
        await loadFile(newFile)
        toast.success('文件加载完成')
      } catch (err) {
        toast.error(
          `加载失败: ${err instanceof Error ? err.message : '未知错误'}`,
        )
      }
    },
    [loadFile],
  )

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
    setSelectedRow(null)
  }, [])

  const handleRowSelect = useCallback((index: number | null) => {
    setSelectedRow(index)
  }, [])

  // Not ready yet — show drop zone
  if (status !== 'ready' || !fileInfo) {
    return (
      <>
        <Toaster />
        <FileDropZone
          onFile={handleFile}
          loading={status === 'loading'}
          error={status === 'error' ? error : null}
        />
      </>
    )
  }

  // Ready — show data table
  return (
    <>
      <Toaster />
      <DataTable
        schema={fileInfo.schema}
        rows={rows}
        totalRows={fileInfo.totalRows}
        errorRows={fileInfo.errorRows}
        fileName={file?.name ?? 'unknown.jsonl'}
        fileSize={file?.size ?? 0}
        currentPage={currentPage}
        pageSize={PAGE_SIZE}
        selectedRowIndex={selectedRow}
        onPageChange={handlePageChange}
        onRowSelect={handleRowSelect}
      />
    </>
  )
}
```

- [ ] **Step 2: Verify dev server starts**

```bash
cd app && pnpm dev
```

Open http://localhost:3000. You should see the FileDropZone (dark background, dashed border drop area). The drop zone should be functional but WASM loading won't work yet — that's OK.

- [ ] **Step 3: Commit**

```bash
git add app/src/routes/index.tsx
git commit -m "feat: home page integrating FileDropZone + DataTable + Worker"
```

---

### Task 11: E2E Verification — Build WASM + Full Test

**Files:** No new files. Verification only.

- [ ] **Step 1: Build WASM module**

```bash
cd /Volumes/HIKSEMI/project/josnl-viewer && pnpm build:wasm
```

Expected: `wasm-pack` compiles successfully. `app/public/wasm/` contains `jsonl_wasm.js`, `jsonl_wasm_bg.wasm`, `jsonl_wasm.d.ts`.

If this fails, check:
1. `wasm-pack` is installed (`cargo install wasm-pack`)
2. `wasm32-unknown-unknown` target is installed (`rustup target add wasm32-unknown-unknown`)
3. `crate-type = ["cdylib", "rlib"]` in `crates/jsonl-wasm/Cargo.toml`

- [ ] **Step 2: Create a test JSONL file**

Create `app/public/test.jsonl`:

```jsonl
{"id":1,"name":"Alice","score":95.5,"active":true}
{"id":2,"name":"Bob","score":82.0,"active":false}
{"id":3,"name":"Charlie","score":71.3,"active":true}
{"id":4,"name":"Diana","score":99.9,"active":true}
{"id":5,"name":"Eve","score":88.1,"active":false}
```

- [ ] **Step 3: Run dev server and test manually**

```bash
cd app && pnpm dev
```

Open http://localhost:3000 and verify:

1. **Drop zone visible** — Dark background, dashed border, "拖拽 JSONL 文件到此处" text, "选择文件" button
2. **File selection works** — Click "选择文件", pick `test.jsonl`, or drag it onto the zone
3. **Loading state** — Brief "正在扫描..." indicator appears
4. **Table appears** — Shows columns: `#`, `id`, `name`, `score`, `active`
5. **Cell rendering** — Numbers right-aligned, booleans show as badges, nulls italic
6. **Zebra striping** — Alternating row backgrounds
7. **Row click** — Clicking a row highlights it with indigo selection
8. **Status bar** — Shows "共 5 行 · 5 列"
9. **Header bar** — Shows filename and file size

- [ ] **Step 4: Test with a larger file (optional)**

Use one of the existing test fixtures from Phase 1:

```bash
cp crates/jsonl-core/tests/fixtures/heterogeneous.jsonl app/public/test-large.jsonl
```

Drag it onto the viewer. Verify schema extraction and row rendering work.

- [ ] **Step 5: Run all tests**

```bash
cd app && pnpm test
```

Expected: All tests PASS (utils: 2, useJsonlWorker: 4, FileDropZone: 4, DataTable: 5 = 15 total).

- [ ] **Step 6: Commit (if any fixes were needed)**

```bash
git add -A
git commit -m "feat: Phase 2 complete — frontend scaffold with WASM Worker bridge"
```

---

## Self-Review

### Spec Coverage

| Spec Section | Task |
|---|---|
| §1 目标 (drag file → table) | Tasks 8, 9, 10, 11 |
| §2 项目结构 | Tasks 1, 2 |
| §3 技术选型 | Tasks 2, 4, 5 |
| §4 项目初始化步骤 | Tasks 1, 2, 3, 4 |
| §5 OKLCH 色彩 Token | Task 3 |
| §6 Worker 通信层 | Tasks 5, 7 |
| §7 UI 组件 | Tasks 8, 9, 10 |
| §8 字体配置 | Task 3 |
| §9 Vite 配置 | Task 2 |
| §10 错误处理 | Task 7 (hook), Task 8 (drop zone), Task 10 (toast) |
| §11 测试策略 | Tasks 6, 7, 8, 9 |
| §12 Phase 3 衔接点 | Covered by stable interfaces in Tasks 7, 9 |

### Placeholder Scan

No TBD/TODO/fill-in-later patterns found.

### Type Consistency

- `WasmSchemaResult`, `WasmRow`, `WasmColumnDef` defined in `types/wasm.ts` (Task 5) and used consistently in Tasks 7, 8, 9, 10
- `WorkerApi` exported from `jsonl.worker.ts` and imported in `use-jsonl-worker.ts`
- `FileInfo` interface defined in `use-jsonl-worker.ts` and used in `index.tsx`
- `DataTable` prop interface matches the data provided by `index.tsx`
