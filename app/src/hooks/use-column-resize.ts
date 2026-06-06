import { useCallback, useRef } from 'react'
import type { Table } from '@tanstack/react-table'
import type { WasmRow } from '~/types/wasm'

const MIN_COLUMN_WIDTH = 40

interface UseColumnResizeOptions {
  table: Table<WasmRow>
}

export function useColumnResize({ table }: UseColumnResizeOptions) {
  const rafId = useRef<number | null>(null)

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, columnId: string, currentWidth: number) => {
      e.preventDefault()
      e.stopPropagation()

      const startX = e.clientX
      const startWidth = currentWidth

      // Set cursor during resize
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      const handleMouseMove = (moveEvent: MouseEvent) => {
        // Cancel previous frame if pending
        if (rafId.current !== null) {
          cancelAnimationFrame(rafId.current)
        }

        const targetX = moveEvent.clientX
        rafId.current = requestAnimationFrame(() => {
          const diff = targetX - startX
          const newWidth = Math.max(MIN_COLUMN_WIDTH, startWidth + diff)
          table.setColumnSizing((prev) => ({
            ...prev,
            [columnId]: newWidth,
          }))
        })
      }

      const handleMouseUp = () => {
        if (rafId.current !== null) {
          cancelAnimationFrame(rafId.current)
          rafId.current = null
        }
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
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
