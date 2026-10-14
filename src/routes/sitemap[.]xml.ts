import { createFileRoute } from '@tanstack/react-router'
import { getSitemapIds } from '~/server/store.server'

// Server route: raw HTTP handler, no component. Runs only on the server.
export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: ({ request }) => {
        const origin = new URL(request.url).origin
        const { rooms, cinemas } = getSitemapIds()
        const paths = [
          '/',
          '/rooms',
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
