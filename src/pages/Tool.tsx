/**
 * The Wipefey workbench. Phase 0 placeholder — upload, metadata extraction,
 * AI-marker heuristic, transform, and download are wired in Phases 1–4.
 */
export function ToolPage() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-20 sm:px-6 md:py-28">
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
        Photo workbench
      </h1>
      <p className="mt-3 max-w-2xl text-muted">
        Upload images to inspect their metadata and clean them. This is the
        placeholder shell — the drop zone and analysis pipeline land in the
        next build phases.
      </p>
      <div className="mt-10 flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-border bg-surface font-mono text-sm text-faint">
        Drop zone coming in Phase 1
      </div>
    </section>
  )
}
