import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { VirtualItem } from '@tanstack/react-virtual'
import type { WasmRow } from '~/types/wasm'

const ROW_HEIGHT = 32
const OVERSCAN = 5

interface UseVirtualRowsOptions {
  /** Unique file identifier (filename + size) */
  fileId: string | null
  /** Total row count from the schema scan */
  totalRows: number
  /** The getRows function from the worker API */
  getRows: (start: number, end: number) => Promise<WasmRow[]>
  /** Virtual items from TanStack Virtual (the visible range) */
  virtualItems: VirtualItem[]
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
