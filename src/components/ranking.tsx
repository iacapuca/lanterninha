import { Link } from '@tanstack/react-router'
import { FORMATS, NATIONAL_SLUG, type Format, type RoomSummary } from '~/lib/domain'
import { pluralize } from '~/lib/format'
import type { RankingPlace } from '~/functions/rankings.functions'
import { SITE_URL, shareMeta } from '~/lib/site'
import { RoomCard } from './room-card'
import { Button } from './ui/button'

/** "São Paulo/SP" or "Brasil". */
export const placeName = (place: RankingPlace) => (place ? `${place.city}/${place.state}` : 'Brasil')

/** "As melhores salas IMAX de São Paulo/SP", "As melhores salas de cinema do Brasil". */
export function rankingTitle(place: RankingPlace, format: Format | null) {
  const what = format ? `salas ${FORMATS[format]}` : 'salas de cinema'
  return `As melhores ${what} ${place ? 'de' : 'do'} ${placeName(place)}`
}

/** Ranked room cards; the order is the ranking (see store.rankRooms). */
export function RankedRooms({ rooms }: { rooms: RoomSummary[] }) {
  return (
    <ol className="grid ranking">
      {rooms.map((room, i) => (
        <li key={room.id}>
          <span className="ranking-position" aria-label={`${i + 1}º lugar`}>
            {i + 1}º
          </span>
          <RoomCard room={room} />
        </li>
      ))}
    </ol>
  )
}

type Props = {
  place: RankingPlace
  format: Format | null
  rooms: RoomSummary[]
  /** Special formats with reviewed rooms here, for the chips. */
  formats: Format[]
}

export function RankingPage({ place, format, rooms, formats }: Props) {
  const slug = place?.slug ?? NATIONAL_SLUG
  return (
    <>
      <header className="page-head">
        <p className="eyebrow">
          <Link to="/melhores-salas">Melhores salas</Link> · {placeName(place)}
        </p>
        <h1>{rankingTitle(place, format)}</h1>
        <p className="muted">
          Ranking pelas notas da comunidade. Salas com poucas avaliações começam perto da média do site e sobem conforme
          mais gente avalia.
        </p>
      </header>

      {(formats.length > 0 || format) && (
        <nav className="chip-list" aria-label="Formato">
          <Link
            to="/melhores-salas/$place"
            params={{ place: slug }}
            className="chip"
            activeOptions={{ exact: true }}
            activeProps={{ className: 'chip active' }}
          >
            Todas
          </Link>
          {[...new Set([...formats, ...(format ? [format] : [])])].map((f) => (
            <Link
              key={f}
              to="/melhores-salas/$place/$format"
              params={{ place: slug, format: f }}
              className="chip"
              activeProps={{ className: 'chip active' }}
            >
              {FORMATS[f]}
            </Link>
          ))}
        </nav>
      )}

      <section className="section">
        {rooms.length === 0 ? (
          <div className="empty-state">
            <h2>Nenhuma sala avaliada aqui ainda</h2>
            <p className="muted">O ranking começa com a primeira avaliação. Que tal ser você?</p>
            <Button asChild>
              <Link to="/cinemas" search={{ city: place?.city, state: place?.state, format: format ?? undefined }}>
                Encontrar uma sala
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <p className="muted">{pluralize(rooms.length, 'sala no ranking', 'salas no ranking')}</p>
            <RankedRooms rooms={rooms} />
          </>
        )}
      </section>
    </>
  )
}

/** Head tags shared by the city and city+format pages; empty rankings stay out of search results. */
export function rankingHead(data: Props | undefined) {
  if (!data) return {}
  const title = `${rankingTitle(data.place, data.format)} · Lanterninha`
  const top = data.rooms[0]
  const description = top
    ? `${rankingTitle(data.place, data.format)}, segundo quem estava lá. Em 1º: ${top.name}, ${top.cinema.name}.`
    : `${rankingTitle(data.place, data.format)}: seja a primeira pessoa a avaliar.`
  const slug = data.place?.slug ?? NATIONAL_SLUG
  const path = `/melhores-salas/${slug}${data.format ? `/${data.format}` : ''}`
  return {
    meta: [
      { title },
      { name: 'description', content: description },
      ...(data.rooms.length === 0 ? [{ name: 'robots', content: 'noindex' }] : []),
      ...shareMeta({
        title,
        description,
        path,
        image: `/og/ranking/${slug}${data.format ? `/${data.format}` : ''}`,
        version: data.rooms
          .slice(0, 3)
          .map((r) => `${r.id}:${r.reviewCount}`)
          .join(','),
      }),
    ],
    links: [{ rel: 'canonical', href: `${SITE_URL}${path}` }],
  }
}
