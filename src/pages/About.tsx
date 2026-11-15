/**
 * About — factual and minimal per REQUIREMENT.md §1/§7: Wipefey is part of the
 * RexiO product family (rexio.pro), published by SpritexAI (spritexai.pro.bd),
 * created by Mohammad Sijan (sijan.pro.bd). Name + link + role only — no
 * invented biographical details.
 */
import { Seo } from '../seo/Seo'
import { getRouteMeta } from '../seo/meta'

const PEOPLE = [
  {
    name: 'Mohammad Sijan',
    role: 'Creator',
    url: 'https://sijan.pro.bd',
    note: 'Built Wipefey.',
  },
  {
    name: 'SpritexAI',
    role: 'Publisher',
    url: 'https://spritexai.pro.bd',
    note: 'Publishes Wipefey under its Open Source Tools collection and maintains the repository.',
  },
  {
    name: 'RexiO',
    role: 'Product family',
    url: 'https://rexio.pro',
    note: 'A collection of personal-use tools. Wipefey is part of it.',
  },
]

export function AboutPage() {
  const meta = getRouteMeta('/about')
  return (
    <>
      <header className="mx-auto max-w-3xl px-4 pt-20 pb-20 sm:px-6 md:pt-28">
        <Seo path={meta.path} title={meta.title} description={meta.description} />
        <h1 className="min-w-0 text-balance text-3xl font-semibold tracking-tight wrap-break-word md:text-4xl">
          About
        </h1>
        <p className="mt-4 max-w-[55ch] text-pretty text-base leading-relaxed text-muted">
          A free, open-source tool for the metadata inside photos.
        </p>
      </header>

      <section className="mx-auto max-w-3xl px-4 pb-20 sm:px-6 md:pb-28">
        <div className="mt-12 border-t border-border">
          {PEOPLE.map((p) => (
            <a
              key={p.name}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="grid gap-1 border-b border-border py-5 transition-colors hover:border-border-strong sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:items-baseline sm:gap-6"
            >
              <span className="font-mono text-xs text-faint">{p.role}</span>
              <span className="min-w-0">
                <span className="text-base font-medium text-foreground">
                  {p.name}
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-muted">
                  {p.note}
                </span>
              </span>
              <span className="font-mono text-xs text-accent">
                {p.url.replace('https://', '')}
              </span>
            </a>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-6">
          <div>
            <h2 className="text-balance text-xl font-semibold tracking-tight md:text-2xl">
              Open source
            </h2>
            <p className="mt-2 max-w-[55ch] text-pretty text-sm leading-relaxed text-muted">
              The full source is public under the MIT license and runs entirely
              in the browser. The site lives at{' '}
              <a
                href="https://wipefey.rexio.pro"
                className="text-accent transition-colors hover:text-accent-hover"
              >
                wipefey.rexio.pro
              </a>
              ; contributions and issues are welcome on GitHub at{' '}
              <a
                href="https://github.com/Seizmann/wipefey"
                className="font-mono text-accent transition-colors hover:text-accent-hover"
              >
                github.com/Seizmann/wipefey
              </a>
              .
            </p>
          </div>
          <div>
            <h2 className="text-balance text-xl font-semibold tracking-tight md:text-2xl">
              What’s next
            </h2>
            <p className="mt-2 max-w-[55ch] text-pretty text-sm leading-relaxed text-muted">
              v2 is scoped as a deeper “AI Interrogate” analysis feature. The
              current roadmap lives in the repository’s{' '}
              <code className="rounded-wxs bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-foreground">
                ROADMAP.md
              </code>
              .
            </p>
          </div>
        </div>
      </section>
    </>
  )
}
