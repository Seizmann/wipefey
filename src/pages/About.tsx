/**
 * About — factual and minimal per REQUIREMENT.md §1/§7: Wipefey is part of the
 * RexiO product family (rexio.pro), published by SpritexAI (spritexai.pro.bd),
 * created by Mohammad Sijan (sijan.pro.bd). Name + link + role only — no
 * invented biographical details.
 */

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
  return (
    <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 md:py-28">
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
        About
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
        Wipefey is a free, open-source, client-side photo metadata tool: inspect
        everything embedded in an image, get a heuristic AI-generation signal,
        and wipe the metadata clean — without the file ever leaving your
        browser. It is MIT-licensed and lives at{' '}
        <a
          href="https://wipefey.rexio.pro"
          className="text-accent transition-colors hover:text-accent-hover"
        >
          wipefey.rexio.pro
        </a>
        .
      </p>

      <div className="mt-12 grid gap-3 sm:grid-cols-3">
        {PEOPLE.map((p) => (
          <a
            key={p.name}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-wsm border border-border bg-surface p-5 transition-colors hover:border-border-strong"
          >
            <p className="font-mono text-[11px] uppercase tracking-wide text-faint">
              {p.role}
            </p>
            <p className="mt-1.5 text-base font-medium text-foreground">
              {p.name}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{p.note}</p>
            <p className="mt-2 font-mono text-xs text-accent">
              {p.url.replace('https://', '')}
            </p>
          </a>
        ))}
      </div>

      <div className="mt-12 flex flex-col gap-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight md:text-xl">
            Open source
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            The full source is public under the MIT license — contributions and
            issues are welcome on GitHub at{' '}
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
          <h2 className="text-lg font-semibold tracking-tight md:text-xl">
            What's next
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            v2 is scoped as a deeper "AI Interrogate" analysis feature. The
            current roadmap lives in the repository's{' '}
            <code className="rounded-wxs bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-foreground">
              ROADMAP.md
            </code>
            .
          </p>
        </div>
      </div>
    </section>
  )
}
