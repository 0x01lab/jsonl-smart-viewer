import { useCallback, useRef } from 'react'
import type { Table } from '@tanstack/react-table'
import type { WasmRow } from '~/types/wasm'

const MIN_COLUMN_WIDTH = 40

interface UseColumnResizeOptions {
  table: Table<WasmRow>
}

export function useColumnResize({ table }: UseColumnResizeOptions) {
  const isResizing = useRef(false)
  const resizingColumnId = useRef<string | null>(null)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, columnId: string, currentWidth: number) => {
      e.preventDefault()
      e.stopPropagation()
      isResizing.current = true
      resizingColumnId.current = columnId
      startX.current = e.clientX
      startWidth.current = currentWidth

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isResizing.current) return
        const diff = moveEvent.clientX - startX.current
        const newWidth = Math.max(MIN_COLUMN_WIDTH, startWidth.current + diff)
        table.setColumnSizing((prev) => ({
          ...prev,
          [resizingColumnId.current!]: newWidth,
        }))
      }

      const handleMouseUp = () => {
        isResizing.current = false
        resizingColumnId.current = null
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [table],
  )

  const handleDoubleClick = useCallback(
    (columnId: string) => {
      table.setColumnSizing((prev) => ({
        ...prev,
        [columnId]: 150,
      }))
    },
    [table],
  )

  return { handleResizeStart, handleDoubleClick } as const
}
