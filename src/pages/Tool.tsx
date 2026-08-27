import { useState } from 'react'
import { DropZone } from '../components/DropZone'
import { FileCard } from '../components/FileCard'
import { MetadataPanel } from '../components/MetadataPanel'
import { useBatchStore } from '../lib/batch/state'
import { MAX_FILE_COUNT, ANALYZE_CONCURRENCY } from '../lib/batch/types'
import {
  buildTransformedZip,
  downloadBlob,
  ZIP_FILENAME,
} from '../lib/zip'

/**
 * Wipefey workbench — upload, extract, inspect, clean, export.
 * Phase 1: upload + metadata extraction + display. Phase 2: AI-marker
 * heuristics. Phase 3: per-file transform. Phase 4: serial Transform-all
 * batch run + per-file download + Download-all-as-ZIP export.
 */
export function ToolPage() {
  const files = useBatchStore((s) => s.files)
  const selectedId = useBatchStore((s) => s.selectedId)
  const selectFile = useBatchStore((s) => s.selectFile)
  const removeFile = useBatchStore((s) => s.removeFile)
  const reset = useBatchStore((s) => s.reset)
  const transformAllSerial = useBatchStore((s) => s.transformAllSerial)
  const isTransformingAll = useBatchStore((s) => s.isTransformingAll)

  // Local UI state: ZIP packaging is a lib call, not store state (Phase 4).
  const [isZipping, setIsZipping] = useState(false)

  const selected = files.find((f) => f.id === selectedId) ?? files[0] ?? null
  const isAnalyzing = files.some(
    (f) => f.status === 'analyzing' || f.status === 'queued',
  )

  const analyzedCount = files.filter((f) => f.status === 'analyzed').length
  const transformedCount = files.filter((f) => f.status === 'transformed').length
  const isTransforming =
    isTransformingAll || files.some((f) => f.status === 'transforming')

  /** Bundle every transformed file into one ZIP and trigger the download. */
  const handleDownloadZip = async () => {
    const transformed = files.filter((f) => f.status === 'transformed')
    if (transformed.length === 0) return
    setIsZipping(true)
    try {
      const blob = await buildTransformedZip(transformed)
      downloadBlob(blob, ZIP_FILENAME)
    } catch (err) {
      console.error('ZIP packaging failed:', err)
    } finally {
      setIsZipping(false)
    }
  }

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
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-mono text-sm uppercase tracking-wide text-muted">
              Batch · {files.length} / {MAX_FILE_COUNT}
            </h2>
            <div className="flex items-center gap-2">
              {/* Phase 4: serial Transform-all — hidden at zero analyzed,
                  disabled while any transform is in flight. */}
              {analyzedCount > 0 && (
                <button
                  type="button"
                  disabled={isTransforming}
                  onClick={() => void transformAllSerial()}
                  className="rounded-wxs border border-border bg-surface-2 px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:border-border-strong hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isTransformingAll
                    ? 'transforming…'
                    : `transform all (${analyzedCount})`}
                </button>
              )}
              {/* Phase 4: ZIP export — hidden at zero transformed. */}
              {transformedCount > 0 && (
                <button
                  type="button"
                  disabled={isZipping}
                  onClick={() => void handleDownloadZip()}
                  className="rounded-wxs border border-border bg-surface-2 px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:border-border-strong hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isZipping
                    ? 'zipping…'
                    : `download all as zip (${transformedCount})`}
                </button>
              )}
              <button
                type="button"
                onClick={reset}
                className="rounded-wxs border border-border px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:border-border-strong hover:text-foreground"
              >
                clear all
              </button>
            </div>
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
                <div className="rounded-wsm border border-border bg-surface p-6 text-center font-mono text-sm text-muted">
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