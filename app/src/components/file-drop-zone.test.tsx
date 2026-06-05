import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FileDropZone } from './file-drop-zone'

describe('FileDropZone', () => {
  it('renders drop zone with file input', () => {
    render(<FileDropZone onFile={vi.fn()} />)
    expect(screen.getByText(/拖拽/i)).toBeInTheDocument()
    expect(screen.getByText(/选择文件/i)).toBeInTheDocument()
  })

  it('calls onFile when a file is selected via input', () => {
    const onFile = vi.fn()
    render(<FileDropZone onFile={onFile} />)
    const file = new File(['{"id":1}'], 'test.jsonl')
    const input = screen.getByLabelText(/选择文件/i) as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })
    expect(onFile).toHaveBeenCalledWith(file)
  })

  it('calls onFile when a file is dropped', () => {
    const onFile = vi.fn()
    render(<FileDropZone onFile={onFile} />)
    const file = new File(['{"id":1}'], 'test.jsonl')
    const dropZone = screen.getByText(/拖拽/i).closest('div')!
    const dropEvent = new Event('drop', { bubbles: true })
    Object.defineProperty(dropEvent, 'dataTransfer', { value: { files: [file] } })
    dropZone.dispatchEvent(dropEvent)
    expect(onFile).toHaveBeenCalledWith(file)
  })

  it('shows loading state', () => {
    render(<FileDropZone onFile={vi.fn()} loading />)
    expect(screen.getByText(/正在扫描/i)).toBeInTheDocument()
  })
})
