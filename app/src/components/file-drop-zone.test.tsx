import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FileDropZone } from './file-drop-zone'

describe('FileDropZone', () => {
  it('renders drop zone with file input', () => {
    render(<FileDropZone onFile={vi.fn()} />)
    expect(screen.getByText(/drop/i)).toBeInTheDocument()
    expect(screen.getByText(/choose file/i)).toBeInTheDocument()
  })

  it('calls onFile when a file is selected via input', () => {
    const onFile = vi.fn()
    render(<FileDropZone onFile={onFile} />)
    const file = new File(['{"id":1}'], 'test.jsonl')
    const input = screen.getByLabelText(/choose file/i) as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })
    expect(onFile).toHaveBeenCalledWith(file)
  })

  it('calls onFile when a file is dropped', () => {
    const onFile = vi.fn()
    render(<FileDropZone onFile={onFile} />)
    const file = new File(['{"id":1}'], 'test.jsonl')
    const dropZone = screen.getByText(/drop/i).closest('div')!
    const dropEvent = new Event('drop', { bubbles: true })
    Object.defineProperty(dropEvent, 'dataTransfer', { value: { files: [file] } })
    dropZone.dispatchEvent(dropEvent)
    expect(onFile).toHaveBeenCalledWith(file)
  })

  it('shows loading state', () => {
    render(<FileDropZone onFile={vi.fn()} loading />)
    expect(screen.getByText(/scanning/i)).toBeInTheDocument()
  })
})
