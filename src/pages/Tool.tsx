import { DropZone } from '../components/DropZone'
import { FileCard } from '../components/FileCard'
import { MetadataPanel } from '../components/MetadataPanel'
import { useBatchStore } from '../lib/batch/state'
import { MAX_FILE_COUNT, ANALYZE_CONCURRENCY } from '../lib/batch/types'

/**
 * Wipefey workbench — upload, extract, inspect.
 * Phase 1: upload + metadata extraction + display. AI-marker heuristics
 * (Phase 2), transform (Phase 3/4) and export (Phase 4) are wired in later.
 */
export function ToolPage() {
  const files = useBatchStore((s) => s.files)
  const selectedId = useBatchStore((s) => s.selectedId)
  const selectFile = useBatchStore((s) => s.selectFile)
  const removeFile = useBatchStore((s) => s.removeFile)
  const reset = useBatchStore((s) => s.reset)

  const selected = files.find((f) => f.id === selectedId) ?? files[0] ?? null
  const isAnalyzing = files.some(
    (f) => f.status === 'analyzing' || f.status === 'queued',
  )

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="font-mono text-2xl font-semibold text-foreground">
          Inspect your photos
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Drop photos to see the metadata hiding inside them — camera model,
          GPS coordinates, edit dates, software tags and embedded text chunks.
          Everything runs locally in your browser.
        </p>
      </header>

      <DropZone />

      {files.length > 0 && (
        <div className="mt-8">
          {/* Batch action bar */}
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-mono text-sm uppercase tracking-wide text-muted">
              Batch · {files.length} / {MAX_FILE_COUNT}
            </h2>
            <button
              type="button"
              onClick={reset}
              className="rounded-[6px] border border-border px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:border-border-strong hover:text-foreground"
            >
              clear all
            </button>
          </div>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {/* File grid */}
            <div>
              {isAnalyzing && (
                <p className="mb-3 font-mono text-xs text-faint">
                  analyzing… up to {ANALYZE_CONCURRENCY} files at a time
                </p>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {files.map((f) => (
                  <FileCard
                    key={f.id}
                    file={f}
                    selected={f.id === selectedId}
                    onSelect={selectFile}
                    onRemove={removeFile}
                  />
                ))}
              </div>
            </div>

            {/* Metadata detail */}
            <div className="lg:sticky lg:top-24 lg:self-start">
              {selected ? (
                <MetadataPanel file={selected} />
              ) : (
                <div className="rounded-[8px] border border-border bg-surface p-6 text-center font-mono text-sm text-muted">
                  Select an analyzed file to see its metadata.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}