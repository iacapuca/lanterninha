import { createFileRoute } from '@tanstack/react-router'
import { NATIONAL_SLUG, citySlug } from '~/lib/domain'
import { getRankingIndex, getSitemapIds } from '~/server/store.server'

// Server route: raw HTTP handler, no component. Runs only on the server.
export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin
        const [{ rooms, cinemas }, rankings] = await Promise.all([getSitemapIds(), getRankingIndex()])
        // Only rankings with reviewed rooms: empty ones are noindex.
        const rankingPaths = new Set(['/melhores-salas', `/melhores-salas/${NATIONAL_SLUG}`])
        for (const r of rankings) {
          const place = `/melhores-salas/${citySlug(r.city, r.state)}`
          rankingPaths.add(place)
          if (r.format && r.format !== 'standard') {
            rankingPaths.add(`${place}/${r.format}`)
            rankingPaths.add(`/melhores-salas/${NATIONAL_SLUG}/${r.format}`)
          }
        }
        const paths = [
          '/',
          '/cinemas',
          ...rankingPaths,
          ...cinemas.map((id) => `/cinemas/${id}`),
          ...rooms.map((id) => `/rooms/${id}`),
        ]
        const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((p) => `  <url><loc>${origin}${p}</loc></url>`).join('\n')}
</urlset>`
        return new Response(body, {
          headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
          },
        })
      },
    },
  },
})
