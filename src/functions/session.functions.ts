import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import type { Viewer } from '~/lib/domain'
import { auth } from '~/server/auth.server'

// Sign-up, sign-in and sign-out go straight to Better Auth (/api/auth/*) via
// `authClient`; this only exposes who is signed in to loaders and beforeLoad.
export const getViewer = createServerFn({ method: 'GET' }).handler(async (): Promise<Viewer> => {
  const session = await auth.api.getSession({ headers: getRequestHeaders() })
  return session ? { username: session.user.username ?? session.user.name } : null
})
