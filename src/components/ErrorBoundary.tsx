import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * App-level render guard. Without this a thrown error anywhere in the tree
 * unmounts the whole app and leaves a blank page — no message, no way back.
 *
 * Deliberately minimal: no error reporting (Wipefey ships no analytics), no
 * retry-in-place (state may be inconsistent after a parse/transform crash —
 * a reload is the honest recovery). Photos never leave the browser, so the
 * error text is safe to show as-is.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  override render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-4">
        <div className="w-full max-w-md rounded-wsm border border-border bg-surface p-6">
          <div className="flex items-center gap-2.5">
            <span aria-hidden className="size-2 shrink-0 rounded-full bg-ai" />
            <h1 className="font-mono text-sm font-medium text-foreground">
              Something went wrong
            </h1>
          </div>

          <p className="mt-3 text-sm text-muted">
            Wipefey hit an unexpected error and stopped. Nothing was uploaded;
            your photos never left this device. Reloading starts a clean session.
          </p>

          <pre className="mt-4 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-wxs bg-surface-2 px-3 py-2 font-mono text-xs text-muted">
            {error.message || String(error)}
          </pre>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-wxs border border-border bg-surface-2 px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:border-border-strong hover:bg-surface-3"
          >
            reload wipefey
          </button>
        </div>
      </div>
    )
  }
}
