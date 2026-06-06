import { Button } from '~/components/ui/button'

const PAGE_SIZE = 50

interface StatusBarProps {
  totalRows: number
  errorRows: number
  page: number
  selectedRowIndex: number | null
  onPageChange: (page: number) => void
  loadTimeMs?: number
  memoryEstimateMB?: number
}

export function StatusBar({
  totalRows,
  errorRows,
  page,
  selectedRowIndex,
  onPageChange,
  loadTimeMs,
  memoryEstimateMB,
}: StatusBarProps) {
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE))

  return (
    <div className="flex h-7 items-center justify-between border-t border-[var(--table-grid-line)] bg-[var(--table-header-bg)] px-3 text-xs text-muted-foreground font-sans">
      <div className="flex items-center gap-3">
        <span>📊 共 {totalRows.toLocaleString()} 行</span>
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
        {totalPages > 1 && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1 text-xs"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              ◀
            </Button>
            <span>
              {page} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1 text-xs"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              ▶
            </Button>
          </>
        )}
        {selectedRowIndex !== null && (
          <span>选中: #{selectedRowIndex + 1}</span>
        )}
        {loadTimeMs !== undefined && <span>⏱ {loadTimeMs}ms</span>}
      </div>
    </div>
  )
}
