import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Seo } from '../seo/Seo'
import { getRouteMeta } from '../seo/meta'

/**
 * Landing page — what Wipefey does, why it matters (privacy: no server-side
 * storage), and a clear CTA to the tool. All copy is factual per
 * REQUIREMENT.md §1/§2 — no fabricated stats or claims.
 *
 * Hallmark redesign: the specimens below render the tool's own output shape
 * with values from the project's own test fixtures (camera-with-exif.jpg,
 * ai-pipeline.png in test/fixtures), captioned as example output.
 */

/** Row identical in shape to the workbench's MetadataPanel row. */
function SpecRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[minmax(7rem,1fr)_2fr] gap-3 py-1.5 font-mono text-xs">
      <dt className="truncate text-faint">{k}</dt>
      <dd className="min-w-0 break-words text-foreground">{v}</dd>
    </div>
  )
}

/** Panel shell identical to the workbench's metadata section. */
function SpecPanel({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="rounded-wsm border border-border bg-surface">
      <h3 className="border-b border-border px-4 py-2 font-mono text-xs text-muted">
        {title}
      </h3>
      <dl className="divide-y divide-border/60 px-4 py-2">{children}</dl>
    </section>
  )
}

/** Section heading + one-line intro shared by the Home sections. */
function SectionHead({ title, line }: { title: string; line: string }) {
  return (
    <div className="max-w-2xl">
      <h2 className="text-balance text-xl font-semibold tracking-tight md:text-2xl">
        {title}
      </h2>
      <p className="mt-3 text-pretty text-sm leading-relaxed text-muted md:text-base">
        {line}
      </p>
    </div>
  )
}

const INSPECT_ROWS = [
  {
    term: 'EXIF',
    line: 'Camera make and model, lens, ISO, exposure, software tag.',
  },
  { term: 'GPS', line: 'Latitude, longitude and altitude, when recorded.' },
  {
    term: 'PNG text chunks',
    line: 'tEXt, iTXt and zTXt blocks, where AI tools leave traces.',
  },
  {
    term: 'IPTC, XMP, ICC',
    line: 'Editorial fields, tool history, color profile data.',
  },
  {
    term: 'C2PA',
    line: 'Content credentials: creation tool and model hints.',
  },
]

const SPEC_ROWS = [
  { term: 'Formats', line: 'JPEG, PNG, WebP. HEIC best effort, saved as JPEG.' },
  { term: 'Batch', line: 'Up to 50 files, 25 MB each.' },
  { term: 'Export', line: 'Download per file, or the whole batch as one ZIP.' },
  {
    term: 'Rate limit',
    line: 'About 10 cleans per hour per IP. Fails open when unreachable.',
  },
]

const primaryAction =
  'rounded-wxs bg-accent px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-hover'
const secondaryAction =
  'rounded-wxs border border-border bg-surface-2 px-5 py-3 text-sm font-medium text-foreground transition-colors hover:border-border-strong hover:bg-surface-3'

export function HomePage() {
  const meta = getRouteMeta('/')
  return (
    <>
      <Seo path={meta.path} title={meta.title} description={meta.description} jsonLd />

      {/* Hero — Stage posture: text on five columns, the tool's own output
          on seven. Specimen values come from test/fixtures/camera-with-exif.jpg. */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-10 py-24 md:py-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <div className="min-w-0">
            <h1 className="min-w-0 text-balance text-4xl font-semibold leading-[1.05] tracking-tight wrap-break-word md:text-6xl">
              See what your photos carry.
            </h1>
            <p className="mt-5 max-w-md text-pretty text-base leading-relaxed text-muted md:text-lg">
              Inspect, flag and wipe photo metadata, without uploading a byte.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/tool" className={primaryAction}>
                Open the tool
              </Link>
              <Link to="/how-it-works" className={secondaryAction}>
                How it works
              </Link>
            </div>
          </div>

          <figure className="min-w-0">
            <div className="flex flex-col gap-3">
              <div className="min-w-0">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="truncate font-mono text-sm text-foreground">
                    camera-with-exif.jpg
                  </p>
                  <span className="shrink-0 rounded-full border border-border px-2 py-0.5 font-mono text-[11px] text-muted">
                    JPEG
                  </span>
                </div>
                <p className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted">
                    <span className="size-2 rounded-full bg-clean" aria-hidden />
                    No markers found
                  </span>
                </p>
              </div>
              <SpecPanel title="Camera">
                <SpecRow k="Make" v="Canon" />
                <SpecRow k="Model" v="Canon EOS R5" />
                <SpecRow k="Lens" v="RF 24-70mm F2.8" />
                <SpecRow k="ISO" v="100" />
                <SpecRow k="Software" v="Adobe Lightroom Classic" />
              </SpecPanel>
              <SpecPanel title="GPS">
                <SpecRow k="Latitude" v="23.752778" />
                <SpecRow k="Longitude" v="90.366667" />
                <SpecRow k="Altitude" v="5 m" />
              </SpecPanel>
              <SpecPanel title="Dates">
                <SpecRow k="Taken" v="2024-03-15 10:30" />
                <SpecRow k="Digitized" v="2024-03-15 10:30" />
              </SpecPanel>
            </div>
            <figcaption className="mt-3 font-mono text-xs text-faint">
              Example output, from the project’s own test fixture. Absence
              of markers is not proof the photo is real.
            </figcaption>
          </figure>
        </div>
      </section>

      {/* Inspect — the metadata categories, as rows */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
          <SectionHead
            title="Everything inside the file"
            line="Every category the parser finds, shown in full for each photo."
          />
          <dl className="mt-10 divide-y divide-border border-y border-border">
            {INSPECT_ROWS.map((r) => (
              <div
                key={r.term}
                className="grid gap-1 py-5 sm:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] sm:gap-8"
              >
                <dt className="text-base font-medium text-foreground">{r.term}</dt>
                <dd className="text-sm leading-relaxed text-muted">{r.line}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Signal — split: the honest heuristic beside real marker evidence.
          Evidence values come from test/fixtures/ai-pipeline.png. */}
      <section>
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <SectionHead
            title="An honest AI-generation signal"
            line="Every file gets a badge: Yes, Uncertain or No, built from known markers. The matched tags stay visible as raw evidence. Heuristic, never proof."
          />
          <figure className="min-w-0">
            <div className="rounded-wsm border border-border bg-surface">
              <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
                <p className="truncate font-mono text-sm text-foreground">
                  ai-pipeline.png
                </p>
                <span className="shrink-0 rounded-full border border-border px-2 py-0.5 font-mono text-[11px] text-muted">
                  PNG
                </span>
              </div>
              <div className="px-4 py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted">
                    <span className="size-2 rounded-full bg-ai" aria-hidden />
                    AI markers found
                  </span>
                  <span className="rounded-full border border-border px-2.5 py-0.5 font-mono text-[11px] text-muted">
                    Yes
                  </span>
                </div>
                <p className="mt-2 font-mono text-xs text-foreground">
                  Strong indicators of AI generation: 3 strong
                  machine-generation markers found.
                </p>
                <p className="mt-3 rounded-wxs border border-border/60 bg-surface-2 px-3 py-2 font-mono text-[11px] text-muted">
                  Heuristic indicator, not forensic proof.
                </p>
                <div className="mt-3 border-t border-border/60 pt-3">
                  <p className="font-mono text-xs text-muted">Raw markers</p>
                  <dl className="flex flex-col gap-2 py-1">
                    <div className="flex flex-col gap-1">
                      <dt className="flex flex-wrap items-center gap-2 font-mono text-xs">
                        <span className="text-faint">M4</span>
                        <span className="rounded-full border border-border px-1.5 py-0.5 text-[11px] text-muted">
                          strong
                        </span>
                        <span className="text-foreground">parameters</span>
                      </dt>
                      <dd className="whitespace-pre-wrap break-words rounded-wxs bg-surface-2 px-2.5 py-1.5 font-mono text-xs text-foreground">
                        {'masterpiece, cinematic lighting, a woman sitting by a window\nSteps: 28, Sampler: Euler-a, CFG scale: 7, Seed: 123456789\nModel: sd_xl_base_1.0, DPM++ 2M Karras\nSize: 512x512, RNG: 1337'}
                      </dd>
                    </div>
                    <div className="flex flex-col gap-1">
                      <dt className="flex flex-wrap items-center gap-2 font-mono text-xs">
                        <span className="text-faint">M5</span>
                        <span className="rounded-full border border-border px-1.5 py-0.5 text-[11px] text-muted">
                          strong
                        </span>
                        <span className="text-foreground">Description</span>
                      </dt>
                      <dd className="whitespace-pre-wrap break-words rounded-wxs bg-surface-2 px-2.5 py-1.5 font-mono text-xs text-foreground">
                        Rendered by an AI pipeline, test marker.
                      </dd>
                    </div>
                    <div className="flex flex-col gap-1">
                      <dt className="flex flex-wrap items-center gap-2 font-mono text-xs">
                        <span className="text-faint">M6</span>
                        <span className="rounded-full border border-border px-1.5 py-0.5 text-[11px] text-muted">
                          strong
                        </span>
                        <span className="text-foreground">Software</span>
                      </dt>
                      <dd className="whitespace-pre-wrap break-words rounded-wxs bg-surface-2 px-2.5 py-1.5 font-mono text-xs text-foreground">
                        Stable Diffusion 3.5
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
            <figcaption className="mt-3 font-mono text-xs text-faint">
              Example marker evidence, from the project’s own test fixture.
            </figcaption>
          </figure>
        </div>
      </section>

      {/* Clean — before and after, on a change of paper */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          <SectionHead
            title="One click, wiped and rewritten"
            line="The strip is verified by re-reading the result. Same format in and out; only HEIC becomes JPEG. No undo: the cleaned file is final."
          />
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <section className="rounded-wsm border border-border bg-bg">
              <h3 className="border-b border-border px-4 py-2 font-mono text-xs text-muted">
                before
              </h3>
              <dl className="divide-y divide-border/60 px-4 py-2">
                <SpecRow k="Make" v="Canon" />
                <SpecRow k="Model" v="Canon EOS R5" />
                <SpecRow k="GPS" v="23.752778, 90.366667" />
                <SpecRow k="Software" v="Adobe Lightroom Classic" />
                <SpecRow k="Artist" v="A. Photographer" />
                <SpecRow k="Copyright" v="(c) 2024 Test" />
              </dl>
            </section>
            <section className="rounded-wsm border border-border bg-bg">
              <h3 className="border-b border-border px-4 py-2 font-mono text-xs text-muted">
                after
              </h3>
              <dl className="divide-y divide-border/60 px-4 py-2">
                <SpecRow k="DateTime" v="2026-11-14 09:41" />
                <SpecRow k="Software" v="Wipefey by RexiO" />
              </dl>
              <p className="px-4 py-3 font-mono text-xs text-faint">
                Every other field, gone.
              </p>
            </section>
          </div>
        </div>
      </section>

      {/* Specs — the batch's own numbers, as a table */}
      <section>
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
          <SectionHead
            title="50 photos, one ZIP"
            line="The practical numbers, exactly as the tool enforces them."
          />
          <table className="mt-10 w-full border-y border-border text-left">
            <tbody className="divide-y divide-border">
              {SPEC_ROWS.map((r) => (
                <tr key={r.term}>
                  <th
                    scope="row"
                    className="whitespace-nowrap py-5 pr-8 align-top text-sm font-medium text-foreground"
                  >
                    {r.term}
                  </th>
                  <td className="py-5 align-top text-sm leading-relaxed text-muted">
                    {r.line}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Close — the privacy promise and the open-source facts side by side,
          with the hero's action again. */}
      <section className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-16 sm:px-6 md:py-20 lg:grid-cols-2">
          <div className="flex flex-col rounded-wsm border border-border bg-surface p-8">
            <h2 className="text-balance text-xl font-semibold tracking-tight md:text-2xl">
              Your photos never leave this device.
            </h2>
            <p className="mt-3 max-w-xl text-pretty text-sm leading-relaxed text-muted md:text-base">
              Parsing, the AI signal and the clean all run in your browser tab.
              The only server call is a rate-limit check with no file data in
              it.
            </p>
            <Link
              to="/privacy"
              className="mt-6 inline-flex w-fit rounded-wxs border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-border-strong hover:text-foreground"
            >
              Read the privacy page
            </Link>
          </div>
          <div className="flex flex-col rounded-wsm border border-border bg-surface p-8">
            <h2 className="text-balance text-xl font-semibold tracking-tight md:text-2xl">
              Free and open source
            </h2>
            <p className="mt-3 max-w-xl text-pretty text-sm leading-relaxed text-muted md:text-base">
              MIT licensed. From the RexiO family of personal-use tools,
              published by SpritexAI under its Open Source Tools collection.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/tool" className={secondaryAction}>
                Open the tool
              </Link>
              <a
                href="https://github.com/Seizmann/wipefey"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-wxs border border-border px-5 py-3 text-sm font-medium text-muted transition-colors hover:border-border-strong hover:text-foreground"
              >
                GitHub repo
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
