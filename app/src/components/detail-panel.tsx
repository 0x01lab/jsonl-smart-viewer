import { useState, useCallback } from 'react'
import { JsonView } from '@uiw/react-json-view'
import { X, Copy, Check } from 'lucide-react'
import type { WasmRow, WasmColumnDef } from '~/types/wasm'

interface DetailPanelProps {
  row: WasmRow
  columns: WasmColumnDef[]
  onClose: () => void
}

const jsonViewStyle: React.CSSProperties = {
  '--w-rjv-font-family': "'JetBrains Mono', monospace",
  '--w-rjv-font-size': '13px',
  '--w-rjv-line-height': '1.6',
  '--w-rjv-background-color': 'transparent',
  '--w-rjv-color': 'var(--foreground)',
  '--w-rjv-key-string': 'var(--json-key)',
  '--w-rjv-curlybraces-color': 'var(--muted-foreground)',
  '--w-rjv-brackets-color': 'var(--muted-foreground)',
  '--w-rjv-colon-color': 'var(--muted-foreground)',
  '--w-rjv-quotes-color': 'var(--json-key)',
  '--w-rjv-quotes-string-color': 'var(--json-string)',
  '--w-rjv-type-string-color': 'var(--json-string)',
  '--w-rjv-type-int-color': 'var(--json-number)',
  '--w-rjv-type-float-color': 'var(--json-number)',
  '--w-rjv-type-bigint-color': 'var(--json-number)',
  '--w-rjv-type-boolean-color': 'var(--json-boolean)',
  '--w-rjv-type-null-color': 'var(--json-null)',
  '--w-rjv-type-undefined-color': 'var(--json-null)',
  '--w-rjv-info-color': 'var(--muted-foreground)',
  '--w-rjv-arrow-color': 'var(--muted-foreground)',
  '--w-rjv-line-color': 'var(--border)',
  '--w-rjv-copied-color': 'var(--foreground)',
  '--w-rjv-copied-success-color': 'var(--color-success)',
} as React.CSSProperties

export function DetailPanel({ row, onClose }: DetailPanelProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    const json = JSON.stringify(row.error ? { error: row.error } : row.data, null, 2)
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [row])

  return (
    <div className="flex h-full flex-col overflow-hidden font-mono text-[13px]">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--table-grid-line)] bg-[var(--table-header-bg)] px-3 h-8">
        <span className="text-xs text-muted-foreground select-none">
          Row #{row.index + 1}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Copy JSON"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Close panel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {row.error ? (
          <div className="p-3">
            <span className="text-[var(--color-error)] italic">{row.error}</span>
          </div>
        ) : (
          <JsonView
            value={row.data}
            enableClipboard
            collapsed={2}
            displayDataTypes={false}
            indentWidth={2}
            shortenTextAfterLength={0}
            style={jsonViewStyle}
          />
        )}
      </div>
    </div>
  )
}
