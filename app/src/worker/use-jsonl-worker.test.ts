import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useJsonlWorker } from './use-jsonl-worker'

// Create a stable mock fn for wrap so tests can re-configure it
const mockWrap = vi.fn()

// Mock Comlink — wrap returns a plain object as the proxy
vi.mock('comlink', () => ({
  wrap: (...args: unknown[]) => mockWrap(...args),
}))

// Mock Worker constructor so jsdom doesn't try to load a real file
const mockWorkerInstance = {
  terminate: vi.fn(),
  postMessage: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}
vi.stubGlobal(
  'Worker',
  vi.fn(() => mockWorkerInstance),
)

const defaultApi = {
  initFile: vi.fn().mockResolvedValue({
    columns: [
      { key: 'id', depth: 0, inferred_type: 'Number', nullable: false },
      { key: 'name', depth: 0, inferred_type: 'String', nullable: true },
    ],
    total_rows: 100,
    error_rows: 0,
  }),
  getRows: vi.fn().mockResolvedValue([
    { index: 0, data: { id: 1, name: 'Alice' } },
    { index: 1, data: { id: 2, name: null } },
  ]),
}

describe('useJsonlWorker', () => {
  beforeEach(() => {
    mockWrap.mockReturnValue(defaultApi)
  })

  it('starts in idle state', () => {
    const { result } = renderHook(() => useJsonlWorker())
    expect(result.current.status).toBe('idle')
    expect(result.current.fileInfo).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('transitions idle → loading → ready on loadFile', async () => {
    const { result } = renderHook(() => useJsonlWorker())
    const file = new File(['{"id":1}\n{"id":2}\n'], 'test.jsonl', {
      type: 'application/jsonl',
    })

    await act(async () => {
      await result.current.loadFile(file)
    })

    expect(result.current.status).toBe('ready')
    expect(result.current.fileInfo).not.toBeNull()
    expect(result.current.fileInfo!.totalRows).toBe(100)
  })

  it('transitions to error on loadFile failure', async () => {
    mockWrap.mockReturnValueOnce({
      initFile: vi.fn().mockRejectedValue(new Error('WASM init failed')),
      getRows: vi.fn(),
    })

    const { result } = renderHook(() => useJsonlWorker())
    const file = new File(['bad'], 'bad.jsonl')

    await act(async () => {
      await result.current.loadFile(file)
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('WASM init failed')
  })

  it('resets to idle state', async () => {
    const { result } = renderHook(() => useJsonlWorker())

    const file = new File(['{"id":1}\n'], 'test.jsonl')
    await act(async () => {
      await result.current.loadFile(file)
    })
    expect(result.current.status).toBe('ready')

    act(() => {
      result.current.reset()
    })

    expect(result.current.status).toBe('idle')
    expect(result.current.fileInfo).toBeNull()
  })
})
