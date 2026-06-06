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
      const visibleCols = newOrder.filter(
        (id) => columnVisibility[id] !== false,
      )
      updateUrl({ cols: serializeCols(visibleCols) })
    },
    [columnVisibility, updateUrl],
  )

  return {
    page,
    sorting,
    columnFilters,
    columnVisibility,
    columnOrder,
    onPageChange,
    onSortingChange,
    onColumnFiltersChange,
    onColumnVisibilityChange,
    onColumnOrderChange,
  } as const
}
