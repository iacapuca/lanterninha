import { createFileRoute } from '@tanstack/react-router'
import { auth } from '~/server/auth.server'
import { readSeatPhoto } from '~/server/photos.server'
import { isAdmin } from '~/server/store.server'

// Server route: seat photos from R2. Visible photos are cached for a day, not
// forever, so a photo hidden after a report drops out of caches soon after.
export const Route = createFileRoute('/photos/$photoId')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const photo = await readSeatPhoto(params.photoId, async () => {
          const session = await auth.api.getSession({ headers: request.headers })
          return session ? isAdmin(session.user.id) : false
        })
        if (!photo) return new Response('Not found', { status: 404 })
        return new Response(photo.body, {
          headers: {
            'Content-Type': photo.contentType,
            'Cache-Control': photo.hidden ? 'private, no-store' : 'public, max-age=86400',
            'X-Content-Type-Options': 'nosniff',
          },
        })
      },
    },
  },
})
