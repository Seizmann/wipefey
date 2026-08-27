/**
 * Static prerender driver (AGENT.md D1). Bundles scripts/prerender-ssr.tsx
 * with esbuild (already a devDependency — no extra deps needed), runs it, and
 * it emits dist/<route>/index.html for every public route with rendered HTML
 * and per-route head tags inlined. Invoked by `npm run build:static` after
 * `vite build`. Vercel serves these static files before applying the SPA
 * rewrite, so crawlers get real HTML per route.
 */
import { build } from 'esbuild'
import { mkdtempSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const tmp = mkdtempSync(join(root, '.prerender-tmp-'))

try {
  await build({
    entryPoints: [join(root, 'scripts/prerender-ssr.tsx')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    jsx: 'automatic',
    outfile: join(tmp, 'ssr.cjs'),
    logLevel: 'warning',
    external: ['react', 'react-dom', 'react-router', 'react-helmet-async', 'react-router-dom'],
  })
  await import(pathToFileURL(join(tmp, 'ssr.cjs')).href)
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
