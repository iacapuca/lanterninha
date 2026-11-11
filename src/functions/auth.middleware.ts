import { createMiddleware } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from '~/server/auth.server'
import { isAdmin } from '~/server/store.server'

/**
 * Server-function middleware: the security boundary for writes.
 * Route guards (`beforeLoad`) are UX only — server functions are public HTTP
 * endpoints, so every private one must carry this.
 */
export const requireSession = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const session = await auth.api.getSession({ headers: getRequestHeaders() })
  if (!session) throw new Error('Você precisa entrar para fazer isso.')
  return next({
    context: {
      userId: session.user.id,
      username: session.user.username ?? session.user.name,
    },
  })
})

/** Moderators only (`user.is_admin`). Anyone else gets the same error as a missing page. */
export const requireAdmin = createMiddleware({ type: 'function' })
  .middleware([requireSession])
  .server(async ({ next, context }) => {
    if (!(await isAdmin(context.userId))) throw new Error('Página não encontrada.')
    return next()
  })
