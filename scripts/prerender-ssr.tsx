/**
 * SSR entry for the static prerender (AGENT.md D1/D7).
 *
 * Renders each public route to static HTML with React's renderToString so
 * crawlers and answer engines get real markup + per-route head tags
 * (title/description/canonical/OG/Twitter/JSON-LD via react-helmet-async)
 * without executing JS.
 *
 * Supports React 19: extracts hoisted head tags directly from the rendered string.
 */
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router'
import { HelmetProvider } from 'react-helmet-async'
import type { ReactElement } from 'react'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { Routes, Route } from 'react-router-dom'
import { Layout } from '../src/components/Layout'
import { HomePage } from '../src/pages/Home'
import { ToolPage } from '../src/pages/Tool'
import { HowItWorksPage } from '../src/pages/HowItWorks'
import { AboutPage } from '../src/pages/About'
import { PrivacyPage } from '../src/pages/Privacy'

const ROOT = process.cwd()
const DIST = join(ROOT, 'dist')

const ROUTES: Array<{ path: string; page: ReactElement }> = [
  { path: '/', page: <HomePage /> },
  { path: '/tool', page: <ToolPage /> },
  { path: '/how-it-works', page: <HowItWorksPage /> },
  { path: '/about', page: <AboutPage /> },
  { path: '/privacy', page: <PrivacyPage /> },
]

const template = readFileSync(join(DIST, 'index.html'), 'utf8')

for (const { path: route, page } of ROUTES) {
  // Wrap layout and page in Routes to let react-router Outlets match and render.
  const helmetContext: Record<string, unknown> = {}
  const rawHtml = renderToString(
    <HelmetProvider context={helmetContext}>
      <StaticRouter location={route}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="*" element={page} />
          </Route>
        </Routes>
      </StaticRouter>
    </HelmetProvider>,
  )

  // React 19 renderToString prepends hoisted <title>, <meta>, and <link> tags
  // to the beginning of the rendered HTML output.
  const splitIdx = rawHtml.indexOf('<div class="flex min-h-screen')
  if (splitIdx === -1) {
    throw new Error(`Failed to find Layout root container in rendered HTML for route: ${route}`)
  }

  const head = rawHtml.slice(0, splitIdx)
  const body = rawHtml.slice(splitIdx)

  // Strip Vite template's default static title and description tags,
  // then inject our route-specific hoisted head tags before </head>.
  const html = template
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/<meta[^>]*?name="description"[^>]*?\/>/, '')
    .replace('</head>', `${head}</head>`)
    .replace('<div id="root"></div>', `<div id="root">${body}</div>`)

  const outFile =
    route === '/' ? join(DIST, 'index.html') : join(DIST, route, 'index.html')
  mkdirSync(dirname(outFile), { recursive: true })
  writeFileSync(outFile, html)
  console.log(`prerendered ${route} -> ${outFile.replace(`${ROOT}/`, '')}`)
}
