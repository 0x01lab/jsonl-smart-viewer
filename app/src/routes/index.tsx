import { useState, useCallback } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { FileDropZone } from '~/components/file-drop-zone'
import { VirtualDataTable } from '~/components/virtual-data-table'
import { SchemaPanel } from '~/components/schema-panel'
import { Toolbar } from '~/components/toolbar'
import { StatusBar } from '~/components/status-bar'
import { useJsonlWorker } from '~/worker/use-jsonl-worker'
import { useTableState } from '~/hooks/use-table-state'
import { Toaster } from '~/components/ui/sonner'
import { toast } from 'sonner'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  const { status, fileInfo, fileId, error, loadFile, getRows, reset } =
    useJsonlWorker()
  const [file, setFile] = useState<File | null>(null)

  const columnIds = fileInfo
    ? fileInfo.schema.columns.map((c) => c.key)
    : []

  const {
    page,
    sorting,
    columnFilters,
    columnVisibility,
    columnOrder,
    selectedRowIndex,
    onPageChange,
    onSortingChange,
    onColumnFiltersChange,
    onColumnVisibilityChange,
    onColumnOrderChange,
    onSelectedRowChange,
  } = useTableState({ columnIds })

  const handleFile = useCallback(
    async (newFile: File) => {
      setFile(newFile)
      onSelectedRowChange(null)

      try {
        await loadFile(newFile)
        toast.success('文件加载完成')
      } catch (err) {
        toast.error(
          `加载失败: ${err instanceof Error ? err.message : '未知错误'}`,
        )
      }
    },
    [loadFile, onSelectedRowChange],
  )

  const handleReset = useCallback(() => {
    reset()
    setFile(null)
  }, [reset])

  const handleVisibilityChange = useCallback(
    (columnId: string, visible: boolean) => {
      onColumnVisibilityChange((prev) => ({
        ...prev,
        [columnId]: visible,
      }))
    },
    [onColumnVisibilityChange],
  )

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
      <div className="flex h-screen flex-col">
        <Toolbar
          fileName={file?.name ?? 'unknown.jsonl'}
          fileSize={file?.size ?? 0}
          columnCount={fileInfo.schema.columns.length}
          onReset={handleReset}
        />

        <div className="flex flex-1 overflow-hidden">
          <SchemaPanel
            columns={fileInfo.schema.columns}
            columnVisibility={columnVisibility}
            columnOrder={columnOrder}
            onVisibilityChange={handleVisibilityChange}
            onOrderChange={onColumnOrderChange}
          />

          <VirtualDataTable
            schema={fileInfo.schema}
            totalRows={fileInfo.totalRows}
            fileId={fileId!}
            page={page}
            getRows={getRows}
            sorting={sorting}
            columnFilters={columnFilters}
            columnVisibility={columnVisibility}
            columnOrder={columnOrder}
            selectedRowIndex={selectedRowIndex}
            onSortingChange={onSortingChange}
            onColumnFiltersChange={onColumnFiltersChange}
            onColumnVisibilityChange={onColumnVisibilityChange}
            onColumnOrderChange={onColumnOrderChange}
            onSelectedRowChange={onSelectedRowChange}
          />
        </div>

        <StatusBar
          totalRows={fileInfo.totalRows}
          errorRows={fileInfo.errorRows}
          page={page}
          selectedRowIndex={selectedRowIndex}
          onPageChange={onPageChange}
        />
      </div>
    </>
  )
}
