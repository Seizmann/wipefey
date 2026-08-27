import { Link } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { Seo } from '../seo/Seo'
import { getRouteMeta } from '../seo/meta'

/**
 * Landing page — what Wipefey does, why it matters (privacy: no server-side
 * storage), and a clear CTA to the tool. All copy is factual per
 * REQUIREMENT.md §1/§2 — no fabricated stats or claims.
 */

const FEATURES = [
  {
    title: 'See everything inside the file',
    body: 'EXIF, IPTC, XMP, ICC profile info, GPS coordinates, and PNG text chunks — parsed and displayed in full, right in your browser.',
  },
  {
    title: 'An honest AI-generation signal',
    body: 'A heuristic badge (Yes / Uncertain / No) based on known markers: Stable-Diffusion-style parameters, C2PA content credentials, AI-tool software tags. Heuristic, never proof.',
  },
  {
    title: 'One-click clean',
    body: 'Strips all existing metadata, then writes fresh metadata in its place: the current date and time, and the Wipefey stamp. The cleaned file is final — no original is kept.',
  },
  {
    title: 'Batch, then take it all with you',
    body: 'Drop up to 50 photos at once (25 MB each), clean them one by one or all at once, and download individually or as a single ZIP.',
  },
  {
    title: 'Private by design',
    body: 'Photos are processed locally and never uploaded or stored anywhere. The only server call Wipefey makes is a rate-limit check — no file data, ever.',
  },
  {
    title: 'Free and open source',
    body: 'MIT-licensed, from the RexiO family of personal-use tools, published by SpritexAI under its Open Source Tools collection.',
  },
]

export function HomePage() {
  const meta = getRouteMeta('/')
  return (
    <>
      <Seo path={meta.path} title={meta.title} description={meta.description} jsonLd />
      {/* Hero — the only place a gradient appears (DESIGN.md §1/§4). */}
      <section className="relative overflow-hidden">
        <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col items-start gap-6 py-24 md:py-36">
            <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted">
              <Logo size={14} />
              <span>by RexiO · free · open source (MIT)</span>
            </div>
            <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
              See the hidden metadata in your photos. Wipe it clean — in your
              browser.
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-muted md:text-lg">
              Wipefey inspects every EXIF, IPTC, XMP, GPS, and PNG chunk embedded
              in an image, gives you a best-effort signal on whether it looks
              AI-generated, then rewrites the file with only the current time and
              the Wipefey stamp. Your photos never leave your device.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/tool"
                className="rounded-wxs bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
              >
                Open the tool
              </Link>
              <Link
                to="/how-it-works"
                className="rounded-wxs border border-border bg-surface-2 px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-border-strong hover:bg-surface-3"
              >
                How it works
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 md:pb-32">
        <h2 className="max-w-2xl text-xl font-semibold tracking-tight md:text-2xl">
          One tool, three jobs: inspect, signal, clean.
        </h2>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-wsm border border-border bg-surface p-5 transition-colors hover:border-border-strong"
            >
              <h3 className="text-base font-medium text-foreground">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA band */}
      <section className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-16 sm:flex-row sm:items-center sm:justify-between sm:px-6 md:py-20">
          <div>
            <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
              What are your photos carrying?
            </h2>
            <p className="mt-2 max-w-xl text-sm text-muted">
              Drop a photo in and see for yourself — camera model, GPS
              coordinates, edit history, AI-generation markers. Nothing is
              uploaded to do it.
            </p>
          </div>
          <Link
            to="/tool"
            className="shrink-0 rounded-wxs bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            Open the tool
          </Link>
        </div>
      </section>
    </>
  )
}
