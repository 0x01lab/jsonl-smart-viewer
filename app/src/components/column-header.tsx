import { useCallback } from 'react'
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'

interface ColumnHeaderProps {
  columnId: string
  header: string
  sortDirection: false | true | undefined
  sortIndex?: number
  width: number
  isRowNum?: boolean
  onSortToggle: (columnId: string, shiftKey: boolean) => void
  onResizeStart: (
    e: React.MouseEvent,
    columnId: string,
    currentWidth: number,
  ) => void
  onResizeDoubleClick: (columnId: string) => void
}

export function ColumnHeader({
  columnId,
  header,
  sortDirection,
  sortIndex,
  width,
  isRowNum,
  onSortToggle,
  onResizeStart,
  onResizeDoubleClick,
}: ColumnHeaderProps) {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isRowNum) return
      onSortToggle(columnId, e.shiftKey)
    },
    [columnId, isRowNum, onSortToggle],
  )

  const sortIcon = () => {
    if (sortDirection === undefined) return null
    if (sortDirection === false)
      return <ArrowUp className="h-3 w-3 text-primary" />
    return <ArrowDown className="h-3 w-3 text-primary" />
  }

  return (
    <div
      className="relative flex items-center gap-1 px-2 py-1.5 select-none font-sans text-[13px] font-semibold"
      style={{
        width: isRowNum ? 52 : undefined,
        minWidth: isRowNum ? 52 : 40,
        background:
          sortDirection !== undefined
            ? 'var(--table-row-selected)'
            : undefined,
      }}
    >
      <div
        className={`flex items-center gap-1 flex-1 ${isRowNum ? '' : 'cursor-pointer'}`}
        onClick={handleClick}
      >
        <span className="truncate">{header}</span>
        {sortIcon()}
        {sortIndex !== undefined && sortDirection !== undefined && (
          <span className="text-[10px] text-muted-foreground font-normal">
            {sortIndex + 1}
          </span>
        )}
        {!isRowNum && sortDirection === undefined && (
          <ArrowUpDown className="h-3 w-3 text-muted-foreground/40" />
        )}
      </div>
      {!isRowNum && (
        <div
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors"
          onMouseDown={(e) => onResizeStart(e, columnId, width)}
          onDoubleClick={() => onResizeDoubleClick(columnId)}
        />
      )}
    </div>
  )
}
