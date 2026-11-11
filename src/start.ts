import { createCsrfMiddleware, createMiddleware, createStart } from '@tanstack/react-start'
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

// Writes from other sites are refused: server functions and the photo upload
// route accept only same-origin requests (Sec-Fetch-Site, else Origin, else
// Referer). The SameSite=Lax session cookie already keeps cross-site POSTs
// signed out; this doesn't depend on it. Better Auth checks /api/auth itself.
const csrf = createCsrfMiddleware({
  filter: ({ handlerType, pathname, request }) =>
    handlerType === 'serverFn' || (pathname === '/api/photos' && request.method !== 'GET'),
})

export const startInstance = createStart(() => ({
  requestMiddleware: [csrf, securityHeaders],
}))
