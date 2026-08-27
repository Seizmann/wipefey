import { Helmet } from 'react-helmet-async'
import { OG_IMAGE, SITE_NAME, SITE_URL, JSON_LD } from './meta'

interface SeoProps {
  /** Route path, e.g. "/tool" — becomes the canonical URL + og:url. */
  path: string
  title: string
  description: string
  /** Include the site-wide JSON-LD graph (home page only). */
  jsonLd?: boolean
}

/**
 * Per-route document head: title, description, canonical, Open Graph and
 * Twitter card tags, plus optional JSON-LD. Mounted once per page component.
 */
export function Seo({ path, title, description, jsonLd = false }: SeoProps) {
  const url = `${SITE_URL}${path}`
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content="website" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={OG_IMAGE} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={OG_IMAGE} />

      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(JSON_LD)}</script>
      )}
    </Helmet>
  )
}
