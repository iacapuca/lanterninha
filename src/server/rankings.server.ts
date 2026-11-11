// Rankings (/melhores-salas): resolving place and format slugs, shared by the
// pages' server functions and their share cards.
import { FORMAT_IDS, NATIONAL_SLUG, citySlug, type Format, type State } from '~/lib/domain'
import * as store from './store.server'

export type RankingPlace = { slug: string; city: string; state: State } | null

/** Index rows rolled up per city (all formats) and per special format, busiest cities first. */
export function summarizeRankingIndex(index: Awaited<ReturnType<typeof store.getRankingIndex>>) {
  const places = new Map<string, { slug: string; city: string; state: State; rooms: number; reviews: number }>()
  const formats = new Set<Format>()
  for (const row of index) {
    const slug = citySlug(row.city, row.state)
    const place = places.get(slug) ?? { slug, city: row.city, state: row.state, rooms: 0, reviews: 0 }
    place.rooms += row.rooms
    place.reviews += row.reviews
    places.set(slug, place)
    if (row.format && row.format !== 'standard') formats.add(row.format)
  }
  return {
    places: [...places.values()].sort((a, b) => b.reviews - a.reviews || a.city.localeCompare(b.city, 'pt-BR')),
    formats: FORMAT_IDS.filter((f) => formats.has(f)),
  }
}

/** Null when the place or format doesn't exist. Any city with a cinema has a page, even before its first review. */
export async function loadRanking(placeSlug: string, formatSlug: string | undefined, limit = 30) {
  const format = formatSlug as Format | undefined
  if (format && !FORMAT_IDS.includes(format)) return null

  let place: RankingPlace = null
  if (placeSlug !== NATIONAL_SLUG) {
    const found = (await store.listCities()).find((c) => citySlug(c.city, c.state) === placeSlug)
    if (!found) return null
    place = { slug: placeSlug, city: found.city, state: found.state }
  }

  const [rooms, index] = await Promise.all([
    store.rankRooms({ city: place?.city, state: place?.state, format }, limit),
    store.getRankingIndex(),
  ])
  const here = index.filter((r) => !place || (r.city === place.city && r.state === place.state))
  return { place, format: format ?? null, rooms, formats: summarizeRankingIndex(here).formats }
}
