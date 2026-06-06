interface ColumnHeaderProps {
  header: string
  isRowNum?: boolean
  onResizeStart: (
    e: React.MouseEvent,
    columnId: string,
    currentWidth: number,
  ) => void
  onResizeDoubleClick: (columnId: string) => void
  columnId: string
  width: number
}

export function ColumnHeader({
  header,
  isRowNum,
  onResizeStart,
  onResizeDoubleClick,
  columnId,
  width,
}: ColumnHeaderProps) {
  return (
    <div
      className="relative flex items-center px-2 py-1.5 select-none font-sans text-[13px] font-semibold"
      style={{
        width: isRowNum ? 52 : undefined,
        minWidth: isRowNum ? 52 : 40,
      }}
    >
      <span className="truncate">{header}</span>
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
