import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { getFeed } from '~/functions/social.functions'
import { pluralize } from '~/lib/format'
import { ReviewItem } from '~/components/review-item'
import { Button } from '~/components/ui/button'

// SSR: full. Private (the signed-in reader's follows), so it's kept out of robots.txt's crawl.
export const Route = createFileRoute('/feed')({
  beforeLoad: ({ context, location }) => {
    // UX guard only; `getFeed` enforces the session itself.
    if (!context.viewer) throw redirect({ to: '/sign-in', search: { redirect: location.href } })
  },
  loader: () => getFeed(),
  head: () => ({ meta: [{ title: 'Seguindo · Lanterninha' }, { name: 'robots', content: 'noindex' }] }),
  component: FeedPage,
})

function FeedPage() {
  const { following, reviews, suggestions } = Route.useLoaderData()
  return (
    <>
      <header className="page-head">
        <p className="eyebrow">Seguindo</p>
        <h1>Sessões de quem você segue</h1>
        <p className="muted">
          {following === 0
            ? 'Siga outras pessoas para ver aqui as salas que elas avaliam.'
            : `Avaliações recentes de ${pluralize(following, 'pessoa', 'pessoas')} que você segue.`}
        </p>
      </header>

      <div className="split">
        <section className="section" aria-label="Avaliações">
          {reviews.length === 0 ? (
            <div className="empty-state">
              <h2>{following === 0 ? 'Seu feed está vazio' : 'Nada novo por aqui'}</h2>
              <p className="muted">
                {following === 0
                  ? 'Comece seguindo alguém ao lado, ou abra o perfil de quem escreveu uma avaliação que você curtiu.'
                  : 'Quem você segue ainda não avaliou nenhuma sala.'}
              </p>
              <Button asChild>
                <Link to="/cinemas">Explorar cinemas</Link>
              </Button>
            </div>
          ) : (
            <div className="stack">
              {reviews.map((review) => (
                <ReviewItem key={review.id} review={review} />
              ))}
            </div>
          )}
        </section>

        {suggestions.length > 0 && (
          <aside className="section">
            <h2>Quem seguir</h2>
            <ul className="suggestions">
              {suggestions.map((s) => (
                <li key={s.username}>
                  <Link to="/users/$username" params={{ username: s.username }} className="review-user">
                    <span className="avatar" aria-hidden="true">
                      {s.username.slice(0, 1).toUpperCase()}
                    </span>
                    @{s.username}
                  </Link>
                  <span className="muted">
                    {pluralize(s.reviews, 'avaliação', 'avaliações')}
                    {s.helpful > 0 && ` · ${pluralize(s.helpful, 'voto útil', 'votos úteis')}`}
                  </span>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </>
  )
}
