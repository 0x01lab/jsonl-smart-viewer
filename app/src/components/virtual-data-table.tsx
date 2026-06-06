import { useMemo, useCallback, useRef, useEffect } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type ColumnFiltersState,
  type VisibilityState,
} from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'
import { ColumnHeader } from '~/components/column-header'
import { FilterPopover } from '~/components/filter-popover'
import { CellRenderer } from '~/components/cell-renderer'
import { useColumnResize } from '~/hooks/use-column-resize'
import type { WasmSchemaResult, WasmRow } from '~/types/wasm'

const PAGE_SIZE = 50

interface VirtualDataTableProps {
  schema: WasmSchemaResult
  totalRows: number
  fileId: string
  page: number
  getRows: (start: number, end: number) => Promise<WasmRow[]>
  columnFilters: ColumnFiltersState
  columnVisibility: VisibilityState
  columnOrder: string[]
  selectedRowIndex: number | null
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
  page,
  getRows,
  columnFilters,
  columnVisibility,
  columnOrder,
  selectedRowIndex,
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

  // Fetch current page data
  const start = (page - 1) * PAGE_SIZE
  const end = Math.min(start + PAGE_SIZE, totalRows)

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['rows', fileId, page],
    queryFn: () => getRows(start, end),
    enabled: !!fileId && start < totalRows,
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  })

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
    data: rows,
    columns,
    state: {
      columnFilters,
      columnVisibility,
      columnOrder,
    },
    onColumnFiltersChange,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: undefined,
    manualPagination: true,
    pageCount: -1,
  })

  // Column resize handler
  const { handleResizeStart, handleDoubleClick } = useColumnResize({ table })

  // Row click handler
  const handleRowClick = useCallback(
    (index: number) => {
      onSelectedRowChange(selectedRowIndex === index ? null : index)
    },
    [selectedRowIndex, onSelectedRowChange],
  )

  const headers = table.getHeaderGroups()[0]?.headers ?? []
  const tableRows = table.getRowModel().rows

  const totalWidth = useMemo(() => {
    return table.getVisibleLeafColumns().reduce((sum, col) => sum + col.getSize(), 0)
  }, [table])

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div
        ref={headerScrollRef}
        className="shrink-0 overflow-hidden bg-[var(--table-header-bg)] border-b border-[var(--table-grid-line)]"
      >
        <div style={{ width: totalWidth, minWidth: '100%' }}>
          <div className="flex">
            {headers.map((header) => {
              const colId = header.column.id
              const isRowNum = colId === '#'
              const colDef = schema.columns.find((c) => c.key === colId)
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
                        width={width}
                        isRowNum={isRowNum}
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

      {/* Body */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            加载中...
          </div>
        ) : tableRows.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            无匹配行
          </div>
        ) : (
          <div style={{ width: totalWidth, minWidth: '100%' }}>
            {tableRows.map((row) => {
              const isError = !!row.original.error
              const isSelected = row.original.index === selectedRowIndex
              const isOdd = row.original.index % 2 === 1

              const bgColor = isError
                ? '#ef444418'
                : isSelected
                  ? '#3b82f622'
                  : isOdd
                    ? 'var(--table-row-odd)'
                    : 'var(--table-row-even)'

              return (
                <div
                  key={row.id}
                  className="flex items-center border-b border-[var(--table-grid-line)] font-mono text-[13px] cursor-pointer hover:bg-[var(--table-row-hover)] overflow-hidden"
                  style={{ height: 32, minHeight: 32, maxHeight: 32, background: bgColor }}
                  onClick={() => handleRowClick(row.original.index)}
                >
                  {row.getVisibleCells().map((cell) => {
                    const colId = cell.column.id
                    const width = colId === '#' ? 52 : cell.column.getSize()

                    if (isError && colId !== '#') {
                      return (
                        <div
                          key={cell.id}
                          className="px-2 shrink-0 overflow-hidden"
                          style={{ width, minWidth: colId === '#' ? 52 : 40 }}
                        >
                          <span className="text-xs text-[var(--color-error)] italic truncate block">
                            {row.original.error}
                          </span>
                        </div>
                      )
                    }

                    return (
                      <div
                        key={cell.id}
                        className="px-2 shrink-0 overflow-hidden"
                        style={{ width, minWidth: colId === '#' ? 52 : 40 }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
