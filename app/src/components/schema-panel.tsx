import { useState, useMemo, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Search, GripVertical } from 'lucide-react'
import { Input } from '~/components/ui/input'
import type { WasmColumnDef } from '~/types/wasm'
import type { VisibilityState } from '@tanstack/react-table'

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  string: { bg: 'bg-[#22c55e20]', text: 'text-[#22c55e]' },
  number: { bg: 'bg-[#3b82f620]', text: 'text-[#3b82f6]' },
  boolean: { bg: 'bg-[#f59e0b20]', text: 'text-[#f59e0b]' },
  array: { bg: 'bg-[#a855f720]', text: 'text-[#a855f7]' },
  object: { bg: 'bg-[#ef444420]', text: 'text-[#ef4444]' },
  null: { bg: 'bg-[#88888820]', text: 'text-[#888]' },
  mixed: { bg: 'bg-[#88888820]', text: 'text-[#888]' },
}

function getTypeColor(type: string) {
  return TYPE_COLORS[type.toLowerCase()] ?? TYPE_COLORS.mixed
}

interface SortableColumnItemProps {
  col: WasmColumnDef
  isVisible: boolean
  onToggleVisibility: (columnId: string) => void
}

function SortableColumnItem({
  col,
  isVisible,
  onToggleVisibility,
}: SortableColumnItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: col.key })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const color = getTypeColor(col.inferred_type)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md mx-1.5 transition-colors ${
        isVisible ? '' : 'opacity-50'
      } hover:bg-muted/30`}
    >
      <input
        type="checkbox"
        checked={isVisible}
        onChange={() => onToggleVisibility(col.key)}
        className="accent-primary w-3.5 h-3.5 shrink-0"
      />
      <span className="flex-1 text-xs font-mono truncate">{col.key}</span>
      <span
        className={`text-[10px] px-1.5 py-0.5 rounded ${color.bg} ${color.text} shrink-0`}
      >
        {col.inferred_type.toLowerCase()}
      </span>
      <button
        className="text-muted-foreground/60 hover:text-muted-foreground cursor-grab shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

interface SchemaPanelProps {
  columns: WasmColumnDef[]
  columnVisibility: VisibilityState
  columnOrder: string[]
  onVisibilityChange: (columnId: string, visible: boolean) => void
  onOrderChange: (newOrder: string[]) => void
}

export function SchemaPanel({
  columns,
  columnVisibility,
  columnOrder,
  onVisibilityChange,
  onOrderChange,
}: SchemaPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsed, setCollapsed] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const orderedColumns = useMemo(() => {
    if (columnOrder.length === 0) return columns
    const colMap = new Map(columns.map((c) => [c.key, c]))
    const ordered = columnOrder
      .map((id) => colMap.get(id))
      .filter(Boolean) as WasmColumnDef[]
    const seen = new Set(columnOrder)
    for (const col of columns) {
      if (!seen.has(col.key)) ordered.push(col)
    }
    return ordered
  }, [columns, columnOrder])

  const filteredColumns = useMemo(() => {
    if (!searchQuery.trim()) return orderedColumns
    const q = searchQuery.toLowerCase()
    return orderedColumns.filter((col) => col.key.toLowerCase().includes(q))
  }, [orderedColumns, searchQuery])

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const col of columns) {
      const t = col.inferred_type.toLowerCase()
      counts[t] = (counts[t] || 0) + 1
    }
    return counts
  }, [columns])

  const handleToggleVisibility = useCallback(
    (columnId: string) => {
      const isVisible = columnVisibility[columnId] !== false
      onVisibilityChange(columnId, !isVisible)
    },
    [columnVisibility, onVisibilityChange],
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const oldIndex = columnOrder.indexOf(String(active.id))
      const newIndex = columnOrder.indexOf(String(over.id))
      if (oldIndex === -1 || newIndex === -1) return
      const newOrder = arrayMove(columnOrder, oldIndex, newIndex)
      onOrderChange(newOrder)
    },
    [columnOrder, onOrderChange],
  )

  if (collapsed) {
    return (
      <div className="w-8 min-w-8 border-r border-[var(--table-grid-line)] bg-[var(--table-header-bg)] flex flex-col items-center pt-2">
        <button
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setCollapsed(false)}
          title="展开 Schema 面板"
        >
          ▶
        </button>
      </div>
    )
  }

  return (
    <div className="w-[220px] min-w-[220px] border-r border-[var(--table-grid-line)] bg-[var(--table-header-bg)] flex flex-col">
      <div className="flex items-center justify-between px-2.5 py-2 border-b border-[var(--table-grid-line)]">
        <span className="font-semibold text-xs">Schema</span>
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-muted-foreground">
            {columns.length} 字段
          </span>
          <button
            className="text-xs text-muted-foreground hover:text-foreground ml-1"
            onClick={() => setCollapsed(true)}
            title="收起"
          >
            ◀
          </button>
        </div>
      </div>

      <div className="px-2.5 py-1.5 border-b border-[var(--table-grid-line)]/50">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="搜索字段..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-6 pl-7 text-xs"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filteredColumns.map((c) => c.key)}
            strategy={verticalListSortingStrategy}
          >
            {filteredColumns.map((col) => (
              <SortableColumnItem
                key={col.key}
                col={col}
                isVisible={columnVisibility[col.key] !== false}
                onToggleVisibility={handleToggleVisibility}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <div className="px-2.5 py-2 border-t border-[var(--table-grid-line)] flex flex-wrap gap-1">
        {Object.entries(typeCounts).map(([type, count]) => {
          const color = getTypeColor(type)
          return (
            <span
              key={type}
              className={`text-[10px] px-1.5 py-0.5 rounded cursor-default ${color.bg} ${color.text}`}
            >
              {type} ({count})
            </span>
          )
        })}
      </div>
    </div>
  )
}
