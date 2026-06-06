import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CellRenderer, formatFileSize } from './cell-renderer'

describe('CellRenderer', () => {
  it('renders null as italic "null"', () => {
    render(<CellRenderer value={null} />)
    const el = screen.getByText('null')
    expect(el).toBeInTheDocument()
    expect(el.className).toContain('italic')
  })

  it('renders undefined as italic "null"', () => {
    render(<CellRenderer value={undefined} />)
    const el = screen.getByText('null')
    expect(el).toBeInTheDocument()
  })

  it('renders boolean true', () => {
    render(<CellRenderer value={true} />)
    expect(screen.getByText('● true')).toBeInTheDocument()
  })

  it('renders boolean false', () => {
    render(<CellRenderer value={false} />)
    expect(screen.getByText('● false')).toBeInTheDocument()
  })

  it('renders number with locale formatting', () => {
    render(<CellRenderer value={1234} />)
    expect(screen.getByText('1,234')).toBeInTheDocument()
  })

  it('renders short string directly', () => {
    render(<CellRenderer value="hello" />)
    expect(screen.getByText('hello')).toBeInTheDocument()
  })

  it('truncates long string with ellipsis', () => {
    const long = 'a'.repeat(60)
    render(<CellRenderer value={long} />)
    expect(screen.getByText('a'.repeat(50) + '…')).toBeInTheDocument()
  })

  it('renders object as field count badge', () => {
    render(<CellRenderer value={{ a: 1, b: 2 }} />)
    expect(screen.getByText('{2 fields}')).toBeInTheDocument()
  })

  it('renders array as length badge', () => {
    render(<CellRenderer value={[1, 2, 3]} />)
    expect(screen.getByText('[3]')).toBeInTheDocument()
  })
})

describe('formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500 B')
  })
  it('formats kilobytes', () => {
    expect(formatFileSize(1536)).toBe('1.5 KB')
  })
  it('formats megabytes', () => {
    expect(formatFileSize(1572864)).toBe('1.5 MB')
  })
  it('formats gigabytes', () => {
    expect(formatFileSize(1610612736)).toBe('1.5 GB')
  })
})
