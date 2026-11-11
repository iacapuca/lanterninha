import { FORMATS } from '~/lib/domain'
import { loadRanking } from '../rankings.server'
import { TicketCard, plural } from './cards.server'

/** Share card for a ranking: the place on the ticket, its #1 room underneath. */
export async function rankingCard(placeSlug: string, formatSlug?: string) {
  const ranking = await loadRanking(placeSlug, formatSlug, 30)
  if (!ranking) return null
  const { place, format, rooms } = ranking
  const top = rooms[0]
  return TicketCard({
    kicker: format ? `Melhores salas ${FORMATS[format]}` : 'Melhores salas de cinema',
    title: place ? `${place.city}/${place.state}` : 'Brasil',
    subtitle: top ? `1º ${top.name} · ${top.cinema.name}` : 'Seja a primeira pessoa a avaliar',
    chips: rooms.length > 0 ? [plural(rooms.length, 'sala no ranking', 'salas no ranking')] : [],
    rating: top?.average ?? null,
    reviewCount: top?.reviewCount ?? 0,
  })
}
