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

      {/* Virtual scrolling body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: '100%',
            position: 'relative',
          }}
        >
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
                  headerGroups[0]?.headers.map((header) => {
                    const colId = header.column.id
                    const width = colId === '#' ? 52 : header.getSize()

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
                  headerGroups[0]?.headers.map((header) => (
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
