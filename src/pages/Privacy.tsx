/**
 * Privacy — accurate to what the app actually does (no generic boilerplate):
 * - All image processing is client-side; no file ever leaves the device.
 * - The ONLY server call is POST /api/check-limit (rate limiting): a fixed
 *   1-hour window counter keyed by IP (`wipefey:ratelimit:<window>:<ip>` in
 *   Upstash Redis). Nothing else is stored — no file data, no profile.
 * - The theme preference lives in localStorage (`wipefey:theme`).
 * Facts cross-checked against src/lib/ratelimit/index.ts and
 * api/check-limit.mjs / api/ratelimit-core.mjs.
 */
import type { ReactNode } from 'react'

function Section({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="mt-10">
      <h2 className="text-lg font-semibold tracking-tight md:text-xl">
        {title}
      </h2>
      <div className="mt-2 flex flex-col gap-3 text-sm leading-relaxed text-muted">
        {children}
      </div>
    </div>
  )
}

export function PrivacyPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 md:py-28">
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
        Privacy
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
        Wipefey is built so that it physically cannot leak your photos: the
        entire pipeline runs in your browser. This page describes exactly what
        happens on your device and what touches a server — no boilerplate, just
        what the code does.
      </p>

      <Section title="Your photos never leave your device">
        <p>
          Uploaded files are read with the browser's File API and processed
          locally — metadata extraction, the AI-marker heuristic, the canvas
          re-encode, and the metadata rewrite all happen in your browser tab.
          No image, thumbnail, or metadata is ever uploaded, transmitted, or
          stored server-side. There is no server-side storage of any kind.
        </p>
        <p>
          When you close the tab, everything is gone: files, extracted
          metadata, and cleaned downloads exist only in the page's memory while
          you work.
        </p>
      </Section>

      <Section title="The one server call: rate limiting">
        <p>
          Before each transform, Wipefey sends a single{' '}
          <code className="rounded-wxs bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-foreground">
            POST /api/check-limit
          </code>{' '}
          request to enforce a fair-use limit (about 10 transforms per hour, per
          IP). That request contains no file data — there is nothing in it to
          contain file data.
        </p>
        <p>
          What the server stores: a request counter in Upstash Redis under a key
          of the form{' '}
          <code className="rounded-wxs bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-foreground">
            wipefey:ratelimit:&lt;hour-window&gt;:&lt;your-IP&gt;
          </code>{' '}
          — an IP-keyed counter and nothing else. Keys are scoped to one hour
          and expire with the window. No profile is built, no history kept, and
          your IP is used for one purpose: counting your own requests against
          your own limit.
        </p>
        <p>
          If the rate-limit service is unreachable, the check fails open and
          cleaning proceeds anyway — a privacy tool shouldn't stop working
          because its counter is down.
        </p>
      </Section>

      <Section title="What stays in your browser">
        <p>
          One thing is saved locally: your theme preference, under the
          localStorage key{' '}
          <code className="rounded-wxs bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-foreground">
            wipefey:theme
          </code>
          . That's it. Wipefey sets no cookies, uses no accounts, and embeds no
          third-party analytics or advertising scripts. Fonts are self-hosted,
          so even font requests don't leave this site.
        </p>
      </Section>

      <Section title="The fine print">
        <p>
          Hosting infrastructure (Vercel, which serves the static site and the
          rate-limit function) necessarily sees standard request metadata such
          as IP addresses in its logs; that is outside Wipefey's code and
          covered by Vercel's own policies. And of course, the repository is
          open source — you can verify every claim on this page by reading{' '}
          <a
            href="https://github.com/SpritexAI/wipefey"
            className="text-accent transition-colors hover:text-accent-hover"
          >
            the code
          </a>
          .
        </p>
      </Section>
    </section>
  )
}
