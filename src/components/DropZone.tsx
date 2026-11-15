import { useDropzone } from '../hooks/useDropzone'
import { useBatchStore } from '../lib/batch/state'
import { MAX_FILE_COUNT, MAX_FILE_SIZE } from '../lib/batch/types'
import { formatBytes } from '../lib/batch/reducer'
import { Logo } from './Logo'

/**
 * Upload zone: drag-and-drop + click-to-browse. Per-file validation happens
 * in the batch reducer; rejected files surface here as specific messages.
 */
export function DropZone() {
  const { inputRef, isDragging, onDrop, onDragEnter, onDragLeave, onDragOver, openPicker, process } =
    useDropzone()
  const rejections = useBatchStore((s) => s.rejections)
  const dismissRejections = useBatchStore((s) => s.dismissRejections)
  const count = useBatchStore((s) => s.files.length)

  return (
    <div className="w-full">
      <div
        role="button"
        tabIndex={0}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openPicker()
          }
        }}
        onDrop={onDrop}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        className={`flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-3 rounded-wmd border-2 border-dashed px-6 py-10 text-center transition-colors ${
          isDragging
            ? 'border-accent bg-accent-muted'
            : 'border-border bg-surface hover:border-border-strong active:bg-surface-2'
        }`}
      >
        <Logo size={28} className="text-faint" decorative />
        <p className="text-sm font-medium text-foreground">
          Drop photos here, or <span className="text-accent">browse</span>
        </p>
        <p className="max-w-md text-pretty font-mono text-xs text-muted">
          JPEG, PNG, WebP or HEIC, up to {MAX_FILE_COUNT} files of {formatBytes(MAX_FILE_SIZE)} each
        </p>
        <p className="font-mono text-[11px] text-faint">
          Processed entirely in your browser. Nothing is uploaded.
        </p>
      </div>

      {/* hidden input (click-to-browse) */}
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        className="hidden"
        onChange={(e) => {
          process(e.target.files)
          e.target.value = '' // allow re-selecting the same file
        }}
      />

      {/* rejection messages */}
      {rejections.length > 0 && (
        <div className="mt-4 rounded-wsm border border-ai/30 bg-surface p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">
              {rejections.length} file{rejections.length === 1 ? '' : 's'} skipped
            </p>
            <button
              type="button"
              onClick={dismissRejections}
              className="font-mono text-xs text-muted hover:text-foreground"
            >
              dismiss
            </button>
          </div>
          <ul className="mt-2 space-y-1.5">
            {rejections.map((r, i) => (
              <li key={i} className="flex gap-2 text-xs">
                <span className="shrink-0 font-mono text-ai">✕</span>
                <span className="min-w-0">
                  <span className="font-medium text-foreground">{r.name}</span>
                  <span className="text-muted">: {r.reason}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {count > 0 && (
        <p className="mt-3 font-mono text-xs text-muted">
          {count} / {MAX_FILE_COUNT} in this batch
        </p>
      )}
    </div>
  )
}
