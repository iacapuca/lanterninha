import { Await, Link, createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { getRoom, getRoomReviews, getRoomStats } from '~/functions/rooms.functions'
import { CRITERIA, CRITERION_IDS, RATINGS, type RoomStats } from '~/lib/domain'
import { formatRating, pluralize } from '~/lib/format'
import { REVIEW_SORTS, ROOM_SEARCH_DEFAULTS, roomSearchSchema } from '~/lib/schemas'
import { Lanterns } from '~/components/lanterns'
import { ReviewItem, ReviewListSkeleton } from '~/components/review-item'
import { Ticket, ticketSerial } from '~/components/ticket'
import { RoomFacts } from '~/components/room-facts'

const REVIEW_SORT_LABELS = { recent: 'Recentes', best: 'Melhores', worst: 'Piores' } as const

// SSR: full, with streaming. The room itself is awaited (it drives <head>,
// the 404 status and the hero), while stats and reviews are deferred and
// stream into their Suspense boundaries as each query resolves.
export const Route = createFileRoute('/rooms/$roomId/')({
  validateSearch: roomSearchSchema,
  search: { middlewares: [stripSearchParams(ROOM_SEARCH_DEFAULTS)] },
  loaderDeps: ({ search }) => ({ reviews: search.reviews }),
  loader: async ({ params, deps }) => {
    const stats = getRoomStats({ data: { id: params.roomId } })
    const reviews = getRoomReviews({ data: { id: params.roomId, reviews: deps.reviews } })
    const room = await getRoom({ data: { id: params.roomId } })
    return { room, stats, reviews }
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {}
    const { room } = loaderData
    const title = `${room.name} — ${room.cinema.name} · Lanterninha`
    const description = `${room.name} no ${room.cinema.name} (${room.cinema.city}/${room.cinema.state}): nota ${formatRating(room.average)} em ${pluralize(room.reviewCount, 'avaliação', 'avaliações')}.`
    return {
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
      ],
      scripts: [
        {
          type: 'application/ld+json',
          children: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'MovieTheater',
            name: `${room.cinema.name} — ${room.name}`,
            address: {
              '@type': 'PostalAddress',
              streetAddress: room.cinema.address,
              addressLocality: room.cinema.city,
              addressRegion: room.cinema.state,
              addressCountry: 'BR',
            },
            ...(room.average != null && {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: room.average,
                bestRating: 5,
                reviewCount: room.reviewCount,
              },
            }),
          }),
        },
      ],
    }
  },
  component: RoomPage,
})

function RoomPage() {
  const { room, stats, reviews } = Route.useLoaderData()
  const search = Route.useSearch()

  return (
    <>
      <Ticket
        className="room-hero"
        stub={
          <div className="room-hero-stub">
            <span className="ticket-kicker">Nota da comunidade</span>
            <strong className="ticket-score">{formatRating(room.average)}</strong>
            <Lanterns rating={room.average} size={22} />
            <span>{pluralize(room.reviewCount, 'avaliação', 'avaliações')}</span>
            <Link to="/rooms/$roomId/review" params={{ roomId: room.id }} className="button">
              Avaliar esta sala
            </Link>
          </div>
        }
      >
        <p className="ticket-kicker">
          <span>Ingresso · {room.cinema.chain}</span>
          <span>{ticketSerial(room.id)}</span>
        </p>
        <p className="room-hero-cinema">
          <Link to="/cinemas/$cinemaId" params={{ cinemaId: room.cinema.id }}>
            {room.cinema.name}
          </Link>{' '}
          · {room.cinema.neighborhood}, {room.cinema.city}/{room.cinema.state}
        </p>
        <h1>{room.name}</h1>
        <dl className="ticket-fields">
          <div>
            <dt>Lugares</dt>
            <dd>{room.seats}</dd>
          </div>
          <div>
            <dt>Acessibilidade</dt>
            <dd>
              {room.wheelchairSeats > 0
                ? `${pluralize(room.wheelchairSeats, 'lugar', 'lugares')} p/ cadeirantes`
                : 'Sem lugares p/ cadeirantes'}
              {room.reducedMobilitySeats > 0 && ` · ${room.reducedMobilitySeats} mob. reduzida`}
              {room.accessibleRestroom && ' · banheiro acessível'}
            </dd>
          </div>
        </dl>
        <RoomFacts
          roomId={room.id}
          values={{ format: room.format, projection: room.projection, sound: room.sound }}
          sources={{ format: room.formatSource, projection: room.projectionSource, sound: room.soundSource }}
          votes={room.facts.votes}
          mine={room.facts.mine}
        />
      </Ticket>

      <div className="split">
        <section className="section">
          <div className="section-head">
            <h2>O que dizem</h2>
            <nav className="tabs" aria-label="Ordenar avaliações">
              {REVIEW_SORTS.map((sort) => (
                <Link
                  key={sort}
                  from={Route.fullPath}
                  search={{ reviews: sort }}
                  replace
                  resetScroll={false}
                  className={search.reviews === sort ? 'active' : undefined}
                >
                  {REVIEW_SORT_LABELS[sort]}
                </Link>
              ))}
            </nav>
          </div>
          <Await promise={reviews} fallback={<ReviewListSkeleton />}>
            {(list) =>
              list.length === 0 ? (
                <p className="muted">Ninguém avaliou esta sala ainda. Seja a primeira pessoa!</p>
              ) : (
                <div className="stack">
                  {list.map((review) => (
                    <ReviewItem key={review.id} review={review} />
                  ))}
                </div>
              )
            }
          </Await>
        </section>

        <aside className="section">
          <Await promise={stats} fallback={<div className="panel skeleton" style={{ height: 320 }} />}>
            {(s) => <StatsPanel stats={s} />}
          </Await>
        </aside>
      </div>
    </>
  )
}

function StatsPanel({ stats }: { stats: RoomStats }) {
  const max = Math.max(1, ...Object.values(stats.histogram))
  return (
    <div className="panel">
      <h2>Raio-x da sala</h2>

      <div className="histogram" aria-label="Distribuição das notas">
        {RATINGS.map((n) => {
          const count = stats.histogram[String(n)] ?? 0
          return (
            <div key={n} className="histogram-bar" title={`${n}: ${count}`}>
              <span style={{ height: `${(count / max) * 100}%` }} />
            </div>
          )
        })}
      </div>
      <div className="histogram-axis muted">
        <span>½</span>
        <span>5</span>
      </div>

      <dl className="criteria">
        {CRITERION_IDS.map((c) => {
          const value = stats.criteriaAverages[c]
          return (
            <div key={c}>
              <dt>{CRITERIA[c]}</dt>
              <dd>
                <meter min={0} max={5} value={value ?? 0} />
                <span>{formatRating(value)}</span>
              </dd>
            </div>
          )
        })}
      </dl>

      {stats.bestRow && (
        <p className="best-row">
          <span className="muted">Fileira preferida pela comunidade</span>
          <strong>{stats.bestRow}</strong>
        </p>
      )}

      {stats.topTags.length > 0 && (
        <ul className="tags">
          {stats.topTags.map(({ tag, count }) => (
            <li key={tag}>
              {tag} <span className="muted">×{count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
