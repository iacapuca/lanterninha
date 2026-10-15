/** Canonical origin, for absolute URLs in share previews (og:image, og:url). */
export const SITE_URL = 'https://lanterninha.review'

/**
 * Open Graph + Twitter tags for a page with a share image. `version` changes
 * with the rating so WhatsApp and friends fetch a fresh card after new reviews.
 */
export function shareMeta({
  title,
  description,
  path,
  image,
  version,
}: {
  title: string
  description: string
  /** Page path, for og:url. */
  path: string
  /** Image path under /og. */
  image: string
  version?: string
}) {
  const imageUrl = `${SITE_URL}${image}${version ? `?v=${encodeURIComponent(version)}` : ''}`
  return [
    { property: 'og:type', content: 'website' },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: `${SITE_URL}${path}` },
    { property: 'og:image', content: imageUrl },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { property: 'og:image:alt', content: title },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: imageUrl },
  ]
}
