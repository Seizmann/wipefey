/**
 * Single source of truth for site-level SEO metadata.
 * Consumed by the <Seo> component (client, via react-helmet-async) and by
 * scripts/prerender-ssr.tsx (static HTML emission) — keep both paths fed from
 * here so the live SPA and the pre-rendered crawlable HTML never drift.
 */

export const SITE_URL = 'https://wipefey.rexio.pro'
export const SITE_NAME = 'Wipefey'
/** Raster (PNG, 1200x630) — social platforms don't accept SVG for og:image. */
export const OG_IMAGE = `${SITE_URL}/og-image.png`

export interface RouteMeta {
  path: string
  title: string
  description: string
}

export const ROUTE_META: Record<string, RouteMeta> = {
  '/': {
    path: '/',
    title: 'Wipefey — Photo metadata cleaner & AI-marker detector',
    description:
      'Inspect EXIF, IPTC, XMP, GPS and PNG metadata in your photos, detect AI-generation markers, and wipe it all clean — 100% in your browser, free and open source.',
  },
  '/tool': {
    path: '/tool',
    title: 'Wipefey Tool — Inspect & clean photo metadata in your browser',
    description:
      'Drop up to 50 photos (25 MB each) to inspect their metadata, run the AI-marker heuristic, and clean them in one click — everything runs locally in your browser.',
  },
  '/how-it-works': {
    path: '/how-it-works',
    title: 'How it works — Wipefey',
    description:
      'The full Wipefey pipeline explained: upload, metadata inspection, the AI-generation heuristic, canvas-based strip and rewrite, and download — all client-side.',
  },
  '/about': {
    path: '/about',
    title: 'About — Wipefey',
    description:
      'Wipefey is a free, open-source (MIT) client-side photo metadata tool by Mohammad Sijan, part of the RexiO product family, published by SpritexAI.',
  },
  '/privacy': {
    path: '/privacy',
    title: 'Privacy — Wipefey',
    description:
      'Your photos never leave your device. The only server call Wipefey makes is an anonymous rate-limit counter — no uploads, no storage, no analytics, no cookies.',
  },
}

export function getRouteMeta(path: string): RouteMeta {
  const meta = ROUTE_META[path]
  if (!meta) throw new Error(`No route meta defined for path: ${path}`)
  return meta
}

/**
 * JSON-LD structured data (schema.org), rendered on the home page.
 * Facts only, matching the About page: creator, publisher, product family.
 */
export const JSON_LD: object[] = [
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Wipefey',
    description:
      'Free, open-source, client-side photo metadata tool: inspect EXIF, IPTC, XMP, GPS and PNG metadata, get a heuristic AI-generation signal, and wipe metadata clean — entirely in the browser.',
    url: SITE_URL,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Any (web browser)',
    license: 'https://github.com/Seizmann/wipefey/blob/main/LICENSE',
    isAccessibleForFree: true,
    brand: {
      '@type': 'Brand',
      name: 'RexiO',
      url: 'https://rexio.pro',
    },
    author: { '@id': 'https://sijan.pro.bd/#person' },
    publisher: { '@id': 'https://spritexai.pro.bd/#organization' },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': 'https://spritexai.pro.bd/#organization',
    name: 'SpritexAI',
    url: 'https://spritexai.pro.bd',
    description:
      'Publisher of Wipefey under its Open Source Tools collection; maintains the repository.',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': 'https://sijan.pro.bd/#person',
    name: 'Mohammad Sijan',
    url: 'https://sijan.pro.bd',
    jobTitle: 'Creator of Wipefey',
  },
]
