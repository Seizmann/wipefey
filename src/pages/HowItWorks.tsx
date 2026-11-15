import { Link } from 'react-router-dom'
import { Seo } from '../seo/Seo'
import { getRouteMeta } from '../seo/meta'

/**
 * How it works — the real pipeline (upload → extract → heuristic → transform →
 * download), written honestly. The AI-signal section deliberately mirrors the
 * Phase-2 caveat language from src/lib/ai-heuristics/rules.ts — never
 * certainty wording, always "heuristic, not proof".
 */

const STEPS = [
  {
    n: '01',
    title: 'Upload',
    body: 'Drag and drop photos or browse for them: JPEG, PNG, WebP, and HEIC/HEIF (best-effort). Up to 50 files per batch, 25 MB each. The files are opened with the browser File API and stay on your machine.',
  },
  {
    n: '02',
    title: 'Inspect',
    body: 'Wipefey reads and displays all available metadata per file: EXIF (camera make and model, timestamps, GPS, exposure, software tag), IPTC, XMP, ICC profile info, and PNG tEXt/iTXt/zTXt text chunks, which is where many AI tools leave their traces.',
  },
  {
    n: '03',
    title: 'The AI-generation signal',
    body: 'A heuristic checks the metadata for known AI-generation markers (prompt/parameter text chunks, C2PA content-credential blocks, software tags matching known AI tools) and shows a badge: Yes, Uncertain, or No, with the literal matched tags listed as raw evidence.',
  },
  {
    n: '04',
    title: 'Clean (transform)',
    body: 'One click strips all existing metadata by re-encoding the image on a canvas, verifies the strip by re-reading the result, then writes fresh metadata: the current date and time, and the Software tag “Wipefey by RexiO”. Same format in, same format out; the one exception is HEIC, which becomes JPEG because browsers cannot encode HEIC. There is no undo: the cleaned file is final and the original is discarded.',
  },
  {
    n: '05',
    title: 'Download',
    body: 'Download each cleaned file individually, or grab the whole batch as one ZIP. Nothing downloads automatically; you always take the action.',
  },
]

export function HowItWorksPage() {
  const meta = getRouteMeta('/how-it-works')
  return (
    <>
      <header className="mx-auto max-w-3xl px-4 pt-20 pb-20 sm:px-6 md:pt-28">
        <Seo path={meta.path} title={meta.title} description={meta.description} />
        <h1 className="min-w-0 text-balance text-3xl font-semibold tracking-tight wrap-break-word md:text-4xl">
          How it works
        </h1>
        <p className="mt-4 max-w-[55ch] text-pretty text-base leading-relaxed text-muted">
          The whole metadata pipeline, step by step, inside your browser.
        </p>
      </header>

      <section className="mx-auto max-w-3xl px-4 pb-20 sm:px-6 md:pb-28">
      <ol className="border-t border-border">
        {STEPS.map((s) => (
          <li
            key={s.n}
            className="grid gap-2 border-b border-border py-8 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:gap-8"
          >
            <span
              className="tnum shrink-0 font-mono text-2xl leading-none text-faint"
              aria-hidden
            >
              {s.n}
            </span>
            <div className="min-w-0">
              <h2 className="text-balance text-xl font-semibold tracking-tight md:text-2xl">
                {s.title}
              </h2>
              <p className="mt-2 max-w-[55ch] text-pretty text-sm leading-relaxed text-muted">
                {s.body}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-12 grid gap-4 md:grid-cols-2">
        {/* Honesty section — mirrors rules.ts caveat copy in tone, not verbatim. */}
        <div className="rounded-wsm border border-border bg-surface p-6">
          <h2 className="text-balance text-xl font-semibold tracking-tight md:text-2xl">
            About the AI signal: heuristic, not proof
          </h2>
          <p className="mt-3 text-pretty text-sm leading-relaxed text-muted">
            A <strong className="font-medium text-foreground">Yes</strong> badge
            means known machine-generation markers were found in the metadata:
            strong indicators of AI generation, not forensic proof. A human
            could have written those tags manually, and a sophisticated
            pipeline could strip them.
          </p>
          <p className="mt-3 text-pretty text-sm leading-relaxed text-muted">
            A <strong className="font-medium text-foreground">No</strong> badge
            means no markers were found, and that does not mean the image is
            real. Most AI tools strip their metadata before export, so absence
            of markers is not evidence of anything. When the result is unclear,
            you get{' '}
            <strong className="font-medium text-foreground">Uncertain</strong>{' '}
            rather than a guess.
          </p>
        </div>

        {/* Rate limit — factual per REQUIREMENT.md §5.5. */}
        <div className="rounded-wsm border border-border bg-surface p-6">
          <h2 className="text-balance text-xl font-semibold tracking-tight md:text-2xl">
            Why there is a rate limit
          </h2>
          <p className="mt-3 text-pretty text-sm leading-relaxed text-muted">
            Cleaning is free and unlimited in capability, but each transform is
            gated by a light rate limit (about 10 per hour, per IP) so the tool
            can’t be trivially hammered. That check is the only server contact
            Wipefey makes; see the{' '}
            <Link
              to="/privacy"
              className="text-accent transition-colors hover:text-accent-hover"
            >
              privacy page
            </Link>{' '}
            for exactly what it stores. If the rate-limit service is
            unreachable, cleaning still works: the check fails open rather than
            blocking a tool that runs entirely on your machine.
          </p>
        </div>
      </div>
      </section>
    </>
  )
}
