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
