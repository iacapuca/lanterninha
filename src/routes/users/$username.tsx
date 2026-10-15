import { Link, createFileRoute } from '@tanstack/react-router'
import { getUserProfile } from '~/functions/rooms.functions'
import { formatRating, pluralize } from '~/lib/format'
import { BADGES, badgeImage } from '~/lib/domain'
import { Lanterns } from '~/components/lanterns'
import { ReviewItem } from '~/components/review-item'
import { Button } from '~/components/ui/button'

// SSR: full. A user's public diary of screenings.
export const Route = createFileRoute('/users/$username')({
  loader: ({ params }) => getUserProfile({ data: { username: params.username } }),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `@${loaderData.username} · Lanterninha` : 'Perfil · Lanterninha' }],
  }),
  notFoundComponent: ProfileNotFound,
  component: ProfilePage,
})

function ProfileNotFound() {
  const { username } = Route.useParams()
  return (
    <section className="empty-state">
      <h1>Não encontramos @{username}</h1>
      <p className="muted">Confira se o nome de usuário está certo.</p>
    </section>
  )
}

function ProfilePage() {
  const profile = Route.useLoaderData()
  return (
    <>
      <header className="page-head profile-head">
        <span className="avatar avatar-large" aria-hidden="true">
          {profile.username.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <p className="eyebrow">Diário de sessões</p>
          <h1>@{profile.username}</h1>
          {profile.reviews.length > 0 && (
            <p className="muted">
              {pluralize(profile.reviews.length, 'sala avaliada', 'salas avaliadas')} em{' '}
              {profile.cities.length > 3 ? pluralize(profile.cities.length, 'cidade', 'cidades') : profile.cities.join(', ')} · média{' '}
              {formatRating(profile.average)}{' '}
              <Lanterns rating={profile.average} size={14} />
            </p>
          )}
        </div>
      </header>

      <section className="section" aria-labelledby="badges-title">
        <div className="section-head">
          <h2 id="badges-title">Coleção</h2>
          <span className="muted">
            {profile.badges.length} de {BADGES.length} conquistadas
          </span>
        </div>
        {/* Earned stubs first, then the closest goals. */}
        <ul className="badge-grid">
          {[...BADGES]
            .map((badge) => ({ badge, done: Math.min(profile.stats[badge.metric], badge.goal) }))
            .sort((a, b) => Number(b.done >= b.badge.goal) - Number(a.done >= a.badge.goal) || b.done / b.badge.goal - a.done / a.badge.goal)
            .map(({ badge, done }) => {
              const earned = done >= badge.goal
              return (
                <li key={badge.id} className={earned ? 'badge-stub earned' : 'badge-stub'}>
                  <img className="badge-stub-art" src={badgeImage(badge.id)} alt="" width={112} height={112} loading="lazy" />
                  <strong>{badge.name}</strong>
                  <span className="badge-stub-hint">{badge.hint}</span>
                  {earned ? (
                    <span className="badge-stub-status">Conquistada</span>
                  ) : badge.goal > 1 ? (
                    <span className="badge-stub-progress" aria-label={`${done} de ${badge.goal}`}>
                      <span className="badge-stub-bar">
                        <span style={{ width: `${(done / badge.goal) * 100}%` }} />
                      </span>
                      {done}/{badge.goal}
                    </span>
                  ) : (
                    <span className="badge-stub-status locked">Bloqueada</span>
                  )}
                </li>
              )
            })}
        </ul>
      </section>

      {profile.reviews.length === 0 ? (
        <section className="empty-state">
          <h2>Nenhuma sessão no diário ainda</h2>
          <p className="muted">As avaliações de @{profile.username} vão aparecer aqui.</p>
          <Button asChild>
            <Link to="/cinemas">Encontrar uma sala</Link>
          </Button>
        </section>
      ) : (
        <section className="section" aria-labelledby="diary-title">
          <div className="section-head">
            <h2 id="diary-title">Diário</h2>
            <span className="muted">{pluralize(profile.reviews.length, 'sessão', 'sessões')}</span>
          </div>
          <div className="stack">
            {profile.reviews.map((review) => (
              <ReviewItem key={review.id} review={review} />
            ))}
          </div>
        </section>
      )}
    </>
  )
}
