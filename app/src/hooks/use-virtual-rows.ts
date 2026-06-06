import { useMemo, useRef } from 'react'
import { useQueries } from '@tanstack/react-query'
import type { VirtualItem } from '@tanstack/react-virtual'
import type { WasmRow } from '~/types/wasm'

const ROW_HEIGHT = 32
const OVERSCAN = 5
/** Fixed chunk size for caching — prevents blank flashes on scroll */
const CHUNK_SIZE = 100

interface UseVirtualRowsOptions {
  fileId: string | null
  totalRows: number
  getRows: (start: number, end: number) => Promise<WasmRow[]>
  virtualItems: VirtualItem[]
}

/** Convert a row index to a chunk index */
function chunkOf(rowIndex: number): number {
  return Math.floor(rowIndex / CHUNK_SIZE)
}

/** Get the set of unique chunk indices needed for the given virtual items */
function getChunksNeeded(
  virtualItems: VirtualItem[],
  totalRows: number,
): number[] {
  if (virtualItems.length === 0) return []

  const indices = virtualItems.map((v) => v.index)
  const minIdx = Math.max(0, Math.min(...indices) - OVERSCAN)
  const maxIdx = Math.min(totalRows - 1, Math.max(...indices) + OVERSCAN)

  const chunks = new Set<number>()
  for (let i = minIdx; i <= maxIdx; i++) {
    chunks.add(chunkOf(i))
  }
  return Array.from(chunks).sort((a, b) => a - b)
}

export function useVirtualRows({
  fileId,
  totalRows,
  getRows,
  virtualItems,
}: UseVirtualRowsOptions) {
  // Track previous data to avoid blank flashes
  const prevRowsRef = useRef<Map<number, WasmRow>>(new Map())

  const chunksNeeded = useMemo(
    () => (fileId ? getChunksNeeded(virtualItems, totalRows) : []),
    [fileId, virtualItems, totalRows],
  )

  // One query per chunk — chunks are stable, so cached data persists across scrolls
  const chunkQueries = useQueries({
    queries: chunksNeeded.map((chunkIdx) => {
      const start = chunkIdx * CHUNK_SIZE
      const end = Math.min(start + CHUNK_SIZE, totalRows)
      return {
        queryKey: ['rows', fileId, chunkIdx],
        queryFn: () => getRows(start, end),
        staleTime: Infinity,
        gcTime: 5 * 60 * 1000,
        enabled: !!fileId,
      }
    }),
  })

  // Merge all chunk data into a single map
  const rows = useMemo(() => {
    const map = new Map<number, WasmRow>()

    for (const result of chunkQueries) {
      if (result.data) {
        for (const row of result.data) {
          map.set(row.index, row)
        }
      }
    }

    // If we got new data, update the ref
    if (map.size > 0) {
      prevRowsRef.current = map
      return map
    }

    // Otherwise fall back to previous data to avoid blank flash
    return prevRowsRef.current
  }, [chunkQueries])

  const isLoading = chunkQueries.some((q) => q.isLoading)
  const isError = chunkQueries.some((q) => q.isError)

  return {
    rows,
    isLoading,
    isError,
  } as const
}

export { ROW_HEIGHT, OVERSCAN, CHUNK_SIZE }
