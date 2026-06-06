import { Badge } from '~/components/ui/badge'

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function CellRenderer({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="italic text-[var(--null-text)] text-[13px] leading-8">null</span>
  }
  if (typeof value === 'boolean') {
    return (
      <Badge
        variant={value ? 'default' : 'secondary'}
        className="text-[11px] h-5 leading-none"
      >
        ● {String(value)}
      </Badge>
    )
  }
  if (typeof value === 'number') {
    return <span className="tabular-nums leading-8">{value.toLocaleString()}</span>
  }
  if (typeof value === 'object') {
    const fields = Array.isArray(value)
      ? value.length
      : Object.keys(value as object).length
    return (
      <Badge variant="outline" className="text-[11px] h-5 leading-none">
        {Array.isArray(value) ? `[${fields}]` : `{${fields} fields}`}
      </Badge>
    )
  }
  const str = String(value)
  if (str.length > 50)
    return (
      <span title={str} className="leading-8">
        {str.slice(0, 50)}…
      </span>
    )
  return <span className="leading-8">{str}</span>
}
