import { createMiddleware } from '@tanstack/react-start'
import { readSession } from '~/server/session.server'

/**
 * Server-function middleware: the security boundary for writes.
 * Route guards (`beforeLoad`) are UX only — server functions are public HTTP
 * endpoints, so every private one must carry this.
 */
export const requireSession = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const session = await readSession()
  if (!session) throw new Error('Você precisa entrar para fazer isso.')
  return next({ context: { username: session.username } })
})
