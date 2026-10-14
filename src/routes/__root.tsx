/// <reference types="vite/client" />
import type { ReactNode } from 'react'
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
  useRouteContext,
  useRouter,
} from '@tanstack/react-router'
import { getViewer } from '~/functions/session.functions'
import { authClient } from '~/lib/auth-client'
import appCss from '~/styles.css?url'

export const Route = createRootRoute({
  // Root SSR is full-document: <html> is always rendered on the server.
  // The viewer goes into router context so child `beforeLoad` guards can read it.
  beforeLoad: async () => ({ viewer: await getViewer() }),
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Lanterninha — avaliações de salas de cinema' },
      {
        name: 'description',
        content:
          'O Letterboxd das salas de cinema: descubra qual sala tem a melhor tela, som e poltrona perto de você.',
      },
      { name: 'theme-color', content: '#120d0a' },
      { property: 'og:site_name', content: 'Lanterninha' },
      { property: 'og:locale', content: 'pt_BR' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700;9..144,900&family=Figtree:wght@400;500;600&display=swap',
      },
    ],
  }),
  component: RootComponent,
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function RootComponent() {
  return (
    <>
      <SiteHeader />
      <main className="container">
        <Outlet />
      </main>
      <footer className="site-footer container">
        <p>
          Lanterninha · avaliações de salas de cinema escritas pela comunidade.
          <br />
          Salas e complexos: <a href="https://dados.gov.br/dados/conjuntos-dados/salas-de-exibicao-e-complexos-registrados-na-ancine">ANCINE, dados abertos (CC BY)</a>
          {' · '}Localizações: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors
        </p>
      </footer>
    </>
  )
}

function SiteHeader() {
  const { viewer } = useRouteContext({ from: '__root__' })
  const router = useRouter()

  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <Link to="/" className="logo">
          <span className="logo-mark" aria-hidden="true">
            🔦
          </span>
          lanterninha
        </Link>
        <nav className="site-nav">
          <Link to="/rooms" activeProps={{ className: 'active' }}>
            Explorar
          </Link>
          <Link to="/nearby" activeProps={{ className: 'active' }}>
            Perto de mim
          </Link>
          {viewer ? (
            <>
              <Link
                to="/users/$username"
                params={{ username: viewer.username }}
                activeProps={{ className: 'active' }}
              >
                @{viewer.username}
              </Link>
              <button
                type="button"
                className="link-button"
                onClick={async () => {
                  await authClient.signOut()
                  await router.invalidate()
                }}
              >
                Sair
              </button>
            </>
          ) : (
            <>
              <Link to="/sign-in" search={{ mode: 'login' }} activeOptions={{ includeSearch: false }}>
                Entrar
              </Link>
              <Link to="/sign-in" search={{ mode: 'register' }} className="button button-small">
                Criar conta
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
