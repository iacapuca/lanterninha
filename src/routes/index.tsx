import { Await, Link, createFileRoute } from '@tanstack/react-router'
import { getHome, getRecentReviews } from '~/functions/rooms.functions'
import { FORMATS, FORMAT_IDS } from '~/lib/domain'
import { ReviewItem, ReviewListSkeleton } from '~/components/review-item'
import { RoomCard } from '~/components/room-card'
import { Ticket, ticketSerial } from '~/components/ticket'

// SSR: full (default). Critical data is awaited and rendered into the HTML;
// the recent-reviews feed is a deferred promise that streams in afterwards.
export const Route = createFileRoute('/')({
  loader: async () => {
    const recentReviews = getRecentReviews({ data: { limit: 6 } }) // not awaited → streamed
    const home = await getHome()
    return { ...home, recentReviews }
  },
  component: HomePage,
})

const CITIES = ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Brasília', 'Recife', 'Porto Alegre']

function HomePage() {
  const { topRooms, totals, recentReviews } = Route.useLoaderData()

  return (
    <>
      <section className="hero">
        <p className="eyebrow">Avaliações colaborativas de salas de cinema</p>
        <h1>
          O filme você já escolheu.
          <br />
          <em>Agora escolha a sala.</em>
        </h1>
        <p className="hero-lede">
          Tela, som, poltrona e limpeza avaliados por quem estava lá. Descubra a melhor fileira, fuja
          do ar-condicionado polar e conte como foi a sua sessão.
        </p>
        <form method="get" action="/rooms" className="hero-search">
          <label htmlFor="hero-q" className="sr-only">
            Buscar sala ou cinema
          </label>
          <input id="hero-q" name="q" placeholder="Odeon, IMAX, Belas Artes…" autoComplete="off" />
          <button type="submit" className="button">
            Buscar
          </button>
        </form>
        <Ticket
          className="totals-ticket"
          stub={
            <Link to="/rooms" className="totals-stub">
              <span className="ticket-kicker">Sua vez</span>
              <strong>Avaliar uma sala →</strong>
            </Link>
          }
        >
          <p className="ticket-kicker">
            <span>Sessão de hoje · lanterninha</span>
            <span>{ticketSerial(String(totals.reviews))}</span>
          </p>
          <dl className="totals">
            <div>
              <dt>salas</dt>
              <dd>{totals.rooms}</dd>
            </div>
            <div>
              <dt>cinemas</dt>
              <dd>{totals.cinemas}</dd>
            </div>
            <div>
              <dt>cidades</dt>
              <dd>{totals.cities}</dd>
            </div>
            <div>
              <dt>avaliações</dt>
              <dd>{totals.reviews}</dd>
            </div>
          </dl>
        </Ticket>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>As salas mais bem avaliadas</h2>
          <Link to="/rooms" search={{ sort: 'rating' }}>
            Ver todas →
          </Link>
        </div>
        <div className="grid">
          {topRooms.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
      </section>

      <div className="split">
        <section className="section">
          <div className="section-head">
            <h2>Saindo da sessão agora</h2>
          </div>
          <Await promise={recentReviews} fallback={<ReviewListSkeleton />}>
            {(reviews) => (
              <div className="stack">
                {reviews.map((review) => (
                  <ReviewItem key={review.id} review={review} />
                ))}
              </div>
            )}
          </Await>
        </section>

        <aside className="section">
          <h2>Por cidade</h2>
          <ul className="chip-list">
            {CITIES.map((city) => (
              <li key={city}>
                <Link to="/rooms" search={{ city }} className="chip">
                  {city}
                </Link>
              </li>
            ))}
          </ul>
          <h2>Por formato</h2>
          <ul className="chip-list">
            {FORMAT_IDS.map((format) => (
              <li key={format}>
                <Link to="/rooms" search={{ format }} className="chip">
                  {FORMATS[format]}
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  )
}
