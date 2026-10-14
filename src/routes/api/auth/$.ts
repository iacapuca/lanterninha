import { createFileRoute } from '@tanstack/react-router'
import { auth } from '~/server/auth.server'

// Better Auth's HTTP API (sign-up, sign-in, sign-out, session) at /api/auth/*.
export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: ({ request }) => auth.handler(request),
    },
  },
})
