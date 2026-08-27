import type { BatchFile, FileStatus } from '../lib/batch/types'
import { formatBytes } from '../lib/batch/reducer'

const STATUS_LABEL: Record<FileStatus, string> = {
  queued: 'queued',
  analyzing: 'analyzing',
  analyzed: 'analyzed',
  error: 'error',
}

function StatusBadge({ status }: { status: FileStatus }) {
  let dot = 'bg-faint'
  let text = 'text-muted'
  if (status === 'analyzing') {
    dot = 'bg-accent'
    text = 'text-accent'
  } else if (status === 'analyzed') {
    dot = 'bg-clean'
    text = 'text-clean'
  } else if (status === 'error') {
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

interface Props {
  file: BatchFile
  selected: boolean
  onSelect: (id: string) => void
  onRemove: (id: string) => void
}

/**
 * Card per accepted file: thumbnail, filename, size, status badge.
 * Clicking selects it for the MetadataPanel.
 */
export function FileCard({ file, selected, onSelect, onRemove }: Props) {
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
        {file.thumbUrl ? (
          <img src={file.thumbUrl} alt={file.file.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-mono text-xs text-faint">
            …
          </div>
        )}
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

      {/* Inline error / note */}
      {(file.error || file.note) && (
        <p className="px-3 pb-2 font-mono text-[11px] text-ai">{file.error ?? file.note}</p>
      )}
    </div>
  )
}
