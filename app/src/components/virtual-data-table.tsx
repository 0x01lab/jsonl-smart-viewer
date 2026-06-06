import { useMemo, useCallback, useRef, useEffect } from 'react'
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
  const headerScrollRef = useRef<HTMLDivElement>(null)

  // Sync header horizontal scroll with body scroll
  useEffect(() => {
    const scrollEl = scrollRef.current
    const headerEl = headerScrollRef.current
    if (!scrollEl || !headerEl) return

    const handleScroll = () => {
      headerEl.scrollLeft = scrollEl.scrollLeft
    }
    scrollEl.addEventListener('scroll', handleScroll, { passive: true })
    return () => scrollEl.removeEventListener('scroll', handleScroll)
  }, [])

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
      cell: ({ row }: { row: { original: WasmRow } }) => {
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

  // Calculate total width of all visible columns
  const totalWidth = useMemo(() => {
    return table.getVisibleLeafColumns().reduce((sum, col) => {
      return sum + col.getSize()
    }, 0)
  }, [table])

  // Virtual scrolling
  const virtualizer = useVirtualizer({
    count: totalRows,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  })

  const virtualItems = virtualizer.getVirtualItems()

  // Data fetching via TanStack Query (chunk-based caching)
  const { rows } = useVirtualRows({
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
        if (currentSort) {
          if (currentSort.desc) {
            newSorting = sorting.filter((s) => s.id !== columnId)
          } else {
            newSorting = sorting.map((s) =>
              s.id === columnId ? { ...s, desc: true } : s,
            )
          }
        } else {
          newSorting = [...sorting, { id: columnId, desc: false }]
        }
      } else {
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
        const next =
          selectedRowIndex === null
            ? 0
            : Math.min(selectedRowIndex + 1, totalRows - 1)
        onSelectedRowChange(next)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const prev =
          selectedRowIndex === null
            ? 0
            : Math.max(selectedRowIndex - 1, 0)
        onSelectedRowChange(prev)
      } else if (e.key === 'Escape') {
        onSelectedRowChange(null)
      }
    },
    [selectedRowIndex, totalRows, onSelectedRowChange],
  )

  const headerGroups = table.getHeaderGroups()
  const headers = headerGroups[0]?.headers ?? []

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Header — sticky at top, synced horizontal scroll with body */}
      <div
        ref={headerScrollRef}
        className="shrink-0 overflow-hidden bg-[var(--table-header-bg)] border-b border-[var(--table-grid-line)]"
        style={{ width: '100%' }}
      >
        <div style={{ width: totalWidth, minWidth: '100%' }}>
          <div className="flex">
            {headers.map((header) => {
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
                  style={{
                    width: isRowNum ? 52 : width,
                    minWidth: isRowNum ? 52 : 40,
                  }}
                >
                  <div className="flex items-center">
                    <div className="flex-1">
                      <ColumnHeader
                        columnId={colId}
                        header={
                          isRowNum
                            ? '#'
                            : (flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              ) as string)
                        }
                        sortDirection={sortState ? sortState.desc : undefined}
                        sortIndex={
                          sorting.length > 1 && sortState
                            ? sorting.indexOf(sortState)
                            : undefined
                        }
                        width={width}
                        isRowNum={isRowNum}
                        onSortToggle={handleSortToggle}
                        onResizeStart={handleResizeStart}
                        onResizeDoubleClick={handleDoubleClick}
                      />
                    </div>
                    {!isRowNum && colDef && (
                      <div className="pr-1">
                        <FilterPopover
                          columnType={colDef.inferred_type}
                          currentValue={
                            filterState ? String(filterState.value) : ''
                          }
                          onApply={(value) => {
                            const newFilters = columnFilters.filter(
                              (f) => f.id !== colId,
                            )
                            newFilters.push({ id: colId, value })
                            onColumnFiltersChange(newFilters)
                          }}
                          onClear={() => {
                            const newFilters = columnFilters.filter(
                              (f) => f.id !== colId,
                            )
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
        </div>
      </div>

      {/* Virtual scrolling body — handles both vertical and horizontal scroll */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: totalWidth,
            minWidth: '100%',
            position: 'relative',
          }}
        >
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
                className="flex items-center border-b border-[var(--table-grid-line)] font-mono text-[13px] cursor-pointer hover:bg-[var(--table-row-hover)]"
                onClick={() => handleRowClick(virtualRow.index)}
              >
                {rowData ? (
                  headers.map((header) => {
                    const colId = header.column.id
                    const width = header.getSize()

                    if (isError && colId !== '#') {
                      return (
                        <div
                          key={header.id}
                          className="px-2 shrink-0 overflow-hidden"
                          style={{
                            width,
                            minWidth: colId === '#' ? 52 : 40,
                          }}
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
                  headers.map((header) => (
                    <div
                      key={header.id}
                      className="px-2 shrink-0"
                      style={{
                        width:
                          header.column.id === '#' ? 52 : header.getSize(),
                        minWidth: header.column.id === '#' ? 52 : 40,
                      }}
                    >
                      <div className="h-3 bg-muted/30 rounded animate-pulse" />
                    </div>
                  ))
                )}

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
