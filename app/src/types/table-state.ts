import { z } from 'zod'

/** URL search params schema for table state */
export const tableStateSchema = z.object({
  /** Visible columns: "col1,col2,col3" */
  cols: z.string().optional(),
  /** Current page number (1-based) */
  page: z.number().optional(),
})

export type TableStateSchema = z.infer<typeof tableStateSchema>

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
