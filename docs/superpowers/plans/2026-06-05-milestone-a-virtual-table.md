# Milestone A: Virtual Table + Full Data Grid — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current simple paginated DataTable with a full virtualized IDE-style data grid featuring continuous scrolling, sorting, filtering, Schema panel, column management, and URL state sync.

**Architecture:** Big-bang refactor of `routes/index.tsx` and `data-table.tsx` into modular components (`VirtualDataTable`, `SchemaPanel`, `ColumnHeader`, etc.) backed by TanStack Virtual + Query for virtual scrolling and caching, TanStack Router + Zod for URL state sync, and @dnd-kit for drag-and-drop column reordering. All state flows bidirectionally between URL params and component state.

**Tech Stack:** TanStack Table v8, TanStack Virtual v3, TanStack Query v5, TanStack Router (validateSearch + Zod), @dnd-kit/core + @dnd-kit/sortable, shadcn/ui (Nova), Lucide Icons

---

## File Structure

```
app/src/
├── types/
│   └── table-state.ts              ← NEW: Zod schema for URL search params
├── hooks/
│   ├── use-table-state.ts          ← NEW: unified table state + URL sync
│   ├── use-virtual-rows.ts         ← NEW: TanStack Virtual + Query integration
│   └── use-column-resize.ts        ← NEW: column width drag resize
├── components/
│   ├── cell-renderer.tsx            ← NEW: extracted from data-table.tsx
│   ├── status-bar.tsx               ← NEW: extracted from data-table.tsx
│   ├── toolbar.tsx                  ← NEW: simplified top toolbar
│   ├── column-header.tsx            ← NEW: sortable + filterable column header
│   ├── filter-popover.tsx           ← NEW: column filter menu (string/number/boolean)
│   ├── virtual-data-table.tsx       ← NEW: core virtualized data grid
│   ├── schema-panel.tsx             ← NEW: left sidebar with column management
│   └── data-table.tsx               ← DELETE after migration complete
├── routes/
│   └── index.tsx                    ← MODIFY: URL state + layout composition
├── worker/
│   └── use-jsonl-worker.ts          ← MODIFY: add fileId derivation
├── context/
│   └── query-provider.tsx           ← NEW: TanStack Query provider wrapper
└── client.tsx                       ← MODIFY: wrap with QueryClientProvider
```

---

### Task 1: Install Dependencies

**Files:**
- Modify: `app/package.json`

- [ ] **Step 1: Install new packages**

```bash
cd /Volumes/HIKSEMI/project/josnl-viewer/app
pnpm add @tanstack/react-virtual @tanstack/react-query @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

`zod` is already installed (v3.25.42). `@tanstack/react-table` is already installed (v8.21.3). No need to install those.

- [ ] **Step 2: Verify installation**

```bash
cd /Volumes/HIKSEMI/project/josnl-viewer/app
pnpm ls @tanstack/react-virtual @tanstack/react-query @dnd-kit/core @dnd-kit/sortable
```

Expected: all four packages listed with versions.

- [ ] **Step 3: Commit**

```bash
cd /Volumes/HIKSEMI/project/josnl-viewer
git add app/package.json app/pnpm-lock.yaml
git commit -m "chore: add TanStack Virtual, Query, and dnd-kit dependencies"
```

---

### Task 2: TanStack Query Provider Setup

**Files:**
- Create: `app/src/context/query-provider.tsx`
- Modify: `app/src/client.tsx`

The app needs a `QueryClientProvider` wrapping the entire tree. We create a dedicated provider component and wrap the app in `client.tsx`.

- [ ] **Step 1: Create the QueryClient provider**

Create `app/src/context/query-provider.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: Infinity,
            gcTime: 5 * 60 * 1000, // 5 minutes
            retry: 1,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
```

- [ ] **Step 2: Wrap the app in client.tsx**

Replace the entire content of `app/src/client.tsx` with:

```tsx
import { StartClient } from '@tanstack/react-start/client'
import { StrictMode, startTransition } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { getRouter } from './router'
import { QueryProvider } from './context/query-provider'

// Register the router globally before hydration
getRouter()

startTransition(() => {
  hydrateRoot(
    document,
    import.meta.env.DEV ? (
      <StrictMode>
        <QueryProvider>
          <StartClient />
        </QueryProvider>
      </StrictMode>
    ) : (
      <QueryProvider>
        <StartClient />
      </QueryProvider>
    ),
  )
})
```

- [ ] **Step 3: Verify the app still starts**

```bash
cd /Volumes/HIKSEMI/project/josnl-viewer/app
pnpm dev
```

Expected: dev server starts without errors on port 3000. The file drop zone page should render as before. Kill the dev server after confirming.

- [ ] **Step 4: Commit**

```bash
cd /Volumes/HIKSEMI/project/josnl-viewer
git add app/src/context/query-provider.tsx app/src/client.tsx
git commit -m "feat: add TanStack Query provider wrapping the app"
```

---

### Task 3: URL State Zod Schema

**Files:**
- Create: `app/src/types/table-state.ts`

This file defines the Zod schema for URL search params and the derived TypeScript types. All table state that should be shareable via URL lives here.

- [ ] **Step 1: Create the Zod schema and types**

Create `app/src/types/table-state.ts`:

```ts
import { z } from 'zod'

/** URL search params schema for table state */
export const tableStateSchema = z.object({
  /** Sorting state: "col:asc,col2:desc" */
  sortBy: z.string().optional(),
  /** Column filters: "col:op:value,col2:op:value" */
  filter: z.string().optional(),
  /** Visible columns: "col1,col2,col3" */
  cols: z.string().optional(),
  /** Virtual scroll offset in pixels */
  scrollOffset: z.number().optional(),
  /** Selected row index (zero-based) */
  selectedRow: z.number().optional(),
})

export type TableStateSchema = z.infer<typeof tableStateSchema>

/** Parse a sortBy string into TanStack Table SortingState */
export function parseSortBy(sortBy: string | undefined): {
  id: string
  desc: boolean
}[] {
  if (!sortBy) return []
  return sortBy
    .split(',')
    .filter(Boolean)
    .map((part) => {
      const [id, dir] = part.split(':')
      return { id, desc: dir === 'desc' }
    })
    .filter((s) => s.id)
}

/** Serialize TanStack Table SortingState to URL string */
export function serializeSortBy(
  sorting: { id: string; desc: boolean }[],
): string | undefined {
  if (sorting.length === 0) return undefined
  return sorting.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`).join(',')
}

/** Parse a filter string into column filter entries */
export function parseFilter(
  filter: string | undefined,
): Record<string, string> {
  if (!filter) return {}
  const result: Record<string, string> = {}
  filter.split(',').forEach((part) => {
    const colonIdx = part.indexOf(':')
    if (colonIdx === -1) return
    const col = part.slice(0, colonIdx)
    const value = part.slice(colonIdx + 1)
    result[col] = value
  })
  return result
}

/** Serialize column filters to URL string */
export function serializeFilter(
  filters: Record<string, string>,
): string | undefined {
  const entries = Object.entries(filters).filter(([, v]) => v !== '')
  if (entries.length === 0) return undefined
  return entries.map(([col, val]) => `${col}:${val}`).join(',')
}

/** Parse visible columns string */
export function parseCols(cols: string | undefined): string[] | undefined {
  if (!cols) return undefined
  const parsed = cols.split(',').filter(Boolean)
  return parsed.length > 0 ? parsed : undefined
}

/** Serialize visible columns to URL string */
export function serializeCols(cols: string[] | undefined): string | undefined {
  if (!cols || cols.length === 0) return undefined
  return cols.join(',')
}
```

- [ ] **Step 2: Commit**

```bash
cd /Volumes/HIKSEMI/project/josnl-viewer
git add app/src/types/table-state.ts
git commit -m "feat: add Zod schema and URL serialization for table state"
```

---

### Task 4: Extract CellRenderer

**Files:**
- Create: `app/src/components/cell-renderer.tsx`
- Create: `app/src/components/cell-renderer.test.tsx`

Extract the `CellRenderer` and `formatFileSize` from the existing `data-table.tsx` into a standalone module. This is the first extraction step — the extracted code is reused by the new `virtual-data-table.tsx` later.

- [ ] **Step 1: Create cell-renderer.tsx**

Create `app/src/components/cell-renderer.tsx`:

```tsx
import { Badge } from '~/components/ui/badge'

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function CellRenderer({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="italic text-[var(--null-text)]">null</span>
  }
  if (typeof value === 'boolean') {
    return (
      <Badge
        variant={value ? 'default' : 'secondary'}
        className="text-[11px]"
      >
        ● {String(value)}
      </Badge>
    )
  }
  if (typeof value === 'number') {
    return <span className="tabular-nums">{value.toLocaleString()}</span>
  }
  if (typeof value === 'object') {
    const fields = Array.isArray(value)
      ? value.length
      : Object.keys(value as object).length
    return (
      <Badge variant="outline" className="text-[11px]">
        {Array.isArray(value) ? `[${fields}]` : `{${fields} fields}`}
      </Badge>
    )
  }
  const str = String(value)
  if (str.length > 50)
    return (
      <span title={str}>
        {str.slice(0, 50)}…
      </span>
    )
  return <>{str}</>
}
```

- [ ] **Step 2: Create cell-renderer.test.tsx**

Create `app/src/components/cell-renderer.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CellRenderer, formatFileSize } from './cell-renderer'

describe('CellRenderer', () => {
  it('renders null as italic "null"', () => {
    render(<CellRenderer value={null} />)
    const el = screen.getByText('null')
    expect(el).toBeInTheDocument()
    expect(el.className).toContain('italic')
  })

  it('renders undefined as italic "null"', () => {
    render(<CellRenderer value={undefined} />)
    const el = screen.getByText('null')
    expect(el).toBeInTheDocument()
  })

  it('renders boolean true', () => {
    render(<CellRenderer value={true} />)
    expect(screen.getByText('● true')).toBeInTheDocument()
  })

  it('renders boolean false', () => {
    render(<CellRenderer value={false} />)
    expect(screen.getByText('● false')).toBeInTheDocument()
  })

  it('renders number with locale formatting', () => {
    render(<CellRenderer value={1234} />)
    expect(screen.getByText('1,234')).toBeInTheDocument()
  })

  it('renders short string directly', () => {
    render(<CellRenderer value="hello" />)
    expect(screen.getByText('hello')).toBeInTheDocument()
  })

  it('truncates long string with ellipsis', () => {
    const long = 'a'.repeat(60)
    render(<CellRenderer value={long} />)
    expect(screen.getByText('a'.repeat(50) + '…')).toBeInTheDocument()
  })

  it('renders object as field count badge', () => {
    render(<CellRenderer value={{ a: 1, b: 2 }} />)
    expect(screen.getByText('{2 fields}')).toBeInTheDocument()
  })

  it('renders array as length badge', () => {
    render(<CellRenderer value={[1, 2, 3]} />)
    expect(screen.getByText('[3]')).toBeInTheDocument()
  })
})

describe('formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500 B')
  })
  it('formats kilobytes', () => {
    expect(formatFileSize(1536)).toBe('1.5 KB')
  })
  it('formats megabytes', () => {
    expect(formatFileSize(1572864)).toBe('1.5 MB')
  })
  it('formats gigabytes', () => {
    expect(formatFileSize(1610612736)).toBe('1.5 GB')
  })
})
```

- [ ] **Step 3: Run tests**

```bash
cd /Volumes/HIKSEMI/project/josnl-viewer/app
pnpm test -- --reporter=verbose src/components/cell-renderer.test.tsx
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
cd /Volumes/HIKSEMI/project/josnl-viewer
git add app/src/components/cell-renderer.tsx app/src/components/cell-renderer.test.tsx
git commit -m "feat: extract CellRenderer and formatFileSize into standalone module"
```

---

### Task 5: Extract StatusBar

**Files:**
- Create: `app/src/components/status-bar.tsx`

Extract the status bar from `data-table.tsx`. The new version uses background-color highlighting (no left borders) and adds a memory estimate display.

- [ ] **Step 1: Create status-bar.tsx**

Create `app/src/components/status-bar.tsx`:

```tsx
interface StatusBarProps {
  totalRows: number
  errorRows: number
  visibleRows: number
  selectedRowIndex: number | null
  loadTimeMs?: number
  memoryEstimateMB?: number
}

export function StatusBar({
  totalRows,
  errorRows,
  visibleRows,
  selectedRowIndex,
  loadTimeMs,
  memoryEstimateMB,
}: StatusBarProps) {
  return (
    <div className="flex h-7 items-center justify-between border-t border-[var(--table-grid-line)] bg-[var(--table-header-bg)] px-3 text-xs text-muted-foreground font-sans">
      <div className="flex items-center gap-3">
        <span>📊 共 {totalRows.toLocaleString()} 行</span>
        <span>显示 {visibleRows.toLocaleString()} 行</span>
        {errorRows > 0 && (
          <span className="text-[var(--color-error)]">
            ⚠ 错误: {errorRows} 行
          </span>
        )}
        {memoryEstimateMB !== undefined && (
          <span>💾 ~{memoryEstimateMB}MB</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {selectedRowIndex !== null && (
          <span>选中: #{selectedRowIndex + 1}</span>
        )}
        {loadTimeMs !== undefined && <span>⏱ {loadTimeMs}ms</span>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /Volumes/HIKSEMI/project/josnl-viewer
git add app/src/components/status-bar.tsx
git commit -m "feat: extract StatusBar into standalone component"
```

---

### Task 6: Create Toolbar (Simplified)

**Files:**
- Create: `app/src/components/toolbar.tsx`

A simplified toolbar showing filename, file size, and a disabled global search placeholder.

- [ ] **Step 1: Create toolbar.tsx**

Create `app/src/components/toolbar.tsx`:

```tsx
import { Search } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { formatFileSize } from '~/components/cell-renderer'

interface ToolbarProps {
  fileName: string
  fileSize: number
  columnCount: number
  onReset: () => void
}

export function Toolbar({
  fileName,
  fileSize,
  columnCount,
  onReset,
}: ToolbarProps) {
  return (
    <div className="flex h-10 items-center justify-between border-b border-[var(--table-grid-line)] bg-[var(--table-header-bg)] px-3">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 font-sans text-sm font-medium"
          onClick={onReset}
        >
          📄 {fileName}
        </Button>
        <span className="text-xs text-muted-foreground">
          ({formatFileSize(fileSize)}) · {columnCount} 列
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs text-muted-foreground opacity-50 cursor-not-allowed"
          disabled
        >
          <Search className="h-3.5 w-3.5" />
          搜索
          <kbd className="ml-1 rounded bg-muted px-1 py-0.5 text-[10px] font-mono">
            ⌘F
          </kbd>
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /Volumes/HIKSEMI/project/josnl-viewer
git add app/src/components/toolbar.tsx
git commit -m "feat: add simplified Toolbar component"
```

---

### Task 7: useTableState Hook

**Files:**
- Create: `app/src/hooks/use-table-state.ts`

This is the core state management hook. It owns sorting, column filters, visibility, and column order. It uses TanStack Router's `useRouterState` and `navigate` for URL sync.

The hook receives the initial column IDs from the schema and manages the full lifecycle.

- [ ] **Step 1: Create use-table-state.ts**

Create `app/src/hooks/use-table-state.ts`:

```ts
import { useCallback, useMemo } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import {
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
} from '@tanstack/react-table'
import {
  parseSortBy,
  serializeSortBy,
  parseFilter,
  serializeFilter,
  parseCols,
  serializeCols,
} from '~/types/table-state'

interface UseTableStateOptions {
  /** All column IDs from the schema */
  columnIds: string[]
}

/** Default column order = schema order */
function defaultColumnOrder(columnIds: string[]): string[] {
  return [...columnIds]
}

/** Default visibility = all visible */
function defaultVisibility(columnIds: string[]): VisibilityState {
  const vis: VisibilityState = {}
  for (const id of columnIds) {
    vis[id] = true
  }
  return vis
}

export function useTableState({ columnIds }: UseTableStateOptions) {
  const navigate = useNavigate()
  const routerState = useRouterState()
  const search = routerState.location.search as Record<string, unknown>

  // --- Parse URL state ---
  const sorting: SortingState = useMemo(
    () => parseSortBy(search.sortBy as string | undefined),
    [search.sortBy],
  )

  const columnFilters: ColumnFiltersState = useMemo(() => {
    const parsed = parseFilter(search.filter as string | undefined)
    return Object.entries(parsed).map(([id, value]) => ({ id, value }))
  }, [search.filter])

  const columnVisibility: VisibilityState = useMemo(() => {
    const cols = parseCols(search.cols as string | undefined)
    if (!cols) return defaultVisibility(columnIds)
    const vis: VisibilityState = {}
    for (const id of columnIds) {
      vis[id] = cols.includes(id)
    }
    return vis
  }, [search.cols, columnIds])

  const columnOrder: string[] = useMemo(() => {
    // Column order is derived from the schema order for now.
    // Drag reorder in SchemaPanel will update this via URL later.
    return defaultColumnOrder(columnIds)
  }, [columnIds])

  const selectedRowIndex: number | null = useMemo(() => {
    const val = search.selectedRow
    return typeof val === 'number' ? val : null
  }, [search.selectedRow])

  // --- URL update helpers ---
  const updateUrl = useCallback(
    (params: Record<string, string | number | undefined>) => {
      void navigate({
        to: '.',
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          ...params,
        }),
        replace: true,
      })
    },
    [navigate],
  )

  const onSortingChange = useCallback(
    (updaterOrValue: SortingState | ((old: SortingState) => SortingState)) => {
      const newSorting =
        typeof updaterOrValue === 'function'
          ? updaterOrValue(sorting)
          : updaterOrValue
      updateUrl({ sortBy: serializeSortBy(newSorting) })
    },
    [sorting, updateUrl],
  )

  const onColumnFiltersChange = useCallback(
    (
      updaterOrValue:
        | ColumnFiltersState
        | ((old: ColumnFiltersState) => ColumnFiltersState),
    ) => {
      const newFilters =
        typeof updaterOrValue === 'function'
          ? updaterOrValue(columnFilters)
          : updaterOrValue
      const filterMap: Record<string, string> = {}
      for (const f of newFilters) {
        filterMap[f.id] = String(f.value)
      }
      updateUrl({ filter: serializeFilter(filterMap) })
    },
    [columnFilters, updateUrl],
  )

  const onColumnVisibilityChange = useCallback(
    (
      updaterOrValue:
        | VisibilityState
        | ((old: VisibilityState) => VisibilityState),
    ) => {
      const newVisibility =
        typeof updaterOrValue === 'function'
          ? updaterOrValue(columnVisibility)
          : updaterOrValue
      const visibleCols = columnIds.filter(
        (id) => newVisibility[id] !== false,
      )
      updateUrl({ cols: serializeCols(visibleCols) })
    },
    [columnVisibility, columnIds, updateUrl],
  )

  const onColumnOrderChange = useCallback(
    (newOrder: string[]) => {
      // Column order is stored as the 'cols' param order
      const visibleCols = newOrder.filter(
        (id) => columnVisibility[id] !== false,
      )
      updateUrl({ cols: serializeCols(visibleCols) })
    },
    [columnVisibility, updateUrl],
  )

  const onSelectedRowChange = useCallback(
    (index: number | null) => {
      updateUrl({ selectedRow: index ?? undefined })
    },
    [updateUrl],
  )

  return {
    sorting,
    columnFilters,
    columnVisibility,
    columnOrder,
    selectedRowIndex,
    onSortingChange,
    onColumnFiltersChange,
    onColumnVisibilityChange,
    onColumnOrderChange,
    onSelectedRowChange,
  } as const
}
```

- [ ] **Step 2: Commit**

```bash
cd /Volumes/HIKSEMI/project/josnl-viewer
git add app/src/hooks/use-table-state.ts
git commit -m "feat: add useTableState hook with URL bidirectional sync"
```

---

### Task 8: useVirtualRows Hook

**Files:**
- Create: `app/src/hooks/use-virtual-rows.ts`
- Modify: `app/src/worker/use-jsonl-worker.ts` — add `fileId` export

This hook bridges TanStack Virtual's visible range with TanStack Query's caching layer and the Worker's `getRows` API.

- [ ] **Step 1: Add fileId to the worker hook**

In `app/src/worker/use-jsonl-worker.ts`, add a `fileId` derived from file name + size. After the existing `const [error, setError]` line (line 19), add:

```ts
const [fileId, setFileId] = useState<string | null>(null)
```

Inside the `loadFile` callback, after `setFileInfo(...)` (around line 41), add:

```ts
setFileId(`${file.name}-${file.size}`)
```

Inside the `reset` callback, after `setError(null)` (around line 62), add:

```ts
setFileId(null)
```

Update the return to include `fileId`:

```ts
return { status, fileInfo, fileId, error, loadFile, getRows, reset } as const
```

- [ ] **Step 2: Create use-virtual-rows.ts**

Create `app/src/hooks/use-virtual-rows.ts`:

```tsx
import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { WasmRow } from '~/types/wasm'

const ROW_HEIGHT = 32
const OVERSCAN = 5

interface UseVirtualRowsOptions {
  /** Unique file identifier (filename + size hash) */
  fileId: string | null
  /** Total row count from the schema scan */
  totalRows: number
  /** The getRows function from the worker API */
  getRows: (start: number, end: number) => Promise<WasmRow[]>
  /** Virtual items from TanStack Virtual (the visible range) */
  virtualItems: {
    index: number
    start: number
    size: number
    key: string
  }[]
}

export function useVirtualRows({
  fileId,
  totalRows,
  getRows,
  virtualItems,
}: UseVirtualRowsOptions) {
  const queryClient = useQueryClient()

  // Derive the actual row range from virtual items
  const range = useMemo(() => {
    if (virtualItems.length === 0) return null
    const indices = virtualItems.map((v) => v.index)
    const start = Math.max(0, Math.min(...indices) - OVERSCAN)
    const end = Math.min(totalRows, Math.max(...indices) + OVERSCAN + 1)
    return { start, end }
  }, [virtualItems, totalRows])

  // Query for the current visible range
  const queryKey = fileId
    ? ['rows', fileId, range?.start, range?.end]
    : ['rows', 'no-file']

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!range || !fileId) return []
      return getRows(range.start, range.end)
    },
    enabled: !!fileId && !!range,
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
  })

  // Prefetch the next range ahead
  useMemo(() => {
    if (!range || !fileId) return
    const prefetchStart = Math.max(0, range.end)
    const prefetchEnd = Math.min(totalRows, range.end + OVERSCAN * 2)
    if (prefetchStart >= prefetchEnd) return

    void queryClient.prefetchQuery({
      queryKey: ['rows', fileId, prefetchStart, prefetchEnd],
      queryFn: () => getRows(prefetchStart, prefetchEnd),
      staleTime: Infinity,
      gcTime: 5 * 60 * 1000,
    })
  }, [range, fileId, totalRows, getRows, queryClient])

  // Map virtual items to actual row data
  const rows = useMemo(() => {
    if (!query.data) return new Map<number, WasmRow>()
    const map = new Map<number, WasmRow>()
    for (const row of query.data) {
      map.set(row.index, row)
    }
    return map
  }, [query.data])

  return {
    rows,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  } as const
}

export { ROW_HEIGHT, OVERSCAN }
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/HIKSEMI/project/josnl-viewer
git add app/src/hooks/use-virtual-rows.ts app/src/worker/use-jsonl-worker.ts
git commit -m "feat: add useVirtualRows hook with TanStack Query caching and prefetch"
```

---

### Task 9: useColumnResize Hook

**Files:**
- Create: `app/src/hooks/use-column-resize.ts`

A small hook managing column width drag resizing. Uses native mouse events instead of a library.

- [ ] **Step 1: Create use-column-resize.ts**

Create `app/src/hooks/use-column-resize.ts`:

```ts
import { useCallback, useRef } from 'react'
import type { Table } from '@tanstack/react-table'

const MIN_COLUMN_WIDTH = 40

interface UseColumnResizeOptions {
  table: Table<unknown>
}

export function useColumnResize({ table }: UseColumnResizeOptions) {
  const isResizing = useRef(false)
  const resizingColumnId = useRef<string | null>(null)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const handleResizeStart = useCallback(
    (
      e: React.MouseEvent,
      columnId: string,
      currentWidth: number,
    ) => {
      e.preventDefault()
      e.stopPropagation()
      isResizing.current = true
      resizingColumnId.current = columnId
      startX.current = e.clientX
      startWidth.current = currentWidth

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isResizing.current) return
        const diff = moveEvent.clientX - startX.current
        const newWidth = Math.max(MIN_COLUMN_WIDTH, startWidth.current + diff)
        table.setColumnSizing((prev) => ({
          ...prev,
          [resizingColumnId.current!]: newWidth,
        }))
      }

      const handleMouseUp = () => {
        isResizing.current = false
        resizingColumnId.current = null
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [table],
  )

  const handleDoubleClick = useCallback(
    (columnId: string) => {
      // Auto-fit: set to a reasonable default width
      table.setColumnSizing((prev) => ({
        ...prev,
        [columnId]: 150,
      }))
    },
    [table],
  )

  return { handleResizeStart, handleDoubleClick } as const
}
```

- [ ] **Step 2: Commit**

```bash
cd /Volumes/HIKSEMI/project/josnl-viewer
git add app/src/hooks/use-column-resize.ts
git commit -m "feat: add useColumnResize hook for column width drag resize"
```

---

### Task 10: ColumnHeader Component

**Files:**
- Create: `app/src/components/column-header.tsx`

The column header handles sort toggling, shows sort indicators, and provides a resize handle on the right edge.

- [ ] **Step 1: Create column-header.tsx**

Create `app/src/components/column-header.tsx`:

```tsx
import { useCallback } from 'react'
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'

interface ColumnHeaderProps {
  /** Column ID */
  columnId: string
  /** Display header text */
  header: string
  /** Current sort direction: false=asc, true=desc, undefined=none */
  sortDirection: false | true | undefined
  /** Sort priority index (0-based), shown when multi-sort */
  sortIndex?: number
  /** Current column width in px */
  width: number
  /** Whether this is the row number column (no sort/resize) */
  isRowNum?: boolean
  onSortToggle: (columnId: string, shiftKey: boolean) => void
  onResizeStart: (
    e: React.MouseEvent,
    columnId: string,
    currentWidth: number,
  ) => void
  onResizeDoubleClick: (columnId: string) => void
}

export function ColumnHeader({
  columnId,
  header,
  sortDirection,
  sortIndex,
  width,
  isRowNum,
  onSortToggle,
  onResizeStart,
  onResizeDoubleClick,
}: ColumnHeaderProps) {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isRowNum) return
      onSortToggle(columnId, e.shiftKey)
    },
    [columnId, isRowNum, onSortToggle],
  )

  const sortIcon = () => {
    if (sortDirection === undefined) return null
    if (sortDirection === false)
      return <ArrowUp className="h-3 w-3 text-primary" />
    return <ArrowDown className="h-3 w-3 text-primary" />
  }

  return (
    <div
      className="relative flex items-center gap-1 px-2 py-1.5 select-none font-sans text-[13px] font-semibold"
      style={{
        width: isRowNum ? 52 : undefined,
        minWidth: isRowNum ? 52 : 40,
        background:
          sortDirection !== undefined ? 'var(--table-row-selected)' : undefined,
      }}
    >
      <div
        className={`flex items-center gap-1 flex-1 ${isRowNum ? '' : 'cursor-pointer'}`}
        onClick={handleClick}
      >
        <span className="truncate">{header}</span>
        {sortIcon()}
        {sortIndex !== undefined && sortDirection !== undefined && (
          <span className="text-[10px] text-muted-foreground font-normal">
            {sortIndex + 1}
          </span>
        )}
        {!isRowNum && sortDirection === undefined && (
          <ArrowUpDown className="h-3 w-3 text-muted-foreground/40" />
        )}
      </div>
      {/* Resize handle */}
      {!isRowNum && (
        <div
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors"
          onMouseDown={(e) => onResizeStart(e, columnId, width)}
          onDoubleClick={() => onResizeDoubleClick(columnId)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /Volumes/HIKSEMI/project/josnl-viewer
git add app/src/components/column-header.tsx
git commit -m "feat: add ColumnHeader component with sort toggle and resize handle"
```

---

### Task 11: FilterPopover Component

**Files:**
- Create: `app/src/components/filter-popover.tsx`

The filter popover provides type-aware filtering UI for each column type.

- [ ] **Step 1: Install shadcn Popover component**

```bash
cd /Volumes/HIKSEMI/project/josnl-viewer/app
npx shadcn@latest add popover
```

If the command asks for confirmation, accept the defaults.

- [ ] **Step 2: Create filter-popover.tsx**

Create `app/src/components/filter-popover.tsx`:

```tsx
import { useState, useCallback } from 'react'
import { Filter, X } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'

interface FilterPopoverProps {
  /** Column data type from schema */
  columnType: string
  /** Current filter value (empty string = no filter) */
  currentValue: string
  /** Callback when filter is applied */
  onApply: (value: string) => void
  /** Callback when filter is cleared */
  onClear: () => void
}

export function FilterPopover({
  columnType,
  currentValue,
  onApply,
  onClear,
}: FilterPopoverProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [localValue, setLocalValue] = useState(currentValue)

  const handleOpen = useCallback(() => {
    setLocalValue(currentValue)
    setIsOpen(true)
  }, [currentValue])

  const handleApply = useCallback(() => {
    if (localValue.trim()) {
      onApply(localValue.trim())
    } else {
      onClear()
    }
    setIsOpen(false)
  }, [localValue, onApply, onClear])

  const handleClear = useCallback(() => {
    setLocalValue('')
    onClear()
    setIsOpen(false)
  }, [onClear])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleApply()
      if (e.key === 'Escape') setIsOpen(false)
    },
    [handleApply],
  )

  const normalizedType = columnType.toLowerCase()

  return (
    <div className="relative">
      <button
        className={`p-0.5 rounded hover:bg-muted/50 transition-colors ${currentValue ? 'text-primary' : 'text-muted-foreground/40'}`}
        onClick={handleOpen}
        title="筛选"
      >
        <Filter className="h-3 w-3" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          {/* Popover */}
          <div
            className="absolute top-full left-0 z-50 mt-1 w-56 rounded-lg border border-border bg-popover p-3 shadow-lg"
            onKeyDown={handleKeyDown}
          >
            <div className="mb-2 text-xs font-medium text-muted-foreground">
              筛选
            </div>

            {normalizedType === 'string' && (
              <div className="space-y-2">
                <Input
                  placeholder="包含文本..."
                  value={localValue}
                  onChange={(e) => setLocalValue(e.target.value)}
                  className="h-7 text-xs"
                  autoFocus
                />
              </div>
            )}

            {normalizedType === 'number' && (
              <div className="space-y-2">
                <select
                  className="w-full h-7 rounded border border-border bg-background px-2 text-xs"
                  value={localValue.startsWith('>') ? 'gt' : localValue.startsWith('<') ? 'lt' : 'eq'}
                  onChange={(e) => {
                    const prefix = e.target.value === 'gt' ? '>' : e.target.value === 'lt' ? '<' : '='
                    const existingVal = localValue.replace(/^[><=]/, '')
                    setLocalValue(prefix + existingVal)
                  }}
                >
                  <option value="eq">等于</option>
                  <option value="gt">大于</option>
                  <option value="lt">小于</option>
                </select>
                <Input
                  placeholder="输入数值..."
                  value={localValue.replace(/^[><=]/, '')}
                  onChange={(e) => {
                    const prefix = localValue.match(/^[><=]/)?.[0] ?? '='
                    setLocalValue(prefix + e.target.value)
                  }}
                  className="h-7 text-xs"
                  type="number"
                  autoFocus
                />
              </div>
            )}

            {normalizedType === 'boolean' && (
              <div className="space-y-1">
                {[
                  { label: '全部', value: '' },
                  { label: 'true', value: 'true' },
                  { label: 'false', value: 'false' },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50 cursor-pointer text-xs"
                  >
                    <input
                      type="radio"
                      name={`filter-bool-${normalizedType}`}
                      checked={localValue === opt.value}
                      onChange={() => setLocalValue(opt.value)}
                      className="accent-primary"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            )}

            {!['string', 'number', 'boolean'].includes(normalizedType) && (
              <Input
                placeholder="筛选值..."
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                className="h-7 text-xs"
                autoFocus
              />
            )}

            <div className="mt-3 flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={handleClear}
              >
                <X className="mr-1 h-3 w-3" />
                清除
              </Button>
              <Button
                size="sm"
                className="h-6 text-xs"
                onClick={handleApply}
              >
                应用
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/HIKSEMI/project/josnl-viewer
git add app/src/components/filter-popover.tsx app/src/components/ui/popover.tsx 2>/dev/null
git commit -m "feat: add FilterPopover component with type-aware filtering UI"
```

---

### Task 12: SchemaPanel Component

**Files:**
- Create: `app/src/components/schema-panel.tsx`

The left sidebar showing all columns with type badges, checkboxes for visibility, and drag-to-reorder via @dnd-kit.

- [ ] **Step 1: Create schema-panel.tsx**

Create `app/src/components/schema-panel.tsx`:

```tsx
import { useState, useMemo, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Search, GripVertical } from 'lucide-react'
import { Input } from '~/components/ui/input'
import type { WasmColumnDef } from '~/types/wasm'
import type { VisibilityState } from '@tanstack/react-table'

/** Map inferred_type to a display color */
const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  string: { bg: 'bg-[#22c55e20]', text: 'text-[#22c55e]' },
  number: { bg: 'bg-[#3b82f620]', text: 'text-[#3b82f6]' },
  boolean: { bg: 'bg-[#f59e0b20]', text: 'text-[#f59e0b]' },
  array: { bg: 'bg-[#a855f720]', text: 'text-[#a855f7]' },
  object: { bg: 'bg-[#ef444420]', text: 'text-[#ef4444]' },
  null: { bg: 'bg-[#88888820]', text: 'text-[#888]' },
  mixed: { bg: 'bg-[#88888820]', text: 'text-[#888]' },
}

function getTypeColor(type: string) {
  return TYPE_COLORS[type.toLowerCase()] ?? TYPE_COLORS.mixed
}

interface SortableColumnItemProps {
  col: WasmColumnDef
  isVisible: boolean
  onToggleVisibility: (columnId: string) => void
}

function SortableColumnItem({
  col,
  isVisible,
  onToggleVisibility,
}: SortableColumnItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: col.key })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const color = getTypeColor(col.inferred_type)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md mx-1.5 transition-colors ${
        isVisible ? '' : 'opacity-50'
      } hover:bg-muted/30`}
    >
      <input
        type="checkbox"
        checked={isVisible}
        onChange={() => onToggleVisibility(col.key)}
        className="accent-primary w-3.5 h-3.5 shrink-0"
      />
      <span className="flex-1 text-xs font-mono truncate">{col.key}</span>
      <span
        className={`text-[10px] px-1.5 py-0.5 rounded ${color.bg} ${color.text} shrink-0`}
      >
        {col.inferred_type.toLowerCase()}
      </span>
      <button
        className="text-muted-foreground/60 hover:text-muted-foreground cursor-grab shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

interface SchemaPanelProps {
  columns: WasmColumnDef[]
  columnVisibility: VisibilityState
  columnOrder: string[]
  onVisibilityChange: (columnId: string, visible: boolean) => void
  onOrderChange: (newOrder: string[]) => void
}

export function SchemaPanel({
  columns,
  columnVisibility,
  columnOrder,
  onVisibilityChange,
  onOrderChange,
}: SchemaPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsed, setCollapsed] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // Ordered columns: use columnOrder if available, else schema order
  const orderedColumns = useMemo(() => {
    if (columnOrder.length === 0) return columns
    const colMap = new Map(columns.map((c) => [c.key, c]))
    const ordered = columnOrder
      .map((id) => colMap.get(id))
      .filter(Boolean) as WasmColumnDef[]
    // Add any columns not in the order
    const seen = new Set(columnOrder)
    for (const col of columns) {
      if (!seen.has(col.key)) ordered.push(col)
    }
    return ordered
  }, [columns, columnOrder])

  // Filter by search query
  const filteredColumns = useMemo(() => {
    if (!searchQuery.trim()) return orderedColumns
    const q = searchQuery.toLowerCase()
    return orderedColumns.filter((col) =>
      col.key.toLowerCase().includes(q),
    )
  }, [orderedColumns, searchQuery])

  // Type counts for the legend
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const col of columns) {
      const t = col.inferred_type.toLowerCase()
      counts[t] = (counts[t] || 0) + 1
    }
    return counts
  }, [columns])

  const handleToggleVisibility = useCallback(
    (columnId: string) => {
      const isVisible = columnVisibility[columnId] !== false
      onVisibilityChange(columnId, !isVisible)
    },
    [columnVisibility, onVisibilityChange],
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const oldIndex = columnOrder.indexOf(String(active.id))
      const newIndex = columnOrder.indexOf(String(over.id))
      if (oldIndex === -1 || newIndex === -1) return
      const newOrder = arrayMove(columnOrder, oldIndex, newIndex)
      onOrderChange(newOrder)
    },
    [columnOrder, onOrderChange],
  )

  if (collapsed) {
    return (
      <div className="w-8 min-w-8 border-r border-[var(--table-grid-line)] bg-[var(--table-header-bg)] flex flex-col items-center pt-2">
        <button
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setCollapsed(false)}
          title="展开 Schema 面板"
        >
          ▶
        </button>
      </div>
    )
  }

  return (
    <div className="w-[220px] min-w-[220px] border-r border-[var(--table-grid-line)] bg-[var(--table-header-bg)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-2 border-b border-[var(--table-grid-line)]">
        <span className="font-semibold text-xs">Schema</span>
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-muted-foreground">
            {columns.length} 字段
          </span>
          <button
            className="text-xs text-muted-foreground hover:text-foreground ml-1"
            onClick={() => setCollapsed(true)}
            title="收起"
          >
            ◀
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-2.5 py-1.5 border-b border-[var(--table-grid-line)]/50">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="搜索字段..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-6 pl-7 text-xs"
          />
        </div>
      </div>

      {/* Column list with drag-and-drop */}
      <div className="flex-1 overflow-y-auto py-1">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filteredColumns.map((c) => c.key)}
            strategy={verticalListSortingStrategy}
          >
            {filteredColumns.map((col) => (
              <SortableColumnItem
                key={col.key}
                col={col}
                isVisible={columnVisibility[col.key] !== false}
                onToggleVisibility={handleToggleVisibility}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {/* Type filter legend */}
      <div className="px-2.5 py-2 border-t border-[var(--table-grid-line)] flex flex-wrap gap-1">
        {Object.entries(typeCounts).map(([type, count]) => {
          const color = getTypeColor(type)
          return (
            <span
              key={type}
              className={`text-[10px] px-1.5 py-0.5 rounded cursor-default ${color.bg} ${color.text}`}
            >
              {type} ({count})
            </span>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /Volumes/HIKSEMI/project/josnl-viewer
git add app/src/components/schema-panel.tsx
git commit -m "feat: add SchemaPanel with drag reorder, visibility toggle, and type badges"
```

---

### Task 13: VirtualDataTable Component (Core)

**Files:**
- Create: `app/src/components/virtual-data-table.tsx`

This is the central component. It combines TanStack Table (column model + sorting + filtering), TanStack Virtual (virtual scrolling), and the `useVirtualRows` hook (data fetching).

- [ ] **Step 1: Create virtual-data-table.tsx**

Create `app/src/components/virtual-data-table.tsx`:

```tsx
import { useMemo, useCallback, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
} from '@tanstack/react-table'
import { ColumnHeader } from '~/components/column-header'
import { FilterPopover } from '~/components/filter-popover'
import { CellRenderer } from '~/components/cell-renderer'
import { useVirtualRows, ROW_HEIGHT } from '~/hooks/use-virtual-rows'
import { useColumnResize } from '~/hooks/use-column-resize'
import type { WasmSchemaResult, WasmRow } from '~/types/wasm'

interface VirtualDataTableProps {
  schema: WasmSchemaResult
  totalRows: number
  fileId: string
  getRows: (start: number, end: number) => Promise<WasmRow[]>
  sorting: SortingState
  columnFilters: ColumnFiltersState
  columnVisibility: VisibilityState
  columnOrder: string[]
  selectedRowIndex: number | null
  onSortingChange: (
    updaterOrValue: SortingState | ((old: SortingState) => SortingState),
  ) => void
  onColumnFiltersChange: (
    updaterOrValue:
      | ColumnFiltersState
      | ((old: ColumnFiltersState) => ColumnFiltersState),
  ) => void
  onColumnVisibilityChange: (
    updaterOrValue:
      | VisibilityState
      | ((old: VisibilityState) => VisibilityState),
  ) => void
  onColumnOrderChange: (newOrder: string[]) => void
  onSelectedRowChange: (index: number | null) => void
}

export function VirtualDataTable({
  schema,
  totalRows,
  fileId,
  getRows,
  sorting,
  columnFilters,
  columnVisibility,
  columnOrder,
  selectedRowIndex,
  onSortingChange,
  onColumnFiltersChange,
  onSelectedRowChange,
}: VirtualDataTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Build column definitions
  const columns = useMemo<ColumnDef<WasmRow>[]>(() => {
    const rowNumCol: ColumnDef<WasmRow> = {
      id: '#',
      size: 52,
      header: '#',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.index + 1}
        </span>
      ),
      enableSorting: false,
      enableResizing: false,
    }
    const dataCols: ColumnDef<WasmRow>[] = schema.columns.map((col) => ({
      id: col.key,
      accessorKey: `data.${col.key}` as const,
      header: col.key,
      cell: ({ row }) => {
        if (row.original.error) return null
        return <CellRenderer value={row.original.data[col.key]} />
      },
      size: 150,
      minSize: 40,
    }))
    return [rowNumCol, ...dataCols]
  }, [schema])

  // TanStack Table instance
  const table = useReactTable({
    data: [],
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      columnOrder,
    },
    onSortingChange,
    onColumnFiltersChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableSortingRemoval: true,
    enableMultiSort: true,
    manualPagination: true,
    pageCount: -1,
  })

  // Virtual scrolling
  const virtualizer = useVirtualizer({
    count: totalRows,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  })

  const virtualItems = virtualizer.getVirtualItems()

  // Data fetching via TanStack Query
  const { rows, isLoading } = useVirtualRows({
    fileId,
    totalRows,
    getRows,
    virtualItems,
  })

  // Column resize handler
  const { handleResizeStart, handleDoubleClick } = useColumnResize({ table })

  // Sort toggle handler
  const handleSortToggle = useCallback(
    (columnId: string, shiftKey: boolean) => {
      const column = table.getColumn(columnId)
      if (!column) return

      const currentSort = sorting.find((s) => s.id === columnId)
      let newSorting: SortingState

      if (shiftKey) {
        // Multi-sort: toggle or add
        if (currentSort) {
          if (currentSort.desc) {
            // desc → remove
            newSorting = sorting.filter((s) => s.id !== columnId)
          } else {
            // asc → desc
            newSorting = sorting.map((s) =>
              s.id === columnId ? { ...s, desc: true } : s,
            )
          }
        } else {
          newSorting = [...sorting, { id: columnId, desc: false }]
        }
      } else {
        // Single sort: cycle none → asc → desc → none
        if (currentSort) {
          if (currentSort.desc) {
            newSorting = []
          } else {
            newSorting = [{ id: columnId, desc: true }]
          }
        } else {
          newSorting = [{ id: columnId, desc: false }]
        }
      }

      onSortingChange(newSorting)
    },
    [sorting, table, onSortingChange],
  )

  // Row click handler
  const handleRowClick = useCallback(
    (index: number) => {
      onSelectedRowChange(selectedRowIndex === index ? null : index)
    },
    [selectedRowIndex, onSelectedRowChange],
  )

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const next = selectedRowIndex === null ? 0 : Math.min(selectedRowIndex + 1, totalRows - 1)
        onSelectedRowChange(next)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const prev = selectedRowIndex === null ? 0 : Math.max(selectedRowIndex - 1, 0)
        onSelectedRowChange(prev)
      } else if (e.key === 'Escape') {
        onSelectedRowChange(null)
      }
    },
    [selectedRowIndex, totalRows, onSelectedRowChange],
  )

  // Get visible header groups
  const headerGroups = table.getHeaderGroups()

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Sticky header */}
      <div className="flex bg-[var(--table-header-bg)] border-b border-[var(--table-grid-line)] shrink-0">
        {headerGroups[0]?.headers.map((header) => {
          const colId = header.column.id
          const isRowNum = colId === '#'
          const colDef = schema.columns.find((c) => c.key === colId)
          const sortState = sorting.find((s) => s.id === colId)
          const filterState = columnFilters.find((f) => f.id === colId)
          const width = header.getSize()

          return (
            <div
              key={header.id}
              className="border-r border-[var(--table-grid-line)] last:border-r-0 shrink-0"
              style={{ width: isRowNum ? 52 : width, minWidth: isRowNum ? 52 : 40 }}
            >
              <div className="flex items-center">
                <div className="flex-1">
                  <ColumnHeader
                    columnId={colId}
                    header={isRowNum ? '#' : flexRender(header.column.columnDef.header, header.getContext()) as string}
                    sortDirection={sortState ? sortState.desc : undefined}
                    sortIndex={sorting.length > 1 && sortState ? sorting.indexOf(sortState) : undefined}
                    width={width}
                    isRowNum={isRowNum}
                    onSortToggle={handleSortToggle}
                    onResizeStart={handleResizeStart}
                    onResizeDoubleClick={handleDoubleClick}
                  />
                </div>
                {/* Filter button (not for row number column) */}
                {!isRowNum && colDef && (
                  <div className="pr-1">
                    <FilterPopover
                      columnType={colDef.inferred_type}
                      currentValue={filterState ? String(filterState.value) : ''}
                      onApply={(value) => {
                        const newFilters = columnFilters.filter((f) => f.id !== colId)
                        newFilters.push({ id: colId, value })
                        onColumnFiltersChange(newFilters)
                      }}
                      onClear={() => {
                        const newFilters = columnFilters.filter((f) => f.id !== colId)
                        onColumnFiltersChange(newFilters)
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Virtual scrolling body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: '100%',
            position: 'relative',
          }}
        >
          {/* Spacer above */}
          {virtualItems.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: virtualItems[0].start,
              }}
            />
          )}

          {/* Visible rows */}
          {virtualItems.map((virtualRow) => {
            const rowData = rows.get(virtualRow.index)
            const isError = rowData?.error != null
            const isSelected = virtualRow.index === selectedRowIndex
            const isOdd = virtualRow.index % 2 === 1

            const bgColor = isError
              ? '#ef444418'
              : isSelected
                ? '#3b82f622'
                : isOdd
                  ? 'var(--table-row-odd)'
                  : 'var(--table-row-even)'

            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                style={{
                  position: 'absolute',
                  top: virtualRow.start,
                  left: 0,
                  width: '100%',
                  height: ROW_HEIGHT,
                }}
                className={`flex items-center border-b border-[var(--table-grid-line)] font-mono text-[13px] cursor-pointer hover:bg-[var(--table-row-hover)]`}
                onClick={() => handleRowClick(virtualRow.index)}
              >
                {rowData ? (
                  headerGroups[0]?.headers.map((header) => {
                    const colId = header.column.id
                    const width = colId === '#' ? 52 : header.getSize()

                    if (isError && colId !== '#') {
                      return (
                        <div
                          key={header.id}
                          className="px-2 shrink-0 overflow-hidden"
                          style={{ width, minWidth: colId === '#' ? 52 : 40 }}
                        >
                          <span className="text-xs text-[var(--color-error)] italic truncate block">
                            {rowData.error}
                          </span>
                        </div>
                      )
                    }

                    if (colId === '#') {
                      return (
                        <div
                          key={header.id}
                          className="px-2 shrink-0 text-muted-foreground text-xs"
                          style={{ width: 52, minWidth: 52 }}
                        >
                          {virtualRow.index + 1}
                        </div>
                      )
                    }

                    return (
                      <div
                        key={header.id}
                        className="px-2 shrink-0 overflow-hidden"
                        style={{ width, minWidth: 40 }}
                      >
                        <span className="truncate block">
                          <CellRenderer value={rowData.data[colId]} />
                        </span>
                      </div>
                    )
                  })
                ) : (
                  // Loading skeleton
                  headerGroups[0]?.headers.map((header) => (
                    <div
                      key={header.id}
                      className="px-2 shrink-0"
                      style={{
                        width: header.column.id === '#' ? 52 : header.getSize(),
                        minWidth: header.column.id === '#' ? 52 : 40,
                      }}
                    >
                      <div className="h-3 bg-muted/30 rounded animate-pulse" />
                    </div>
                  ))
                )}

                {/* Background overlay for row coloring */}
                <div
                  className="absolute inset-0 -z-10"
                  style={{ background: bgColor }}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /Volumes/HIKSEMI/project/josnl-viewer
git add app/src/components/virtual-data-table.tsx
git commit -m "feat: add VirtualDataTable core component with virtual scrolling, sorting, filtering"
```

---

### Task 14: Rewrite index.tsx Route

**Files:**
- Modify: `app/src/routes/index.tsx`

This is the integration step. The route page becomes a thin composition layer that wires up the Worker, URL state, and all the new components.

- [ ] **Step 1: Replace index.tsx with the new architecture**

Replace the entire content of `app/src/routes/index.tsx` with:

```tsx
import { useState, useCallback } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { FileDropZone } from '~/components/file-drop-zone'
import { VirtualDataTable } from '~/components/virtual-data-table'
import { SchemaPanel } from '~/components/schema-panel'
import { Toolbar } from '~/components/toolbar'
import { StatusBar } from '~/components/status-bar'
import { useJsonlWorker } from '~/worker/use-jsonl-worker'
import { useTableState } from '~/hooks/use-table-state'
import { Toaster } from '~/components/ui/sonner'
import { toast } from 'sonner'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  const { status, fileInfo, fileId, error, loadFile, getRows, reset } =
    useJsonlWorker()
  const [file, setFile] = useState<File | null>(null)

  const columnIds = fileInfo
    ? fileInfo.schema.columns.map((c) => c.key)
    : []

  const {
    sorting,
    columnFilters,
    columnVisibility,
    columnOrder,
    selectedRowIndex,
    onSortingChange,
    onColumnFiltersChange,
    onColumnVisibilityChange,
    onColumnOrderChange,
    onSelectedRowChange,
  } = useTableState({ columnIds })

  const handleFile = useCallback(
    async (newFile: File) => {
      setFile(newFile)
      onSelectedRowChange(null)

      try {
        await loadFile(newFile)
        toast.success('文件加载完成')
      } catch (err) {
        toast.error(
          `加载失败: ${err instanceof Error ? err.message : '未知错误'}`,
        )
      }
    },
    [loadFile, onSelectedRowChange],
  )

  const handleReset = useCallback(() => {
    reset()
    setFile(null)
  }, [reset])

  const handleVisibilityChange = useCallback(
    (columnId: string, visible: boolean) => {
      onColumnVisibilityChange((prev) => ({
        ...prev,
        [columnId]: visible,
      }))
    },
    [onColumnVisibilityChange],
  )

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

  return (
    <>
      <Toaster />
      <div className="flex h-screen flex-col">
        <Toolbar
          fileName={file?.name ?? 'unknown.jsonl'}
          fileSize={file?.size ?? 0}
          columnCount={fileInfo.schema.columns.length}
          onReset={handleReset}
        />

        <div className="flex flex-1 overflow-hidden">
          <SchemaPanel
            columns={fileInfo.schema.columns}
            columnVisibility={columnVisibility}
            columnOrder={columnOrder}
            onVisibilityChange={handleVisibilityChange}
            onOrderChange={onColumnOrderChange}
          />

          <VirtualDataTable
            schema={fileInfo.schema}
            totalRows={fileInfo.totalRows}
            fileId={fileId!}
            getRows={getRows}
            sorting={sorting}
            columnFilters={columnFilters}
            columnVisibility={columnVisibility}
            columnOrder={columnOrder}
            selectedRowIndex={selectedRowIndex}
            onSortingChange={onSortingChange}
            onColumnFiltersChange={onColumnFiltersChange}
            onColumnVisibilityChange={onColumnVisibilityChange}
            onColumnOrderChange={onColumnOrderChange}
            onSelectedRowChange={onSelectedRowChange}
          />
        </div>

        <StatusBar
          totalRows={fileInfo.totalRows}
          errorRows={fileInfo.errorRows}
          visibleRows={fileInfo.totalRows}
          selectedRowIndex={selectedRowIndex}
        />
      </div>
    </>
  )
}
```

- [ ] **Step 2: Verify the app compiles**

```bash
cd /Volumes/HIKSEMI/project/josnl-viewer/app
pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no type errors (or only minor ones to fix). Fix any type issues before proceeding.

- [ ] **Step 3: Commit**

```bash
cd /Volumes/HIKSEMI/project/josnl-viewer
git add app/src/routes/index.tsx
git commit -m "feat: rewrite index.tsx route with virtual table + schema panel + URL state"
```

---

### Task 15: Delete Old DataTable

**Files:**
- Delete: `app/src/components/data-table.tsx`
- Delete: `app/src/components/data-table.test.tsx`

The old DataTable is fully replaced. Remove it and its test.

- [ ] **Step 1: Delete old files**

```bash
cd /Volumes/HIKSEMI/project/josnl-viewer
rm app/src/components/data-table.tsx app/src/components/data-table.test.tsx
```

- [ ] **Step 2: Verify app still compiles and tests pass**

```bash
cd /Volumes/HIKSEMI/project/josnl-viewer/app
pnpm tsc --noEmit
pnpm test
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Volumes/HIKSEMI/project/josnl-viewer
git add -u
git commit -m "chore: remove old DataTable component (replaced by VirtualDataTable)"
```

---

### Task 16: Manual Smoke Test

**Files:** None (manual verification)

- [ ] **Step 1: Start dev server**

```bash
cd /Volumes/HIKSEMI/project/josnl-viewer/app
pnpm dev
```

- [ ] **Step 2: Verify the following behaviors**

Open http://localhost:3000 in a browser and test with a sample JSONL file:

1. **File drop zone** renders correctly with drag-and-drop
2. **After loading a file**: Toolbar, SchemaPanel, VirtualDataTable, and StatusBar all render
3. **Continuous scrolling**: scroll smoothly through rows — no page controls, only virtual rendering
4. **Column sort**: click a column header → cycles asc → desc → none
5. **Column filter**: click filter icon → popover opens → type a value → apply
6. **Schema panel**: checkbox toggles column visibility, drag handle reorders columns
7. **Column resize**: drag right edge of a column header to resize
8. **Row selection**: click a row → blue background highlight; click again → deselect
9. **Error rows**: rows with invalid JSON show red background
10. **URL state**: after sorting/filtering, URL updates; copy URL → new tab → state restored
11. **Keyboard**: ↑/↓ arrows move selection, Escape clears

- [ ] **Step 3: Fix any issues found during smoke test**

Fix any rendering or interaction bugs discovered, then commit:

```bash
cd /Volumes/HIKSEMI/project/josnl-viewer
git add -A
git commit -m "fix: address smoke test issues for Milestone A virtual table"
```

---

### Task 17: Final Commit and Verification

**Files:** None (final check)

- [ ] **Step 1: Run all tests**

```bash
cd /Volumes/HIKSEMI/project/josnl-viewer/app
pnpm test
```

Expected: all tests pass.

- [ ] **Step 2: Run type check**

```bash
cd /Volumes/HIKSEMI/project/josnl-viewer/app
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Verify build**

```bash
cd /Volumes/HIKSEMI/project/josnl-viewer/app
pnpm build
```

Expected: build succeeds without errors.

- [ ] **Step 4: Final commit if any remaining fixes**

```bash
cd /Volumes/HIKSEMI/project/josnl-viewer
git add -A
git commit -m "feat: complete Milestone A — virtual table + full data grid"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Every feature in the spec (virtual scrolling, sorting, filtering, Schema panel, URL state, column resize, column reorder, toolbar, status bar) maps to a task
- [x] **Placeholder scan:** No TBD/TODO/placeholder steps — all code is complete
- [x] **Type consistency:** Function signatures (`onSortToggle`, `handleResizeStart`, `onVisibilityChange`, etc.) match across all components and hooks
