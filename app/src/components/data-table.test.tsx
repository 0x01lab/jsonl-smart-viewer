import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DataTable } from './data-table'
import type { WasmSchemaResult, WasmRow } from '~/types/wasm'

const mockSchema: WasmSchemaResult = {
  columns: [
    { key: 'id', depth: 0, inferred_type: 'Number', nullable: false },
    { key: 'name', depth: 0, inferred_type: 'String', nullable: true },
    { key: 'active', depth: 0, inferred_type: 'Boolean', nullable: false },
    { key: 'meta', depth: 0, inferred_type: 'Object', nullable: true },
  ],
  total_rows: 3,
  error_rows: 1,
}

const mockRows: WasmRow[] = [
  { index: 0, data: { id: 1, name: 'Alice', active: true, meta: null } },
  { index: 1, data: { id: 2, name: 'Bob', active: false, meta: { city: 'NYC' } } },
  { index: 2, data: {}, error: 'Invalid JSON' },
]

const defaultProps = {
  schema: mockSchema,
  rows: mockRows,
  totalRows: 3,
  errorRows: 1,
  fileName: 'test.jsonl',
  fileSize: 1024,
  currentPage: 1,
  pageSize: 100,
  selectedRowIndex: null as number | null,
  onPageChange: () => {},
  onRowSelect: () => {},
}

describe('DataTable', () => {
  it('renders column headers from schema', () => {
    render(<DataTable {...defaultProps} />)
    expect(screen.getByText('id')).toBeInTheDocument()
    expect(screen.getByText('name')).toBeInTheDocument()
    expect(screen.getByText('active')).toBeInTheDocument()
    expect(screen.getByText('meta')).toBeInTheDocument()
  })

  it('renders row data', () => {
    render(<DataTable {...defaultProps} />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('renders error row with error indicator', () => {
    render(<DataTable {...defaultProps} />)
    // Error text is rendered in every data column cell of the error row
    const errorCells = screen.getAllByText(/Invalid JSON/i)
    expect(errorCells.length).toBeGreaterThanOrEqual(1)
  })

  it('renders null values as italic "null"', () => {
    render(<DataTable {...defaultProps} />)
    const nullCells = screen.getAllByText('null')
    expect(nullCells.length).toBeGreaterThanOrEqual(1)
    expect(nullCells[0].className).toContain('italic')
  })

  it('displays total rows and file info in status bar', () => {
    render(<DataTable {...defaultProps} />)
    // "3 行" appears in both header bar and status bar
    const rowCounts = screen.getAllByText(/3 行/)
    expect(rowCounts.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/test\.jsonl/)).toBeInTheDocument()
  })
})
