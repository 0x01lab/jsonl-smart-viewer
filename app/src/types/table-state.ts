import { z } from 'zod'

/** URL search params schema for table state */
export const tableStateSchema = z.object({
  /** Column filters: "col:op:value,col2:op:value" */
  filter: z.string().optional(),
  /** Visible columns: "col1,col2,col3" */
  cols: z.string().optional(),
  /** Current page number (1-based) */
  page: z.number().optional(),
})

export type TableStateSchema = z.infer<typeof tableStateSchema>

/** Parse a filter string into column filter entries */
export function parseFilter(
  filter: string | undefined,
): Record<string, string> {
  if (!filter) return {}
  const result: Record<string, string> = {}
  filter.split(',').forEach((part) => {
    const colonIdx = part.indexOf(':')
    if (colonIdx === -1) return
    const col = part.slice(0, colonIdx)
    const value = part.slice(colonIdx + 1)
    result[col] = value
  })
  return result
}

/** Serialize column filters to URL string */
export function serializeFilter(
  filters: Record<string, string>,
): string | undefined {
  const entries = Object.entries(filters).filter(([, v]) => v !== '')
  if (entries.length === 0) return undefined
  return entries.map(([col, val]) => `${col}:${val}`).join(',')
}

/** Parse visible columns string */
export function parseCols(cols: string | undefined): string[] | undefined {
  if (!cols) return undefined
  const parsed = cols.split(',').filter(Boolean)
  return parsed.length > 0 ? parsed : undefined
}

/** Serialize visible columns to URL string */
export function serializeCols(cols: string[] | undefined): string | undefined {
  if (!cols || cols.length === 0) return undefined
  return cols.join(',')
}
