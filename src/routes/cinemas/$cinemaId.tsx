import { Await, createFileRoute } from '@tanstack/react-router'
import { getCinema, getProgramme } from '~/functions/rooms.functions'
import { Programme, ProgrammeSkeleton } from '~/components/programme'
import { pluralize } from '~/lib/format'
import { RoomCard } from '~/components/room-card'

// SSR: full. Small, cacheable, SEO-relevant page — nothing worth deferring.
export const Route = createFileRoute('/cinemas/$cinemaId')({
  // The cinema is awaited (head, 404); its programme streams in.
  loader: async ({ params }) => {
    const programme = getProgramme({ data: { cinemaId: params.cinemaId } })
    return { ...(await getCinema({ data: { id: params.cinemaId } })), programme }
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.cinema.name} · Lanterninha` },
          {
            name: 'description',
            content: `${pluralize(loaderData.rooms.length, 'sala', 'salas')} do ${loaderData.cinema.name} em ${loaderData.cinema.city}/${loaderData.cinema.state}, avaliadas pela comunidade.`,
          },
        ]
      : [],
  }),
  component: CinemaPage,
})

function CinemaPage() {
  const { cinema, rooms, programme } = Route.useLoaderData()
  const mapsUrl =
    cinema.lat != null && cinema.lng != null
      ? `https://www.openstreetmap.org/?mlat=${cinema.lat}&mlon=${cinema.lng}#map=17/${cinema.lat}/${cinema.lng}`
      : null
  const wheelchairSeats = rooms.reduce((n, r) => n + r.wheelchairSeats, 0)

  return (
    <>
      <header className="page-head">
        <p className="eyebrow">{cinema.chain}</p>
        <h1>{cinema.name}</h1>
        <p className="muted">
          {cinema.address} · {cinema.neighborhood}, {cinema.city}/{cinema.state}
          {cinema.cep && ` · CEP ${cinema.cep}`}
        </p>
        <p className="cinema-links">
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noreferrer">
              Ver no mapa{cinema.geoPrecision === 'city' && ' (localização aproximada)'}
            </a>
          )}
          {cinema.website && (
            <a href={cinema.website} target="_blank" rel="noreferrer nofollow">
              Site do cinema
            </a>
          )}
          <span className="muted">
            {pluralize(rooms.reduce((n, r) => n + r.seats, 0), 'lugar', 'lugares')} ·{' '}
            {pluralize(wheelchairSeats, 'lugar', 'lugares')} p/ cadeirantes
          </span>
        </p>
      </header>
      <Await promise={programme} fallback={<ProgrammeSkeleton />}>
        {(p) => <Programme {...p} showRoom />}
      </Await>
      <section className="section">
        <h2>{pluralize(rooms.length, 'sala', 'salas')}</h2>
        <div className="grid">
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} showCinema={false} />
          ))}
        </div>
      </section>
    </>
  )
}
