import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { DefaultError, DefaultNotFound } from './components/states'

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    // Loader results are reused while fresh; mutations call router.invalidate().
    defaultStaleTime: 10_000,
    defaultPendingMs: 300,
    defaultNotFoundComponent: DefaultNotFound,
    defaultErrorComponent: DefaultError,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
