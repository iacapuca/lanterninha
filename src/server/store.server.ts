// The only module that queries the database. The `.server.ts` suffix puts it
// behind Start's import protection: importing it from client code fails the build.
import { and, asc, count, desc, eq, getColumns, gte, isNotNull, sql, type SQL } from 'drizzle-orm'
import type {
  CinemaSummary,
  ContributionStats,
  Criterion,
  Review,
  ReviewWithRoom,
  RoomFactField,
  RoomStats,
  RoomSummary,
  State,
  Tag,
} from '~/lib/domain'
import { CRITERION_IDS, FORMAT_IDS, RATINGS, timeZoneOf } from '~/lib/domain'
import type { ExploreSearch, NewReview, UpdateReview } from '~/lib/schemas'
import { db } from './db/client.server'
import { cinema, filmPoster, review, room, roomFact, showtime } from './db/schema.server'

const PAGE_SIZE = 9

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
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

const { searchText: _searchText, ...roomColumns } = getColumns(room)

const summaryFields = {
  ...roomColumns,
  cinema: getColumns(cinema),
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

const escapeLike = (q: string) => `%${fold(q).replace(/[\\%_]/g, '\\$&')}%`

// ---------- Cinema search (Explorar) ----------

const cinemaStats = db
  .select({
    cinemaId: room.cinemaId,
    average: sql<number>`avg(${review.rating})`.as('average'),
    reviewCount: sql<number>`count(*)`.as('review_count'),
    lastReviewAt: sql<number>`max(${review.createdAt})`.as('last_review_at'),
  })
  .from(review)
  .innerJoin(room, eq(review.roomId, room.id))
  .groupBy(room.cinemaId)
  .as('cinema_stats')

const cinemaRooms = db
  .select({
    cinemaId: room.cinemaId,
    roomCount: sql<number>`count(*)`.as('room_count'),
    seats: sql<number>`sum(${room.seats})`.as('seats'),
    formats: sql<string | null>`group_concat(distinct ${room.format})`.as('formats'),
  })
  .from(room)
  .groupBy(room.cinemaId)
  .as('cinema_rooms')

const cinemaReviewCount = sql<number>`coalesce(${cinemaStats.reviewCount}, 0)`

export async function searchCinemas(filters: ExploreSearch) {
  const conditions: SQL[] = []
  if (filters.state) conditions.push(eq(cinema.state, filters.state))
  if (filters.city) conditions.push(eq(cinema.city, filters.city))
  if (filters.format) {
    conditions.push(
      sql`exists (select 1 from ${room} where ${room.cinemaId} = ${cinema.id} and ${room.format} = ${filters.format})`,
    )
  }
  if (filters.q) {
    // A room's search text already folds in its cinema's name, chain, neighbourhood and city.
    conditions.push(
      sql`exists (select 1 from ${room} where ${room.cinemaId} = ${cinema.id} and ${room.searchText} LIKE ${escapeLike(filters.q)} ESCAPE '\\')`,
    )
  }
  const where = and(...conditions)

  const [{ total }] = (await db.select({ total: count() }).from(cinema).where(where)) as [{ total: number }]
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Math.min(filters.page, pageCount)
  const order = {
    rating: [desc(sql`coalesce(${cinemaStats.average}, 0)`), desc(cinemaReviewCount), desc(cinemaRooms.roomCount)],
    reviews: [desc(cinemaReviewCount), asc(cinema.name)],
    recent: [desc(sql`coalesce(${cinemaStats.lastReviewAt}, 0)`), asc(cinema.name)],
    name: [asc(cinema.name)],
  }[filters.sort]

  const rows = await selectCinemaSummaries(where)
    .orderBy(...order)
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
  return { cinemas: rows.map(toCinemaSummary), total, page, pageCount }
}

function selectCinemaSummaries(where?: SQL) {
  return db
    .select({
      ...getColumns(cinema),
      roomCount: sql<number>`coalesce(${cinemaRooms.roomCount}, 0)`,
      seats: sql<number>`coalesce(${cinemaRooms.seats}, 0)`,
      formats: cinemaRooms.formats,
      average: cinemaStats.average,
      reviewCount: cinemaReviewCount,
      showing: sql<number>`exists (select 1 from ${showtime} where ${showtime.cinemaId} = ${cinema.id} and ${showtime.startsAt} >= ${Date.now() - 20 * 60 * 1000})`,
    })
    .from(cinema)
    .leftJoin(cinemaRooms, eq(cinemaRooms.cinemaId, cinema.id))
    .leftJoin(cinemaStats, eq(cinemaStats.cinemaId, cinema.id))
    .where(where)
    .$dynamic()
}

type CinemaSummaryRow = Awaited<ReturnType<typeof selectCinemaSummaries>>[number]
const toCinemaSummary = (r: CinemaSummaryRow): CinemaSummary => ({
  ...r,
  // Special formats only ("Padrão" says nothing on a card), in the canonical order.
  formats: FORMAT_IDS.filter((f) => f !== 'standard' && r.formats?.split(',').includes(f)),
  average: round1(r.average),
  showing: Boolean(r.showing),
})

/** One cinema's card data, for its share image. */
export async function cinemaShareSummary(id: string) {
  const [row] = await selectCinemaSummaries(eq(cinema.id, id)).limit(1)
  return row ? toCinemaSummary(row) : null
}

/** Every city with a cinema (or just one state's), busiest first. */
export async function listCities(state?: State) {
  return db
    .select({ city: cinema.city, state: cinema.state, cinemas: count() })
    .from(cinema)
    .where(state ? eq(cinema.state, state) : undefined)
    .groupBy(cinema.city, cinema.state)
    .orderBy(desc(count()), asc(cinema.city))
}

export async function getRoom(id: string) {
  const [row] = await selectSummaries(eq(room.id, id)).limit(1)
  return row ? toSummary(row) : null
}

export async function getTopRooms(limit: number) {
  const rows = await selectSummaries(gte(roomStats.reviewCount, 4)).orderBy(desc(roomStats.average)).limit(limit)
  return rows.map(toSummary)
}

export async function getCinema(id: string) {
  const found = await db.query.cinema.findFirst({ where: { id } })
  if (!found) return null
  const rooms = (await selectSummaries(eq(room.cinemaId, id))).map(toSummary)
  rooms.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }))
  return { cinema: found, rooms }
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
      lat: sql<number>`${cinema.lat}`,
      lng: sql<number>`${cinema.lng}`,
      geoPrecision: cinema.geoPrecision,
      roomCount: sql<number>`count(distinct ${room.id})`,
      average: sql<number | null>`avg(${review.rating})`,
      reviewCount: count(review.id),
    })
    .from(cinema)
    .leftJoin(room, eq(room.cinemaId, cinema.id))
    .leftJoin(review, eq(review.roomId, room.id))
    .where(isNotNull(cinema.lat))
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

/** One of the user's own reviews, in the shape the review form edits. */
export async function getOwnReview(userId: string, id: string) {
  const found = await db.query.review.findFirst({ where: { id, userId } })
  if (!found) return null
  const { picture, sound, comfort, cleanliness } = found
  return {
    id: found.id,
    roomId: found.roomId,
    rating: found.rating,
    criteria: { picture, sound, comfort, cleanliness },
    row: found.row,
    film: found.film,
    body: found.body,
    tags: found.tags,
  }
}

/** Only the author can change a review; its room and date stay as they were. */
export async function updateReview(userId: string, input: UpdateReview) {
  const updated = await db
    .update(review)
    .set({
      rating: input.rating,
      ...input.criteria,
      row: input.row,
      film: input.film,
      body: input.body,
      tags: input.tags,
    })
    .where(and(eq(review.id, input.id), eq(review.userId, userId), eq(review.roomId, input.roomId)))
    .returning({ id: review.id, roomId: review.roomId })
  return updated[0] ?? null
}

export async function deleteReview(userId: string, id: string) {
  const deleted = await db
    .delete(review)
    .where(and(eq(review.id, id), eq(review.userId, userId)))
    .returning({ id: review.id, roomId: review.roomId })
  return deleted[0] ?? null
}

// ---------- Community room facts (format, projection, sound) ----------

/** Votes needed for the community to override a value from ANCINE's room name or Ingresso.com. */
const OVERRIDE_ANCINE_AT = 3

const sourceColumn = {
  format: { value: room.format, source: room.formatSource },
  projection: { value: room.projection, source: room.projectionSource },
  sound: { value: room.sound, source: room.soundSource },
} as const

export type FactVotes = Record<RoomFactField, Array<{ value: string; votes: number }>>

export async function getRoomFactVotes(roomId: string, userId?: string) {
  const rows = await db
    .select({ field: roomFact.field, value: roomFact.value, votes: count() })
    .from(roomFact)
    .where(eq(roomFact.roomId, roomId))
    .groupBy(roomFact.field, roomFact.value)
    .orderBy(desc(count()))
  const votes: FactVotes = { format: [], projection: [], sound: [] }
  for (const r of rows) votes[r.field].push({ value: r.value, votes: r.votes })

  const mine = userId
    ? await db.query.roomFact.findMany({ where: { roomId, userId }, columns: { field: true, value: true } })
    : []
  return {
    votes,
    mine: Object.fromEntries(mine.map((m) => [m.field, m.value])) as Partial<Record<RoomFactField, string>>,
  }
}

/**
 * Records (or changes) one user's answer, then recomputes what the room shows:
 * the most-voted answer, unless ANCINE's room name already says otherwise and
 * fewer than OVERRIDE_ANCINE_AT people disagree.
 */
export async function voteRoomFact(userId: string, roomId: string, field: RoomFactField, value: string) {
  const [target] = await db.select({ id: room.id }).from(room).where(eq(room.id, roomId)).limit(1)
  if (!target) return { ok: false as const, reason: 'unknown-room' as const }

  await db
    .insert(roomFact)
    .values({ id: crypto.randomUUID(), roomId, userId, field, value, createdAt: new Date() })
    .onConflictDoUpdate({
      target: [roomFact.userId, roomFact.roomId, roomFact.field],
      // Keep the original timestamp so changing an answer doesn't lose "first answer" credit.
      set: { value },
    })

  const { votes } = await getRoomFactVotes(roomId)
  const top = votes[field][0]
  const columns = sourceColumn[field]
  const [current] = await db.select({ source: columns.source }).from(room).where(eq(room.id, roomId))
  const fromSource = current?.source === 'ancine' || current?.source === 'ingresso'
  if (top && (!fromSource || top.votes >= OVERRIDE_ANCINE_AT)) {
    await db
      .update(room)
      .set({ [field]: top.value, [`${field}Source`]: 'community' })
      .where(eq(room.id, roomId))
  }
  return { ok: true as const }
}

export async function getContributionStats(userId: string): Promise<ContributionStats> {
  const [[reviewTotals], facts, [firsts]] = await db.batch([
    db
      .select({ reviews: count(), cities: sql<number>`count(distinct ${cinema.city})` })
      .from(review)
      .innerJoin(room, eq(review.roomId, room.id))
      .innerJoin(cinema, eq(room.cinemaId, cinema.id))
      .where(eq(review.userId, userId)),
    db
      .select({ field: roomFact.field, n: count() })
      .from(roomFact)
      .where(eq(roomFact.userId, userId))
      .groupBy(roomFact.field),
    // Answers that were the first anyone gave for that room detail.
    db
      .select({ n: count() })
      .from(roomFact)
      .where(
        and(
          eq(roomFact.userId, userId),
          sql`not exists (select 1 from ${roomFact} as earlier where earlier.room_id = ${roomFact.roomId} and earlier.field = ${roomFact.field} and earlier.created_at < ${roomFact.createdAt})`,
        ),
      ),
  ])
  const byField = Object.fromEntries(facts.map((f) => [f.field, f.n]))
  return {
    reviews: reviewTotals?.reviews ?? 0,
    cities: reviewTotals?.cities ?? 0,
    format: byField.format ?? 0,
    projection: byField.projection ?? 0,
    sound: byField.sound ?? 0,
    firstAnswers: firsts?.n ?? 0,
  }
}

export async function getUserIdByUsername(username: string) {
  const found = await db.query.user.findFirst({ where: { username }, columns: { id: true } })
  return found?.id ?? null
}

// ---------- Programme (synced provider showtimes) ----------

/** Upcoming showtimes for a room or a whole cinema, with their films. */
export async function getProgramme(target: { roomId: string } | { cinemaId: string }) {
  const where = 'roomId' in target ? { roomId: target.roomId } : { cinemaId: target.cinemaId }
  const cinemaId =
    'cinemaId' in target
      ? target.cinemaId
      : (await db.query.room.findFirst({ where: { id: target.roomId }, columns: { cinemaId: true } }))?.cinemaId
  const theaters = cinemaId
    ? await db.query.providerTheater.findMany({ where: { cinemaId }, columns: { provider: true } })
    : []
  const linked = theaters.length > 0
  /** Who the sessions come from, for the credit line ("via Velox Tickets"). */
  const providers = [...new Set(theaters.map((t) => t.provider))]
  const state = cinemaId
    ? (await db.query.cinema.findFirst({ where: { id: cinemaId }, columns: { state: true } }))?.state
    : null
  // "Today" in the cinema's own time zone, so late-night lists don't call tomorrow "today".
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: timeZoneOf(state ?? 'SP') }).format(new Date())
  if (!linked) return { linked, providers, today, showtimes: [] }

  const showtimes = await db.query.showtime.findMany({
    // Keep sessions that started up to 20 minutes ago (trailers are still on).
    where: { ...where, startsAt: { gte: new Date(Date.now() - 20 * 60 * 1000) } },
    orderBy: { startsAt: 'asc' },
    limit: 400,
    columns: { id: true, localDay: true, localTime: true, roomName: true, types: true, price: true, checkoutUrl: true },
    with: {
      film: {
        columns: {
          id: true,
          title: true,
          posterUrl: true,
          durationMinutes: true,
          contentRating: true,
          genres: true,
          tmdbId: true,
          imdbId: true,
          overview: true,
          tagline: true,
          director: true,
          tmdbRating: true,
          backdropPath: true,
          releaseYear: true,
        },
      },
      room: { columns: { id: true, name: true } },
    },
  })
  return { linked, providers, today, showtimes }
}

export async function getFilmPoster(filmId: string) {
  const [poster] = await db
    .select({ contentType: filmPoster.contentType, data: filmPoster.data })
    .from(filmPoster)
    .where(eq(filmPoster.filmId, filmId))
    .limit(1)
  return poster ?? null
}
