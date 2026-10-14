import { Link, createFileRoute } from '@tanstack/react-router'
import { getUserProfile } from '~/functions/rooms.functions'
import { formatRating, pluralize } from '~/lib/format'
import { Lanterns } from '~/components/lanterns'
import { ReviewItem } from '~/components/review-item'

// SSR: full. A user's public diary of screenings.
export const Route = createFileRoute('/users/$username')({
  loader: ({ params }) => getUserProfile({ data: { username: params.username } }),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `@${loaderData.username} · Lanterninha` : 'Perfil · Lanterninha' }],
  }),
  notFoundComponent: () => {
    const { username } = Route.useParams()
    return (
      <section className="empty-state">
        <h1>Não encontramos @{username}</h1>
        <p className="muted">Confira se o nome de usuário está certo.</p>
      </section>
    )
  },
  component: ProfilePage,
})

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
              {profile.cities.join(', ')} · média {formatRating(profile.average)}{' '}
              <Lanterns rating={profile.average} size={14} />
            </p>
          )}
        </div>
      </header>
      {profile.reviews.length === 0 ? (
        <section className="empty-state">
          <h2>Nenhuma sessão no diário ainda</h2>
          <p className="muted">As avaliações de @{profile.username} vão aparecer aqui.</p>
          <Link to="/rooms" className="button">
            Encontrar uma sala
          </Link>
        </section>
      ) : (
        <div className="stack">
          {profile.reviews.map((review) => (
            <ReviewItem key={review.id} review={review} />
          ))}
        </div>
      )}
    </>
  )
}
