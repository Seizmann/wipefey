import { Link } from 'react-router-dom'
import { Logo } from '../components/Logo'

/**
 * Landing page — Phase 0 shell. Copy/SEO finalized in later phases; this is
 * the placeholder home route so the app renders a real page at `/`.
 */
export function HomePage() {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="flex flex-col items-start gap-6 py-24 md:py-36">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted">
          <Logo size={14} />
          <span>by RexiO · open source tool</span>
        </div>
        <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
          See the hidden metadata in your photos. Wipe it clean — in your
          browser.
        </h1>
        <p className="max-w-2xl text-base text-muted md:text-lg">
          Wipefey inspects every EXIF, IPTC, XMP, GPS, and PNG chunk embedded in
          an image, signals whether it looks AI-generated, then rewrites the file
          with only the current time and the Wipefey stamp. Your photos never
          leave your device.
        </p>
        <div className="flex gap-3">
          <Link
            to="/tool"
            className="rounded-[6px] bg-accent px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Open the tool
          </Link>
          <Link
            to="/how-it-works"
            className="rounded-[6px] border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-border-strong"
          >
            How it works
          </Link>
        </div>
      </div>
    </section>
  )
}
