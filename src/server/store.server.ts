// The only module that touches persistence. The `.server.ts` suffix puts it
// behind Start's import protection: importing it from client code fails the build.
//
// Storage is an in-memory array seeded at boot, which keeps the demo
// dependency-free on every runtime. Swap these function bodies for D1,
// Postgres or KV without touching routes or server functions.
import type { Cinema, Criterion, Review, ReviewWithRoom, RoomStats, RoomSummary, Tag } from '~/lib/domain'
import { CRITERION_IDS, RATINGS } from '~/lib/domain'
import type { ExploreSearch, NewReview } from '~/lib/schemas'
import { CINEMAS, ROOMS, SEED_REVIEWS } from './seed.server'

const reviews: Review[] = [...SEED_REVIEWS]
const cinemasById = new Map(CINEMAS.map((c) => [c.id, c]))
const roomsById = new Map(ROOMS.map((r) => [r.id, r]))

const PAGE_SIZE = 9

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function average(xs: number[]) {
  if (xs.length === 0) return null
  return Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10
}

const newestFirst = (a: Review, b: Review) => b.createdAt.localeCompare(a.createdAt)

function reviewsFor(roomId: string) {
  return reviews.filter((r) => r.roomId === roomId)
}

function summarize(roomId: string): RoomSummary | null {
  const room = roomsById.get(roomId)
  const cinema = room && cinemasById.get(room.cinemaId)
  if (!room || !cinema) return null
  const ratings = reviewsFor(room.id).map((r) => r.rating)
  return { ...room, cinema, average: average(ratings), reviewCount: ratings.length }
}

function allSummaries() {
  return ROOMS.map((r) => summarize(r.id)!)
}

function withRoom(review: Review): ReviewWithRoom {
  const s = summarize(review.roomId)!
  return {
    ...review,
    room: { id: s.id, name: s.name, format: s.format },
    cinema: { id: s.cinema.id, name: s.cinema.name, city: s.cinema.city, state: s.cinema.state },
  }
}

export function searchRooms(filters: ExploreSearch) {
  const q = filters.q ? fold(filters.q) : null
  const matches = allSummaries().filter((s) => {
    if (filters.state && s.cinema.state !== filters.state) return false
    if (filters.city && fold(s.cinema.city) !== fold(filters.city)) return false
    if (filters.format && s.format !== filters.format) return false
    if (q) {
      const haystack = fold(
        `${s.name} ${s.cinema.name} ${s.cinema.chain} ${s.cinema.neighborhood} ${s.cinema.city}`,
      )
      if (!haystack.includes(q)) return false
    }
    return true
  })

  const lastReviewAt = (id: string) =>
    reviewsFor(id).reduce((max, r) => (r.createdAt > max ? r.createdAt : max), '')
  matches.sort((a, b) => {
    switch (filters.sort) {
      case 'rating':
        return (b.average ?? 0) - (a.average ?? 0) || b.reviewCount - a.reviewCount
      case 'reviews':
        return b.reviewCount - a.reviewCount
      case 'recent':
        return lastReviewAt(b.id).localeCompare(lastReviewAt(a.id))
      case 'name':
        return (
          a.cinema.name.localeCompare(b.cinema.name, 'pt-BR') || a.name.localeCompare(b.name, 'pt-BR')
        )
    }
  })

  const total = matches.length
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Math.min(filters.page, pageCount)
  return {
    rooms: matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    total,
    page,
    pageCount,
  }
}

export function listCities() {
  const counts = new Map<string, { city: string; state: Cinema['state']; rooms: number }>()
  for (const room of ROOMS) {
    const { city, state } = cinemasById.get(room.cinemaId)!
    const entry = counts.get(city) ?? { city, state, rooms: 0 }
    entry.rooms++
    counts.set(city, entry)
  }
  return [...counts.values()].sort((a, b) => b.rooms - a.rooms)
}

export function getRoom(id: string) {
  return summarize(id)
}

export function getRoomReviews(roomId: string, sort: 'recent' | 'best' | 'worst') {
  const list = reviewsFor(roomId)
  if (sort === 'best') return list.sort((a, b) => b.rating - a.rating || newestFirst(a, b))
  if (sort === 'worst') return list.sort((a, b) => a.rating - b.rating || newestFirst(a, b))
  return list.sort(newestFirst)
}

export function getRoomStats(roomId: string): RoomStats {
  const list = reviewsFor(roomId)

  const histogram: Record<string, number> = Object.fromEntries(RATINGS.map((n) => [String(n), 0]))
  for (const r of list) histogram[String(r.rating)] = (histogram[String(r.rating)] ?? 0) + 1

  const criteriaAverages = Object.fromEntries(
    CRITERION_IDS.map((c) => [c, average(list.map((r) => r.criteria[c]))]),
  ) as Record<Criterion, number | null>

  const ratingsByRow = new Map<string, number[]>()
  for (const r of list) {
    if (r.row) ratingsByRow.set(r.row, [...(ratingsByRow.get(r.row) ?? []), r.rating])
  }
  const rows = [...ratingsByRow.entries()]
  // Best-rated row with at least two mentions; otherwise the most mentioned one.
  const bestRow =
    rows
      .filter(([, ratings]) => ratings.length >= 2)
      .sort((a, b) => (average(b[1]) ?? 0) - (average(a[1]) ?? 0))[0]?.[0] ??
    rows.sort((a, b) => b[1].length - a[1].length)[0]?.[0] ??
    null

  const tagCounts = new Map<Tag, number>()
  for (const r of list) for (const tag of r.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)

  return {
    histogram,
    criteriaAverages,
    bestRow,
    topTags: [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([tag, count]) => ({ tag, count })),
  }
}

export function getCinema(id: string) {
  const cinema = cinemasById.get(id)
  if (!cinema) return null
  const rooms = ROOMS.filter((r) => r.cinemaId === id).map((r) => summarize(r.id)!)
  return { cinema, rooms }
}

export function getRecentReviews(limit: number) {
  return [...reviews].sort(newestFirst).slice(0, limit).map(withRoom)
}

export function getTopRooms(limit: number) {
  return allSummaries()
    .filter((s) => s.reviewCount >= 4)
    .sort((a, b) => (b.average ?? 0) - (a.average ?? 0))
    .slice(0, limit)
}

export function getTotals() {
  return {
    rooms: ROOMS.length,
    cinemas: CINEMAS.length,
    cities: new Set(CINEMAS.map((c) => c.city)).size,
    reviews: reviews.length,
  }
}

export function getUserProfile(username: string) {
  const list = reviews.filter((r) => r.username === username).sort(newestFirst)
  if (list.length === 0) return null
  const cities = new Set(list.map((r) => cinemasById.get(roomsById.get(r.roomId)!.cinemaId)!.city))
  return {
    username,
    reviews: list.map(withRoom),
    average: average(list.map((r) => r.rating)),
    cities: [...cities],
  }
}

export function getCinemaLocations() {
  return CINEMAS.map((cinema) => {
    const rooms = ROOMS.filter((r) => r.cinemaId === cinema.id)
    const ratings = rooms.flatMap((r) => reviewsFor(r.id).map((rv) => rv.rating))
    return { ...cinema, roomCount: rooms.length, average: average(ratings), reviewCount: ratings.length }
  })
}

export function getSitemapIds() {
  return { rooms: ROOMS.map((r) => r.id), cinemas: CINEMAS.map((c) => c.id) }
}

export type CreateReviewResult =
  | { ok: true; review: Review }
  | { ok: false; reason: 'unknown-room' | 'duplicate' }

export function createReview(username: string, input: NewReview): CreateReviewResult {
  if (!roomsById.has(input.roomId)) return { ok: false, reason: 'unknown-room' }
  const today = new Date().toISOString().slice(0, 10)
  const duplicate = reviews.some(
    (r) => r.username === username && r.roomId === input.roomId && r.createdAt.startsWith(today),
  )
  if (duplicate) return { ok: false, reason: 'duplicate' }

  const review: Review = {
    ...input,
    id: crypto.randomUUID(),
    username,
    createdAt: new Date().toISOString(),
  }
  reviews.push(review)
  return { ok: true, review }
}
