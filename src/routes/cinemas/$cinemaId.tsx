import { createFileRoute } from '@tanstack/react-router'
import { getCinema } from '~/functions/rooms.functions'
import { pluralize } from '~/lib/format'
import { RoomCard } from '~/components/room-card'

// SSR: full. Small, cacheable, SEO-relevant page — nothing worth deferring.
export const Route = createFileRoute('/cinemas/$cinemaId')({
  loader: ({ params }) => getCinema({ data: { id: params.cinemaId } }),
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
  const { cinema, rooms } = Route.useLoaderData()
  const mapsUrl = `https://www.openstreetmap.org/?mlat=${cinema.lat}&mlon=${cinema.lng}#map=17/${cinema.lat}/${cinema.lng}`

  return (
    <>
      <header className="page-head">
        <p className="eyebrow">{cinema.chain}</p>
        <h1>{cinema.name}</h1>
        <p className="muted">
          {cinema.address} · {cinema.neighborhood}, {cinema.city}/{cinema.state} ·{' '}
          <a href={mapsUrl} target="_blank" rel="noreferrer">
            ver no mapa
          </a>
        </p>
      </header>
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
