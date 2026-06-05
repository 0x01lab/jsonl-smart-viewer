import { useMemo } from 'react'
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

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
    return <span className="tabular-nums">{value.toLocaleString()}</span>
  }
  if (typeof value === 'object') {
    const fields = Array.isArray(value) ? value.length : Object.keys(value as object).length
    return (
      <Badge variant="outline" className="text-[11px]">
        {Array.isArray(value) ? `[${fields}]` : `{${fields} fields}`}
      </Badge>
    )
  }
  const str = String(value)
  if (str.length > 50) return <span title={str}>{str.slice(0, 50)}…</span>
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

  const columns = useMemo<ColumnDef<WasmRow>[]>(() => {
    const rowNumCol: ColumnDef<WasmRow> = {
      id: '#',
      size: 52,
      header: '#',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{row.original.index + 1}</span>
      ),
    }
    const dataCols: ColumnDef<WasmRow>[] = schema.columns.map((col) => ({
      accessorKey: `data.${col.key}` as const,
      header: col.key,
      cell: ({ row }) => {
        if (row.original.error) return null
        return <CellRenderer value={row.original.data[col.key]} />
      },
    }))
    return [rowNumCol, ...dataCols]
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
          <span className="text-xs text-muted-foreground">({formatFileSize(fileSize)})</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {totalRows.toLocaleString()} 行 · {schema.columns.length} 列
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="bg-[var(--table-header-bg)] hover:bg-[var(--table-header-bg)]">
                {hg.headers.map((header) => (
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
                        : isOdd ? 'bg-[var(--table-row-odd)]' : 'bg-[var(--table-row-even)]'
                    }
                    hover:bg-[var(--table-row-hover)]
                  `}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-2 py-1">
                      {isError && cell.column.id !== '#'
                        ? <span className="text-xs text-[var(--color-error)]">{row.original.error}</span>
                        : flexRender(cell.column.columnDef.cell, cell.getContext())
                      }
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
            <span className="text-[var(--color-error)]">⚠ 错误: {errorRows} 行</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {totalPages > 1 && (
            <>
              <Button variant="ghost" size="sm" className="h-5 px-1 text-xs" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>◀</Button>
              <span>{currentPage} / {totalPages}</span>
              <Button variant="ghost" size="sm" className="h-5 px-1 text-xs" disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>▶</Button>
            </>
          )}
          {selectedRowIndex !== null && <span>选中: #{selectedRowIndex + 1}</span>}
        </div>
      </div>
    </div>
  )
}
