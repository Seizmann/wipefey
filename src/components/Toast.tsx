import { useToastStore } from '../lib/toast'

/**
 * Minimal toast host (Phase 5) — renders the single current toast, if any.
 * Mounted once in Layout. Tone dot reuses the status color tokens
 * (warn = amber `unsure`, info = emerald `clean`), same as FileCard badges.
 */
export function Toasts() {
  const toast = useToastStore((s) => s.toast)
  const dismiss = useToastStore((s) => s.dismiss)
  if (!toast) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 z-50 w-max max-w-[min(90vw,32rem)] -translate-x-1/2"
    >
      <div className="flex items-center gap-2.5 rounded-wsm border border-border bg-surface px-4 py-2.5 shadow-[var(--w-shadow-md)]">
        <span
          aria-hidden
          className={`size-2 shrink-0 rounded-full ${
            toast.tone === 'warn' ? 'bg-unsure' : 'bg-clean'
          }`}
        />
        <p className="font-mono text-xs text-foreground">{toast.message}</p>
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={dismiss}
          className="ml-1 shrink-0 font-mono text-xs text-muted transition-colors hover:text-foreground"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
