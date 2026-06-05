import { wrap, type Remote } from 'comlink'
import { useState, useRef, useCallback } from 'react'
import type { WasmSchemaResult, WasmRow } from '~/types/wasm'
import type { WorkerApi } from './jsonl.worker'

export type WorkerStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface FileInfo {
  totalRows: number
  errorRows: number
  schema: WasmSchemaResult
}

export function useJsonlWorker() {
  const workerRef = useRef<Worker | null>(null)
  const apiRef = useRef<Remote<WorkerApi> | null>(null)
  const [status, setStatus] = useState<WorkerStatus>('idle')
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadFile = useCallback(async (file: File) => {
    setStatus('loading')
    setError(null)

    try {
      if (!workerRef.current) {
        const worker = new Worker(
          new URL('./jsonl.worker.ts', import.meta.url),
          { type: 'module' },
        )
        workerRef.current = worker
        apiRef.current = wrap<WorkerApi>(worker)
      }

      const result = await apiRef.current!.initFile(file)
      setFileInfo({
        totalRows: result.total_rows,
        errorRows: result.error_rows,
        schema: result,
      })
      setStatus('ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      setStatus('error')
    }
  }, [])

  const getRows = useCallback(
    async (start: number, end: number): Promise<WasmRow[]> => {
      if (!apiRef.current) throw new Error('Worker not initialized')
      return apiRef.current.getRows(start, end)
    },
    [],
  )

  const reset = useCallback(() => {
    workerRef.current?.terminate()
    workerRef.current = null
    apiRef.current = null
    setStatus('idle')
    setFileInfo(null)
    setError(null)
  }, [])

  return { status, fileInfo, error, loadFile, getRows, reset } as const
}
