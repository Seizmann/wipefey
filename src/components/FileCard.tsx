import type { BatchFile, FileStatus } from '../lib/batch/types'
import { formatBytes } from '../lib/batch/reducer'
import { useBatchStore } from '../lib/batch/state'
import { downloadTransformedFile } from '../lib/zip'

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<FileStatus, string> = {
  queued: 'queued',
  analyzing: 'analyzing',
  analyzed: 'analyzed',
  error: 'error',
  transforming: 'cleaning',
  transformed: 'cleaned',
  'transform-error': 'failed',
}

function StatusBadge({ status }: { status: FileStatus }) {
  let dot = 'bg-faint'
  let text = 'text-muted'
  if (status === 'analyzing' || status === 'transforming') {
    dot = 'bg-accent'
    text = 'text-accent'
  } else if (status === 'analyzed') {
    dot = 'bg-clean'
    text = 'text-clean'
  } else if (status === 'transformed') {
    dot = 'bg-clean'
    text = 'text-clean'
  } else if (status === 'error' || status === 'transform-error') {
    dot = 'bg-ai'
    text = 'text-ai'
  }
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide ${text}`}>
      <span className={`size-2 rounded-full ${dot}`} aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      aria-hidden
      className="size-3.5 animate-spin text-accent"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"
      />
    </svg>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  file: BatchFile
  selected: boolean
  onSelect: (id: string) => void
  onRemove: (id: string) => void
}

/**
 * Card per accepted file: thumbnail, filename, size, status badge.
 * Phase 3: adds Transform button (analyzed), cleaning spinner (transforming),
 * Cleaned label + transformed preview thumbnail (transformed), and error state.
 */
export function FileCard({ file, selected, onSelect, onRemove }: Props) {
  const triggerTransform = useBatchStore((s) => s.triggerTransform)

  // Determine which thumbnail to show: prefer the transformed preview when
  // available, fall back to the original thumbnail.
  const displayThumb = file.transformedThumbUrl ?? file.thumbUrl

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(file.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(file.id)
        }
      }}
      className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-[8px] border bg-surface transition-colors ${
        selected ? 'border-accent' : 'border-border hover:border-border-strong'
      }`}
    >
      {/* Thumbnail */}
      <div className="relative aspect-square w-full overflow-hidden bg-surface-2">
        {displayThumb ? (
          <img src={displayThumb} alt={file.file.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-mono text-xs text-faint">
            …
          </div>
        )}

        {/* Transforming overlay: spinner centered over the thumbnail */}
        {file.status === 'transforming' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Spinner />
          </div>
        )}

        {/* Analysis error overlay */}
        {file.status === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 font-mono text-xs text-ai">
            failed
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex items-center justify-between gap-2 p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-xs text-foreground" title={file.file.name}>
            {file.file.name}
          </p>
          <p className="font-mono text-[11px] text-faint">{formatBytes(file.file.size)}</p>
        </div>
        <StatusBadge status={file.status} />
      </div>

      {/* Phase 3: Transform button — only visible when analyzed */}
      {file.status === 'analyzed' && (
        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              void triggerTransform(file.id)
            }}
            className="w-full rounded-[6px] border border-border bg-surface-2 px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:border-border-strong hover:bg-surface-3"
          >
            Transform
          </button>
        </div>
      )}

      {/* Phase 3: Transforming label */}
      {file.status === 'transforming' && (
        <div className="px-3 pb-3">
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted">
            <Spinner />
            Cleaning…
          </div>
        </div>
      )}

      {/* Phase 3: Cleaned confirmation + optional note */}
      {file.status === 'transformed' && (
        <div className="px-3 pb-3">
          <p className="font-mono text-[11px] text-clean">✓ Metadata stripped &amp; rewritten</p>
          {file.transformNote && (
            <p className="mt-0.5 font-mono text-[10px] text-muted">{file.transformNote}</p>
          )}
          {/* Phase 4: real browser download of the stored transformed blob,
              named per the format contract (e.g. photo.heic → photo.jpg). */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              downloadTransformedFile(file)
            }}
            className="mt-2 w-full rounded-[6px] border border-border bg-surface-2 px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:border-border-strong hover:bg-surface-3"
          >
            Download
          </button>
        </div>
      )}

      {/* Remove */}
      <button
        type="button"
        aria-label={`Remove ${file.file.name}`}
        onClick={(e) => {
          e.stopPropagation()
          onRemove(file.id)
        }}
        className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-black/60 font-mono text-xs text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
      >
        ✕
      </button>

      {/* Inline error / note (analysis) */}
      {(file.error || file.note) && (
        <p className="px-3 pb-2 font-mono text-[11px] text-ai">{file.error ?? file.note}</p>
      )}

      {/* Inline transform error */}
      {file.status === 'transform-error' && file.transformError && (
        <p className="px-3 pb-2 font-mono text-[11px] text-ai">{file.transformError}</p>
      )}

      {/* Phase 5: rate-limit policy block — status stays 'analyzed' so the
          Transform button remains for a retry once the window resets. */}
      {file.rateLimit && (
        <p className="px-3 pb-2 font-mono text-[11px] text-unsure">{file.rateLimit.message}</p>
      )}
    </div>
  )
}
