// The only module that queries the database. The `.server.ts` suffix puts it
// behind Start's import protection: importing it from client code fails the build.
import { and, asc, count, desc, eq, getColumns, gte, inArray, isNotNull, ne, sql, type SQL } from 'drizzle-orm'
import type {
  CinemaSummary,
  SeatPhoto,
  ContributionStats,
  Criterion,
  Format,
  Review,
  ReviewWithRoom,
  RoomFactField,
  RoomStats,
  RoomSummary,
  State,
  Tag,
} from '~/lib/domain'
import { CRITERION_IDS, factFieldsFor, FORMAT_IDS, RATINGS, ROOM_FACT_FIELDS, timeZoneOf } from '~/lib/domain'
import type { ExploreSearch, NewReview, UpdateReview } from '~/lib/schemas'
import { db } from './db/client.server'
import {
  cinema,
  film,
  filmPoster,
  follow,
  providerTheater,
  review,
  reviewHelpful,
  photoReport,
  room,
  roomFact,
  seatPhoto,
  showtime,
  user,
} from './db/schema.server'

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
/** A review before its "útil" counts and photo are added (see withHelpful). */
type ReviewBase = Omit<Review, 'helpful' | 'markedHelpful' | 'photo'>

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
}: ReviewRecord): ReviewBase {
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
}) {
  return { ...toReview(rest), room: r, cinema: c }
}

/** D1 binds at most 100 parameters per query. */
function chunks<T>(xs: T[], size = 90) {
  return Array.from({ length: Math.ceil(xs.length / size) }, (_, i) => xs.slice(i * size, (i + 1) * size))
}

/**
 * Adds each review's "útil" count, whether the viewer marked it, and its
 * visible seat photo: two queries per 90 reviews.
 */
async function withHelpful<R extends ReviewBase>(reviews: R[], viewerId?: string): Promise<Array<R & Review>> {
  const counts = new Map<string, { n: number; mine: boolean }>()
  const photos = new Map<string, SeatPhoto>()
  const batches = await Promise.all(
    chunks(reviews.map((r) => r.id)).map((ids) =>
      Promise.all([
        db
          .select({
            reviewId: reviewHelpful.reviewId,
            n: count(),
            mine: sql<number>`max(${reviewHelpful.userId} = ${viewerId ?? ''})`,
          })
          .from(reviewHelpful)
          .where(inArray(reviewHelpful.reviewId, ids))
          .groupBy(reviewHelpful.reviewId),
        db
          .select({ ...photoColumns, reviewId: seatPhoto.reviewId })
          .from(seatPhoto)
          .where(and(inArray(seatPhoto.reviewId, ids), eq(seatPhoto.status, 'visible'))),
      ]),
    ),
  )
  for (const [helpful, found] of batches) {
    for (const row of helpful) counts.set(row.reviewId, { n: row.n, mine: Boolean(row.mine) })
    for (const { reviewId, ...photo } of found) photos.set(reviewId, photo)
  }
  return reviews.map((r) => ({
    ...r,
    helpful: counts.get(r.id)?.n ?? 0,
    markedHelpful: counts.get(r.id)?.mine ?? false,
    photo: photos.get(r.id) ?? null,
  }))
}

const REVIEW_ORDER = {
  recent: { createdAt: 'desc' },
  // Re-sorted by "útil" count once the counts are in (see getRoomReviews).
  helpful: { createdAt: 'desc' },
  best: { rating: 'desc', createdAt: 'desc' },
  worst: { rating: 'asc', createdAt: 'desc' },
} as const

export async function getRoomReviews(roomId: string, sort: keyof typeof REVIEW_ORDER, viewerId?: string) {
  const rows = await db.query.review.findMany({
    where: { roomId },
    orderBy: REVIEW_ORDER[sort],
    with: withAuthor,
  })
  const reviews = await withHelpful(rows.map(toReview), viewerId)
  // Stable sort: ties stay newest first.
  if (sort === 'helpful') reviews.sort((a, b) => b.helpful - a.helpful)
  return reviews
}

export async function getRecentReviews(limit: number, viewerId?: string): Promise<ReviewWithRoom[]> {
  const rows = await db.query.review.findMany({
    orderBy: { createdAt: 'desc' },
    limit,
    with: withRoomAndCinema,
  })
  return withHelpful(rows.map(toReviewWithRoom), viewerId)
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
export async function getUserProfile(username: string, viewerId?: string) {
  const found = await db.query.user.findFirst({
    where: { username },
    columns: { id: true, username: true, name: true },
    with: {
      reviews: { orderBy: { createdAt: 'desc' }, with: withRoom },
    },
  })
  if (!found) return null
  const author = { username: found.username, name: found.name }
  const reviews: ReviewWithRoom[] = await withHelpful(
    found.reviews.map((r) => toReviewWithRoom({ ...r, user: author })),
    viewerId,
  )
  const [[followers], [following], viewerFollows] = await db.batch([
    db.select({ n: count() }).from(follow).where(eq(follow.followingId, found.id)),
    db.select({ n: count() }).from(follow).where(eq(follow.followerId, found.id)),
    db
      .select({ id: follow.id })
      .from(follow)
      .where(and(eq(follow.followerId, viewerId ?? ''), eq(follow.followingId, found.id)))
      .limit(1),
  ])
  return {
    userId: found.id,
    username,
    reviews,
    average: average(reviews.map((r) => r.rating)),
    cities: [...new Set(reviews.map((r) => r.cinema.city))],
    followers: followers?.n ?? 0,
    following: following?.n ?? 0,
    /** "Útil" marks across all of this user's reviews. */
    helpfulReceived: reviews.reduce((sum, r) => sum + r.helpful, 0),
    viewerFollows: viewerFollows.length > 0,
  }
}

// ---------- Social: "útil" marks, follows, feed ----------

export type HelpfulResult =
  | { ok: true; helpful: number; markedHelpful: boolean }
  | { ok: false; reason: 'unknown-review' | 'own-review' }

/** Marks (or unmarks) a review as helpful; returns its new count. */
export async function setReviewHelpful(userId: string, reviewId: string, on: boolean): Promise<HelpfulResult> {
  const [target] = await db.select({ authorId: review.userId }).from(review).where(eq(review.id, reviewId)).limit(1)
  if (!target) return { ok: false, reason: 'unknown-review' }
  if (target.authorId === userId) return { ok: false, reason: 'own-review' }
  if (on) {
    await db
      .insert(reviewHelpful)
      .values({ id: crypto.randomUUID(), reviewId, userId, createdAt: new Date() })
      .onConflictDoNothing()
  } else {
    await db.delete(reviewHelpful).where(and(eq(reviewHelpful.reviewId, reviewId), eq(reviewHelpful.userId, userId)))
  }
  const [{ n }] = (await db.select({ n: count() }).from(reviewHelpful).where(eq(reviewHelpful.reviewId, reviewId))) as [
    { n: number },
  ]
  return { ok: true, helpful: n, markedHelpful: on }
}

export type FollowResult = { ok: true; followers: number } | { ok: false; reason: 'unknown-user' | 'self' }

export async function setFollow(followerId: string, username: string, on: boolean): Promise<FollowResult> {
  const followingId = await getUserIdByUsername(username)
  if (!followingId) return { ok: false, reason: 'unknown-user' }
  if (followingId === followerId) return { ok: false, reason: 'self' }
  if (on) {
    await db
      .insert(follow)
      .values({ id: crypto.randomUUID(), followerId, followingId, createdAt: new Date() })
      .onConflictDoNothing()
  } else {
    await db.delete(follow).where(and(eq(follow.followerId, followerId), eq(follow.followingId, followingId)))
  }
  const [{ n }] = (await db.select({ n: count() }).from(follow).where(eq(follow.followingId, followingId))) as [
    { n: number },
  ]
  return { ok: true, followers: n }
}

/** Newest reviews from the people a user follows. */
export async function getFeed(userId: string, limit: number) {
  const rows = await db.query.review.findMany({
    where: {
      RAW: (t) =>
        sql`${t.userId} in (select ${follow.followingId} from ${follow} where ${follow.followerId} = ${userId})`,
    },
    orderBy: { createdAt: 'desc' },
    limit,
    with: withRoomAndCinema,
  })
  const [{ n: following }] = (await db.select({ n: count() }).from(follow).where(eq(follow.followerId, userId))) as [
    { n: number },
  ]
  return { following, reviews: (await withHelpful(rows.map(toReviewWithRoom), userId)) as ReviewWithRoom[] }
}

/** The most active reviewers this user doesn't follow yet: who to follow on an empty feed. */
export async function getSuggestedReviewers(userId: string, limit: number) {
  return db
    .select({
      username: sql<string>`${user.username}`,
      reviews: count(review.id),
      helpful:
        sql<number>`(select count(*) from ${reviewHelpful} inner join ${review} as r on r.id = ${reviewHelpful.reviewId} where r.user_id = ${user.id})`.as(
          'helpful',
        ),
    })
    .from(user)
    .innerJoin(review, eq(review.userId, user.id))
    .where(
      and(
        ne(user.id, userId),
        isNotNull(user.username),
        sql`${user.id} not in (select ${follow.followingId} from ${follow} where ${follow.followerId} = ${userId})`,
      ),
    )
    .groupBy(user.id)
    .orderBy(desc(sql`helpful`), desc(count(review.id)))
    .limit(limit)
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
  | { ok: true; id: string; roomId: string; cinema: { id: string; city: string; state: State } }
  | { ok: false; reason: 'unknown-room' | 'duplicate' }

export async function createReview(userId: string, input: NewReview): Promise<CreateReviewResult> {
  const [target] = await db
    .select({ id: cinema.id, city: cinema.city, state: cinema.state })
    .from(room)
    .innerJoin(cinema, eq(room.cinemaId, cinema.id))
    .where(eq(room.id, input.roomId))
    .limit(1)
  if (!target) return { ok: false, reason: 'unknown-room' }

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
      seatPosition: input.row ? input.seatPosition : null,
      film: input.film,
      filmTmdbId: input.film ? input.filmTmdbId : null,
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
  return { ok: true, id, roomId: input.roomId, cinema: target }
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
    seatPosition: found.seatPosition,
    film: found.film,
    filmTmdbId: found.filmTmdbId,
    body: found.body,
    tags: found.tags,
    photo: await getReviewPhoto(found.id),
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
      seatPosition: input.row ? input.seatPosition : null,
      film: input.film,
      filmTmdbId: input.film ? input.filmTmdbId : null,
      body: input.body,
      tags: input.tags,
    })
    .where(and(eq(review.id, input.id), eq(review.userId, userId), eq(review.roomId, input.roomId)))
    .returning({ id: review.id, roomId: review.roomId })
  return updated[0] ?? null
}

export async function deleteReview(userId: string, id: string) {
  // The photo row cascades with the review; read its key first so the image can go too.
  const [photo] = await db
    .select({ key: seatPhoto.key })
    .from(seatPhoto)
    .innerJoin(review, eq(seatPhoto.reviewId, review.id))
    .where(and(eq(review.id, id), eq(review.userId, userId)))
  const deleted = await db
    .delete(review)
    .where(and(eq(review.id, id), eq(review.userId, userId)))
    .returning({ id: review.id, roomId: review.roomId })
  return deleted[0] ? { ...deleted[0], photoKey: photo?.key ?? null } : null
}

// ---------- Seat photos (images in R2, see photos.server.ts) ----------

const photoColumns = {
  id: seatPhoto.id,
  width: seatPhoto.width,
  height: seatPhoto.height,
}

/** A review's photo, hidden or not: its author still sees it in the edit form. */
async function getReviewPhoto(reviewId: string): Promise<SeatPhoto | null> {
  const [found] = await db.select(photoColumns).from(seatPhoto).where(eq(seatPhoto.reviewId, reviewId)).limit(1)
  return found ?? null
}

/** The author's review a photo is being attached to, or null if it isn't theirs. */
export async function getReviewForPhoto(userId: string, reviewId: string) {
  const [found] = await db
    .select({ id: review.id, roomId: review.roomId, row: review.row })
    .from(review)
    .where(and(eq(review.id, reviewId), eq(review.userId, userId)))
    .limit(1)
  return found ?? null
}

/** Attaches a photo to a review, replacing any earlier one; returns the replaced photo's R2 key. */
export async function saveSeatPhoto(photo: {
  id: string
  reviewId: string
  roomId: string
  userId: string
  key: string
  contentType: string
  width: number
  height: number
}) {
  const previous = await removeSeatPhoto(photo.reviewId)
  await db.insert(seatPhoto).values({ ...photo, status: 'visible', createdAt: new Date() })
  return previous
}

/** Deletes a review's photo row; returns its R2 key so the caller can delete the image. */
export async function removeSeatPhoto(reviewId: string) {
  const [deleted] = await db.delete(seatPhoto).where(eq(seatPhoto.reviewId, reviewId)).returning({ key: seatPhoto.key })
  return deleted?.key ?? null
}

/** R2 keys of every photo a user uploaded, for deleting the images with their account. */
export async function listUserPhotoKeys(userId: string) {
  const rows = await db.select({ key: seatPhoto.key }).from(seatPhoto).where(eq(seatPhoto.userId, userId))
  return rows.map((r) => r.key)
}

/** What the /photos route needs to serve an image. */
export async function getPhotoObject(id: string) {
  const [found] = await db
    .select({ key: seatPhoto.key, contentType: seatPhoto.contentType, status: seatPhoto.status })
    .from(seatPhoto)
    .where(eq(seatPhoto.id, id))
    .limit(1)
  return found ?? null
}

export type ReportPhotoResult = { ok: true } | { ok: false; reason: 'unknown-photo' | 'own-photo' }

/** Records a report and hides the photo until a moderator looks at it. Reporting twice is a no-op. */
export async function reportPhoto(userId: string, photoId: string): Promise<ReportPhotoResult> {
  const [target] = await db
    .select({ userId: seatPhoto.userId })
    .from(seatPhoto)
    .where(eq(seatPhoto.id, photoId))
    .limit(1)
  if (!target) return { ok: false, reason: 'unknown-photo' }
  if (target.userId === userId) return { ok: false, reason: 'own-photo' }
  await db.batch([
    db
      .insert(photoReport)
      .values({ id: crypto.randomUUID(), photoId, userId, createdAt: new Date() })
      .onConflictDoNothing(),
    db.update(seatPhoto).set({ status: 'reported' }).where(eq(seatPhoto.id, photoId)),
  ])
  return { ok: true }
}

export async function isAdmin(userId: string) {
  const [found] = await db.select({ isAdmin: user.isAdmin }).from(user).where(eq(user.id, userId)).limit(1)
  return found?.isAdmin ?? false
}

/** The moderation queue: hidden photos with their review and how many people reported them. */
export async function listReportedPhotos() {
  return db
    .select({
      ...photoColumns,
      createdAt: seatPhoto.createdAt,
      reports: sql<number>`(select count(*) from ${photoReport} where ${photoReport.photoId} = ${seatPhoto.id})`,
      username: user.username,
      reviewBody: review.body,
      row: review.row,
      roomId: room.id,
      roomName: room.name,
      cinemaName: cinema.name,
    })
    .from(seatPhoto)
    .innerJoin(review, eq(seatPhoto.reviewId, review.id))
    .innerJoin(user, eq(seatPhoto.userId, user.id))
    .innerJoin(room, eq(seatPhoto.roomId, room.id))
    .innerJoin(cinema, eq(room.cinemaId, cinema.id))
    .where(eq(seatPhoto.status, 'reported'))
    .orderBy(desc(seatPhoto.createdAt))
}

/** A moderator's call: put a reported photo back (clearing its reports), or delete it. */
export async function moderatePhoto(id: string, action: 'restore' | 'delete') {
  if (action === 'restore') {
    await db.batch([
      db.delete(photoReport).where(eq(photoReport.photoId, id)),
      db.update(seatPhoto).set({ status: 'visible' }).where(eq(seatPhoto.id, id)),
    ])
    return null
  }
  const [deleted] = await db.delete(seatPhoto).where(eq(seatPhoto.id, id)).returning({ key: seatPhoto.key })
  return deleted?.key ?? null
}

// ---------- Community room facts (ROOM_FACTS: format, projection, sound…) ----------

/** Votes needed for the community to override a value from ANCINE's room name or Ingresso.com. */
const OVERRIDE_ANCINE_AT = 3

const sourceColumn = {
  format: room.formatSource,
  imaxType: room.imaxTypeSource,
  screenSize: room.screenSizeSource,
  projection: room.projectionSource,
  sound: room.soundSource,
  threeD: room.threeDSource,
  seatType: room.seatTypeSource,
} as const satisfies Record<RoomFactField, unknown>

export type FactVotes = Record<RoomFactField, Array<{ value: string; votes: number }>>

export async function getRoomFactVotes(roomId: string, userId?: string) {
  const rows = await db
    .select({ field: roomFact.field, value: roomFact.value, votes: count() })
    .from(roomFact)
    .where(eq(roomFact.roomId, roomId))
    .groupBy(roomFact.field, roomFact.value)
    .orderBy(desc(count()))
  const votes = Object.fromEntries(ROOM_FACT_FIELDS.map((f) => [f, []])) as unknown as FactVotes
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
  const [target] = await db.select({ format: room.format }).from(room).where(eq(room.id, roomId)).limit(1)
  if (!target) return { ok: false as const, reason: 'unknown-room' as const }
  if (!factFieldsFor(target.format).includes(field))
    return { ok: false as const, reason: 'fact-not-applicable' as const }

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
  const [current] = await db.select({ source: sourceColumn[field] }).from(room).where(eq(room.id, roomId))
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

/** Is this TMDB id one of ours? Keeps the hover-card endpoint from being an open TMDB proxy. */
export async function isKnownTmdbId(tmdbId: number) {
  const [inFilms] = await db.select({ id: film.id }).from(film).where(eq(film.tmdbId, tmdbId)).limit(1)
  if (inFilms) return true
  const [inReviews] = await db.select({ id: review.id }).from(review).where(eq(review.filmTmdbId, tmdbId)).limit(1)
  return !!inReviews
}

/** Where a session's "buy" link goes, plus what the checkout_click event records about it. */
export async function getShowtimeCheckout(id: string) {
  const [row] = await db
    .select({
      checkoutUrl: showtime.checkoutUrl,
      provider: providerTheater.provider,
      cinemaId: showtime.cinemaId,
      roomId: showtime.roomId,
      filmId: showtime.filmId,
      city: cinema.city,
      state: cinema.state,
    })
    .from(showtime)
    .innerJoin(providerTheater, eq(showtime.theaterId, providerTheater.id))
    .innerJoin(cinema, eq(showtime.cinemaId, cinema.id))
    .where(eq(showtime.id, id))
    .limit(1)
  return row ?? null
}

// ---------- Rankings (/melhores-salas) ----------

/**
 * How many "average" reviews a room's score starts with: a Bayesian average
 * pulls rooms with few reviews toward the site-wide mean, so one 5-🔦 review
 * doesn't outrank thirty 4.6s.
 */
const PRIOR_REVIEWS = 3

/** Reviewed rooms ranked by Bayesian score, for a city and/or format (or the whole country). */
export async function rankRooms(filter: { city?: string; state?: State; format?: Format }, limit: number) {
  const prior = sql`(select avg(${review.rating}) from ${review})`
  const score = sql`(${PRIOR_REVIEWS} * ${prior} + ${roomStats.average} * ${roomStats.reviewCount}) / (${PRIOR_REVIEWS} + ${roomStats.reviewCount})`
  const rows = await selectSummaries(
    and(
      isNotNull(roomStats.reviewCount),
      filter.city ? eq(cinema.city, filter.city) : undefined,
      filter.state ? eq(cinema.state, filter.state) : undefined,
      filter.format ? eq(room.format, filter.format) : undefined,
    ),
  )
    .orderBy(desc(score), desc(roomStats.reviewCount))
    .limit(limit)
  return rows.map(toSummary)
}

/**
 * Every (city, format) pair that has reviewed rooms, with counts: which ranking
 * pages exist. Drives the /melhores-salas index, the chips and the sitemap.
 */
export async function getRankingIndex() {
  return db
    .select({
      city: cinema.city,
      state: cinema.state,
      format: room.format,
      rooms: count(),
      reviews: sql<number>`sum(${roomStats.reviewCount})`,
    })
    .from(room)
    .innerJoin(cinema, eq(room.cinemaId, cinema.id))
    .innerJoin(roomStats, eq(roomStats.roomId, room.id))
    .groupBy(cinema.city, cinema.state, room.format)
}
