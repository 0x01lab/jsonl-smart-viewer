import { useState, useEffect, useCallback } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { FileDropZone } from '~/components/file-drop-zone'
import { DataTable } from '~/components/data-table'
import { useJsonlWorker } from '~/worker/use-jsonl-worker'
import { Toaster, toast } from '~/components/ui/sonner'
import type { WasmRow } from '~/types/wasm'

export const Route = createFileRoute('/')({
  component: HomePage,
})

const PAGE_SIZE = 100

function HomePage() {
  const { status, fileInfo, error, loadFile, getRows, reset } = useJsonlWorker()
  const [file, setFile] = useState<File | null>(null)
  const [rows, setRows] = useState<WasmRow[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedRow, setSelectedRow] = useState<number | null>(null)

  // Load rows when page changes or file is first loaded
  useEffect(() => {
    if (status !== 'ready' || !file || !fileInfo) return

    const start = (currentPage - 1) * PAGE_SIZE
    const end = Math.min(start + PAGE_SIZE, fileInfo.totalRows)

    getRows(start, end).then(setRows).catch((err) => {
      toast.error(`加载行数据失败: ${err.message}`)
    })
  }, [status, file, fileInfo, currentPage, getRows])

  const handleFile = useCallback(
    async (newFile: File) => {
      setFile(newFile)
      setCurrentPage(1)
      setSelectedRow(null)
      setRows([])

      try {
        await loadFile(newFile)
        toast.success('文件加载完成')
      } catch (err) {
        toast.error(
          `加载失败: ${err instanceof Error ? err.message : '未知错误'}`,
        )
      }
    },
    [loadFile],
  )

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
    setSelectedRow(null)
  }, [])

  const handleRowSelect = useCallback((index: number | null) => {
    setSelectedRow(index)
  }, [])

  if (status !== 'ready' || !fileInfo) {
    return (
      <>
        <Toaster />
        <FileDropZone
          onFile={handleFile}
          loading={status === 'loading'}
          error={status === 'error' ? error : null}
        />
      </>
    )
  }

  return (
    <>
      <Toaster />
      <DataTable
        schema={fileInfo.schema}
        rows={rows}
        totalRows={fileInfo.totalRows}
        errorRows={fileInfo.errorRows}
        fileName={file?.name ?? 'unknown.jsonl'}
        fileSize={file?.size ?? 0}
        currentPage={currentPage}
        pageSize={PAGE_SIZE}
        selectedRowIndex={selectedRow}
        onPageChange={handlePageChange}
        onRowSelect={handleRowSelect}
      />
    </>
  )
}
