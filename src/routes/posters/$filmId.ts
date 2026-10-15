import { createFileRoute } from '@tanstack/react-router'
import { getFilmPoster } from '~/server/store.server'

// Server route: posters stored in D1 for providers that only publish them inline.
export const Route = createFileRoute('/posters/$filmId')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const poster = await getFilmPoster(params.filmId)
        if (!poster) return new Response('Not found', { status: 404 })
        // Copy into a plain Uint8Array: D1 may hand blobs back as a Buffer, ArrayBuffer or number[].
        return new Response(new Uint8Array(poster.data as ArrayLike<number>), {
          headers: {
            'Content-Type': poster.contentType,
            // A film's poster doesn't change; let browsers and the edge keep it.
            'Cache-Control': 'public, max-age=604800, immutable',
          },
        })
      },
    },
  },
})
