// The only module that queries the database. The `.server.ts` suffix puts it
// behind Start's import protection: importing it from client code fails the build.
import { and, asc, count, desc, eq, gte, sql, type SQL } from 'drizzle-orm'
import type { Criterion, Review, ReviewWithRoom, RoomStats, RoomSummary, Tag } from '~/lib/domain'
import { CRITERION_IDS, RATINGS } from '~/lib/domain'
import type { ExploreSearch, NewReview } from '~/lib/schemas'
import { db } from './db/client.server'
import { cinema, review, room } from './db/schema.server'

const PAGE_SIZE = 9

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const round1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10)

function average(xs: number[]) {
  if (xs.length === 0) return null
  return round1(xs.reduce((a, b) => a + b, 0) / xs.length)
}

/** Calendar day in São Paulo, used for the one-review-per-room-per-day rule. */
const saoPauloDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' })

// ---------- Room summaries ----------

const roomStats = db
  .select({
    roomId: review.roomId,
    average: sql<number>`avg(${review.rating})`.as('average'),
    reviewCount: sql<number>`count(*)`.as('review_count'),
    lastReviewAt: sql<number>`max(${review.createdAt})`.as('last_review_at'),
  })
  .from(review)
  .groupBy(review.roomId)
  .as('room_stats')

const reviewCountOrZero = sql<number>`coalesce(${roomStats.reviewCount}, 0)`

const summaryFields = {
  id: room.id,
  cinemaId: room.cinemaId,
  name: room.name,
  format: room.format,
  seats: room.seats,
  projection: room.projection,
  sound: room.sound,
  accessible: room.accessible,
  cinema: {
    id: cinema.id,
    name: cinema.name,
    chain: cinema.chain,
    city: cinema.city,
    state: cinema.state,
    neighborhood: cinema.neighborhood,
    address: cinema.address,
    lat: cinema.lat,
    lng: cinema.lng,
  },
  average: roomStats.average,
  reviewCount: reviewCountOrZero,
}

function selectSummaries(where?: SQL) {
  return db
    .select(summaryFields)
    .from(room)
    .innerJoin(cinema, eq(room.cinemaId, cinema.id))
    .leftJoin(roomStats, eq(roomStats.roomId, room.id))
    .where(where)
    .$dynamic()
}

type SummaryRow = Awaited<ReturnType<typeof selectSummaries>>[number]
const toSummary = (r: SummaryRow): RoomSummary => ({ ...r, average: round1(r.average) })

export async function searchRooms(filters: ExploreSearch) {
  const conditions: SQL[] = []
  if (filters.state) conditions.push(eq(cinema.state, filters.state))
  if (filters.city) conditions.push(eq(cinema.city, filters.city))
  if (filters.format) conditions.push(eq(room.format, filters.format))
  if (filters.q) {
    const pattern = `%${fold(filters.q).replace(/[\\%_]/g, '\\$&')}%`
    conditions.push(sql`${room.searchText} LIKE ${pattern} ESCAPE '\\'`)
  }
  const where = and(...conditions)

  const [{ total }] = (await db
    .select({ total: count() })
    .from(room)
    .innerJoin(cinema, eq(room.cinemaId, cinema.id))
    .where(where)) as [{ total: number }]

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Math.min(filters.page, pageCount)
  const order = {
    rating: [desc(sql`coalesce(${roomStats.average}, 0)`), desc(reviewCountOrZero)],
    reviews: [desc(reviewCountOrZero), asc(cinema.name)],
    recent: [desc(sql`coalesce(${roomStats.lastReviewAt}, 0)`)],
    name: [asc(cinema.name), asc(room.name)],
  }[filters.sort]

  const rows = await selectSummaries(where)
    .orderBy(...order)
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)

  return { rooms: rows.map(toSummary), total, page, pageCount }
}

export async function listCities() {
  return db
    .select({ city: cinema.city, state: cinema.state, rooms: count(room.id) })
    .from(room)
    .innerJoin(cinema, eq(room.cinemaId, cinema.id))
    .groupBy(cinema.city, cinema.state)
    .orderBy(desc(count(room.id)), asc(cinema.city))
}

export async function getRoom(id: string) {
  const [row] = await selectSummaries(eq(room.id, id)).limit(1)
  return row ? toSummary(row) : null
}

export async function getTopRooms(limit: number) {
  const rows = await selectSummaries(gte(roomStats.reviewCount, 4))
    .orderBy(desc(roomStats.average))
    .limit(limit)
  return rows.map(toSummary)
}

export async function getCinema(id: string) {
  const found = await db.query.cinema.findFirst({ where: { id } })
  if (!found) return null
  const rooms = await selectSummaries(eq(room.cinemaId, id)).orderBy(asc(room.name))
  return { cinema: found, rooms: rooms.map(toSummary) }
}

// ---------- Reviews (relational queries) ----------

/** Author and room/cinema shapes loaded with `with`, shared by every review read. */
const withAuthor = { user: { columns: { username: true, name: true } } } as const
const withRoom = {
  room: {
    columns: { id: true, name: true, format: true },
    with: { cinema: { columns: { id: true, name: true, city: true, state: true } } },
  },
} as const
const withRoomAndCinema = { ...withAuthor, ...withRoom } as const

type ReviewRecord = typeof review.$inferSelect & { user: { username: string | null; name: string } }

function toReview({
  picture,
  sound,
  comfort,
  cleanliness,
  createdAt,
  user: author,
  userId: _userId,
  day: _day,
  ...rest
}: ReviewRecord): Review {
  return {
    ...rest,
    username: author.username ?? author.name,
    criteria: { picture, sound, comfort, cleanliness },
    createdAt: createdAt.toISOString(),
  }
}

function toReviewWithRoom({
  room: { cinema: c, ...r },
  ...rest
}: ReviewRecord & {
  room: ReviewWithRoom['room'] & { cinema: ReviewWithRoom['cinema'] }
}): ReviewWithRoom {
  return { ...toReview(rest), room: r, cinema: c }
}

const REVIEW_ORDER = {
  recent: { createdAt: 'desc' },
  best: { rating: 'desc', createdAt: 'desc' },
  worst: { rating: 'asc', createdAt: 'desc' },
} as const

export async function getRoomReviews(roomId: string, sort: keyof typeof REVIEW_ORDER) {
  const rows = await db.query.review.findMany({
    where: { roomId },
    orderBy: REVIEW_ORDER[sort],
    with: withAuthor,
  })
  return rows.map(toReview)
}

export async function getRecentReviews(limit: number) {
  const rows = await db.query.review.findMany({
    orderBy: { createdAt: 'desc' },
    limit,
    with: withRoomAndCinema,
  })
  return rows.map(toReviewWithRoom)
}

export async function getRoomStats(roomId: string): Promise<RoomStats> {
  const list = (await db.query.review.findMany({ where: { roomId }, with: withAuthor })).map(toReview)

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

/** Null only when the user doesn't exist; a user with no reviews gets an empty diary. */
export async function getUserProfile(username: string) {
  const found = await db.query.user.findFirst({
    where: { username },
    columns: { username: true, name: true },
    with: {
      reviews: { orderBy: { createdAt: 'desc' }, with: withRoom },
    },
  })
  if (!found) return null
  const author = { username: found.username, name: found.name }
  const reviews = found.reviews.map((r) => toReviewWithRoom({ ...r, user: author }))
  return {
    username,
    reviews,
    average: average(reviews.map((r) => r.rating)),
    cities: [...new Set(reviews.map((r) => r.cinema.city))],
  }
}

// ---------- Aggregates ----------

export async function getTotals() {
  const [[rooms], [cinemas], [cities], [reviews]] = await db.batch([
    db.select({ n: count() }).from(room),
    db.select({ n: count() }).from(cinema),
    db.select({ n: sql<number>`count(distinct ${cinema.city})` }).from(cinema),
    db.select({ n: count() }).from(review),
  ])
  return { rooms: rooms!.n, cinemas: cinemas!.n, cities: cities!.n, reviews: reviews!.n }
}

export async function getCinemaLocations() {
  const rows = await db
    .select({
      id: cinema.id,
      name: cinema.name,
      chain: cinema.chain,
      city: cinema.city,
      state: cinema.state,
      neighborhood: cinema.neighborhood,
      address: cinema.address,
      lat: cinema.lat,
      lng: cinema.lng,
      roomCount: sql<number>`count(distinct ${room.id})`,
      average: sql<number | null>`avg(${review.rating})`,
      reviewCount: count(review.id),
    })
    .from(cinema)
    .leftJoin(room, eq(room.cinemaId, cinema.id))
    .leftJoin(review, eq(review.roomId, room.id))
    .groupBy(cinema.id)
  return rows.map((r) => ({ ...r, average: round1(r.average) }))
}

export async function getSitemapIds() {
  const [rooms, cinemas] = await db.batch([
    db.select({ id: room.id }).from(room),
    db.select({ id: cinema.id }).from(cinema),
  ])
  return { rooms: rooms.map((r) => r.id), cinemas: cinemas.map((c) => c.id) }
}

// ---------- Writes ----------

/** Drizzle wraps driver errors (DrizzleQueryError), so walk the `cause` chain. */
function isUniqueViolation(error: unknown): boolean {
  for (let e = error; e instanceof Error; e = e.cause) {
    if (e.message.includes('UNIQUE constraint failed')) return true
  }
  return false
}

export type CreateReviewResult =
  | { ok: true; id: string; roomId: string }
  | { ok: false; reason: 'unknown-room' | 'duplicate' }

export async function createReview(userId: string, input: NewReview): Promise<CreateReviewResult> {
  const [exists] = await db.select({ id: room.id }).from(room).where(eq(room.id, input.roomId)).limit(1)
  if (!exists) return { ok: false, reason: 'unknown-room' }

  const now = new Date()
  const id = crypto.randomUUID()
  try {
    await db.insert(review).values({
      id,
      roomId: input.roomId,
      userId,
      rating: input.rating,
      ...input.criteria,
      row: input.row,
      film: input.film,
      body: input.body,
      tags: input.tags,
      day: saoPauloDay.format(now),
      createdAt: now,
    })
  } catch (error) {
    // `review_one_per_day_idx` enforces one review per user, room and day.
    if (isUniqueViolation(error)) return { ok: false, reason: 'duplicate' }
    throw error
  }
  return { ok: true, id, roomId: input.roomId }
}
