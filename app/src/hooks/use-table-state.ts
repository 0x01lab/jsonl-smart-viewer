import { useCallback, useMemo } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { type VisibilityState } from '@tanstack/react-table'
import { parseCols, serializeCols } from '~/types/table-state'

interface UseTableStateOptions {
  columnIds: string[]
}

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

  const page: number = useMemo(() => {
    const val = search.page
    return typeof val === 'number' && val > 0 ? val : 1
  }, [search.page])

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
    return [...columnIds]
  }, [columnIds])

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

  const onPageChange = useCallback(
    (newPage: number) => {
      updateUrl({ page: newPage > 1 ? newPage : undefined })
    },
    [updateUrl],
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
      const visibleCols = newOrder.filter(
        (id) => columnVisibility[id] !== false,
      )
      updateUrl({ cols: serializeCols(visibleCols) })
    },
    [columnVisibility, updateUrl],
  )

  return {
    page,
    columnVisibility,
    columnOrder,
    onPageChange,
    onColumnVisibilityChange,
    onColumnOrderChange,
  } as const
}
