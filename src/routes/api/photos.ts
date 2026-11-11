import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { track } from '~/server/analytics.server'
import { auth } from '~/server/auth.server'
import { uploadSeatPhoto } from '~/server/photos.server'

const query = z.object({
  review: z.string().min(1).max(80),
  w: z.coerce.number(),
  h: z.coerce.number(),
})

const json = (body: unknown, status = 200) => Response.json(body, { status })

// Server route: the photo is the raw request body (a server function would
// need multipart). POST /api/photos?review=<id>&w=1600&h=1200
export const Route = createFileRoute('/api/photos')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return json({ error: 'Você precisa entrar para fazer isso.' }, 401)
        const url = new URL(request.url)
        const params = query.safeParse({
          review: url.searchParams.get('review'),
          w: url.searchParams.get('w'),
          h: url.searchParams.get('h'),
        })
        if (!params.success) return json({ error: 'Pedido inválido.' }, 400)
        const result = await uploadSeatPhoto({
          userId: session.user.id,
          reviewId: params.data.review,
          width: params.data.w,
          height: params.data.h,
          body: await request.arrayBuffer(),
        })
        if (!result.ok) return json({ error: result.message }, result.status)
        track('photo_uploaded', { roomId: result.roomId })
        return json({ id: result.id })
      },
    },
  },
})
