import { createMiddleware, createStart } from '@tanstack/react-start'
import { setResponseHeaders } from '@tanstack/react-start/server'

// Runs for every server request: document SSR, server routes and server functions.
const securityHeaders = createMiddleware().server(async ({ next }) => {
  setResponseHeaders(
    new Headers({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'DENY',
    }),
  )
  return next()
})

export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeaders],
}))
