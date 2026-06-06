import { useState, useCallback } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { FileDropZone } from '~/components/file-drop-zone'
import { VirtualDataTable } from '~/components/virtual-data-table'
import { SchemaPanel } from '~/components/schema-panel'
import { Toolbar } from '~/components/toolbar'
import { StatusBar } from '~/components/status-bar'
import { DetailPanel } from '~/components/detail-panel'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '~/components/ui/resizable'
import { useJsonlWorker } from '~/worker/use-jsonl-worker'
import { useTableState } from '~/hooks/use-table-state'
import { Toaster } from '~/components/ui/sonner'
import { toast } from 'sonner'
import type { Layout } from 'react-resizable-panels'
import type { WasmColumnDef } from '~/types/wasm'

const DETAIL_LAYOUT_KEY = 'jsonl-detail-split-layout'

function loadSavedLayout(): Layout | undefined {
  try {
    const raw = localStorage.getItem(DETAIL_LAYOUT_KEY)
    return raw ? JSON.parse(raw) : undefined
  } catch {
    return undefined
  }
}

/** Child component — only rendered client-side after file is loaded */
function DetailPanelContent({
  fileId,
  selectedRow,
  columns,
  getRows,
  onClose,
}: {
  fileId: string
  selectedRow: number
  columns: WasmColumnDef[]
  getRows: (start: number, end: number) => Promise<import('~/types/wasm').WasmRow[]>
  onClose: () => void
}) {
  const { data: selectedRowData } = useQuery({
    queryKey: ['detail-row', fileId, selectedRow],
    queryFn: () => getRows(selectedRow, selectedRow + 1).then((r) => r[0]),
    enabled: !!fileId,
    staleTime: Infinity,
  })

  if (!selectedRowData) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Loading...
      </div>
    )
  }

  return (
    <DetailPanel
      row={selectedRowData}
      columns={columns}
      onClose={onClose}
    />
  )
}

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  const { status, fileInfo, fileId, error, loadFile, getRows, reset } =
    useJsonlWorker()
  const [file, setFile] = useState<File | null>(null)
  const [selectedRow, setSelectedRow] = useState<number | null>(null)
  const [detailPanelOpen, setDetailPanelOpen] = useState(false)

  const columnIds = fileInfo
    ? fileInfo.schema.columns.map((c) => c.key)
    : []

  const {
    page,
    columnVisibility,
    columnOrder,
    onPageChange,
    onColumnVisibilityChange,
    onColumnOrderChange,
  } = useTableState({ columnIds })

  const handleLayoutChanged = useCallback((layout: Layout) => {
    try {
      localStorage.setItem(DETAIL_LAYOUT_KEY, JSON.stringify(layout))
    } catch {
      // ignore storage errors
    }
  }, [])

  const handleFile = useCallback(
    async (newFile: File) => {
      setFile(newFile)
      setSelectedRow(null)
      setDetailPanelOpen(false)

      try {
        await loadFile(newFile)
        toast.success('File loaded successfully')
      } catch (err) {
        toast.error(
          `Load failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        )
      }
    },
    [loadFile],
  )

  const handleReset = useCallback(() => {
    reset()
    setFile(null)
    setSelectedRow(null)
    setDetailPanelOpen(false)
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

  const handlePageChange = useCallback(
    (newPage: number) => {
      onPageChange(newPage)
      setSelectedRow(null)
      setDetailPanelOpen(false)
    },
    [onPageChange],
  )

  const handleSelectedRowChange = useCallback((index: number | null) => {
    setSelectedRow(index)
    if (index !== null) {
      setDetailPanelOpen(true)
    }
  }, [])

  const handleCloseDetailPanel = useCallback(() => {
    setDetailPanelOpen(false)
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

  const tableProps = {
    schema: fileInfo.schema,
    totalRows: fileInfo.totalRows,
    fileId: fileId!,
    page,
    getRows,
    columnVisibility,
    columnOrder,
    selectedRowIndex: selectedRow,
    onColumnVisibilityChange,
    onColumnOrderChange,
    onSelectedRowChange: handleSelectedRowChange,
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

          {detailPanelOpen && selectedRow !== null ? (
            <ResizablePanelGroup
              id="detail-split"
              orientation="vertical"
              defaultLayout={loadSavedLayout()}
              onLayoutChanged={handleLayoutChanged}
            >
              <ResizablePanel id="table" defaultSize="60%" minSize="30%">
                <VirtualDataTable {...tableProps} />
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel id="detail" defaultSize="40%" minSize="15%" collapsible>
                <DetailPanelContent
                  fileId={fileId!}
                  selectedRow={selectedRow}
                  columns={fileInfo.schema.columns}
                  getRows={getRows}
                  onClose={handleCloseDetailPanel}
                />
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : (
            <VirtualDataTable {...tableProps} />
          )}
        </div>

        <StatusBar
          totalRows={fileInfo.totalRows}
          errorRows={fileInfo.errorRows}
          page={page}
          selectedRowIndex={selectedRow}
          onPageChange={handlePageChange}
        />
      </div>
    </>
  )
}
