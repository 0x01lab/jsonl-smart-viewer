import { useState, useCallback, useRef } from 'react'
import { Button } from '~/components/ui/button'
import { Progress } from '~/components/ui/progress'

interface FileDropZoneProps {
  onFile: (file: File) => void
  loading?: boolean
  error?: string | null
}

export function FileDropZone({ onFile, loading, error }: FileDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) onFile(file)
    },
    [onFile],
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) onFile(file)
    },
    [onFile],
  )

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-lg font-medium text-foreground mb-6">
          JSONL Smart Viewer
        </h1>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`
            mx-auto max-w-md cursor-pointer rounded-xl border-2 p-8
            transition-colors duration-100
            ${isDragOver
              ? 'border-primary bg-accent border-solid'
              : 'border-border border-dashed'
            }
          `}
        >
          <p className="text-sm text-muted-foreground mb-4">
            Drop JSONL files here
          </p>

          <Button
            variant="default"
            className="h-9"
            onClick={(e) => {
              e.stopPropagation()
              inputRef.current?.click()
            }}
          >
            📂 Choose File
          </Button>

          <input
            ref={inputRef}
            type="file"
            accept=".jsonl,.json,.log,.jsonl.gz"
            onChange={handleInputChange}
            className="hidden"
            aria-label="Choose file"
          />
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Supported: .jsonl / .json / .jsonl.gz &nbsp;·&nbsp; 100% local parsing · Privacy first
        </p>

        {loading && (
          <div className="mt-6 max-w-xs mx-auto">
            <Progress value={null} className="h-1.5" />
            <p className="mt-2 text-xs text-muted-foreground">Scanning...</p>
          </div>
        )}

        {error && (
          <div className="mt-4 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
