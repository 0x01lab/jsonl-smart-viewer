import { useState, useCallback } from 'react'
import { Filter, X } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'

interface FilterPopoverProps {
  columnType: string
  currentValue: string
  onApply: (value: string) => void
  onClear: () => void
}

export function FilterPopover({
  columnType,
  currentValue,
  onApply,
  onClear,
}: FilterPopoverProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [localValue, setLocalValue] = useState(currentValue)

  const handleOpen = useCallback(() => {
    setLocalValue(currentValue)
    setIsOpen(true)
  }, [currentValue])

  const handleApply = useCallback(() => {
    if (localValue.trim()) {
      onApply(localValue.trim())
    } else {
      onClear()
    }
    setIsOpen(false)
  }, [localValue, onApply, onClear])

  const handleClear = useCallback(() => {
    setLocalValue('')
    onClear()
    setIsOpen(false)
  }, [onClear])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleApply()
      if (e.key === 'Escape') setIsOpen(false)
    },
    [handleApply],
  )

  const normalizedType = columnType.toLowerCase()

  return (
    <div className="relative">
      <button
        className={`p-0.5 rounded hover:bg-muted/50 transition-colors ${currentValue ? 'text-primary' : 'text-muted-foreground/40'}`}
        onClick={handleOpen}
        title="筛选"
      >
        <Filter className="h-3 w-3" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div
            className="absolute top-full left-0 z-50 mt-1 w-56 rounded-lg border border-border bg-popover p-3 shadow-lg"
            onKeyDown={handleKeyDown}
          >
            <div className="mb-2 text-xs font-medium text-muted-foreground">
              筛选
            </div>

            {normalizedType === 'string' && (
              <div className="space-y-2">
                <Input
                  placeholder="包含文本..."
                  value={localValue}
                  onChange={(e) => setLocalValue(e.target.value)}
                  className="h-7 text-xs"
                  autoFocus
                />
              </div>
            )}

            {normalizedType === 'number' && (
              <div className="space-y-2">
                <select
                  className="w-full h-7 rounded border border-border bg-background px-2 text-xs"
                  value={
                    localValue.startsWith('>')
                      ? 'gt'
                      : localValue.startsWith('<')
                        ? 'lt'
                        : 'eq'
                  }
                  onChange={(e) => {
                    const prefix =
                      e.target.value === 'gt'
                        ? '>'
                        : e.target.value === 'lt'
                          ? '<'
                          : '='
                    const existingVal = localValue.replace(/^[><=]/, '')
                    setLocalValue(prefix + existingVal)
                  }}
                >
                  <option value="eq">等于</option>
                  <option value="gt">大于</option>
                  <option value="lt">小于</option>
                </select>
                <Input
                  placeholder="输入数值..."
                  value={localValue.replace(/^[><=]/, '')}
                  onChange={(e) => {
                    const prefix = localValue.match(/^[><=]/)?.[0] ?? '='
                    setLocalValue(prefix + e.target.value)
                  }}
                  className="h-7 text-xs"
                  type="number"
                  autoFocus
                />
              </div>
            )}

            {normalizedType === 'boolean' && (
              <div className="space-y-1">
                {[
                  { label: '全部', value: '' },
                  { label: 'true', value: 'true' },
                  { label: 'false', value: 'false' },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50 cursor-pointer text-xs"
                  >
                    <input
                      type="radio"
                      name={`filter-bool-${normalizedType}`}
                      checked={localValue === opt.value}
                      onChange={() => setLocalValue(opt.value)}
                      className="accent-primary"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            )}

            {!['string', 'number', 'boolean'].includes(normalizedType) && (
              <Input
                placeholder="筛选值..."
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                className="h-7 text-xs"
                autoFocus
              />
            )}

            <div className="mt-3 flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={handleClear}
              >
                <X className="mr-1 h-3 w-3" />
                清除
              </Button>
              <Button size="sm" className="h-6 text-xs" onClick={handleApply}>
                应用
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
