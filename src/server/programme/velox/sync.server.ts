// Incremental Velox Tickets sync, run by the Worker's */30 cron trigger (a
// separate invocation from Ingresso.com's */5, so each stays well under the
// free plan's ~50 subrequests):
//   1. weekly: refresh the city list (1 page fetch)
//   2. venues for the CITY_BATCH least recently refreshed cities, matched to
//      ANCINE cinemas by city + shared name tokens (Velox publishes neither
//      CNPJ nor coordinates)
//   3. three venue-day pages per venue for the THEATER_BATCH stalest matched
//      venues — one fetch covers every movie, room and session of the day
//   4. drop sessions that already started more than 3 hours ago
import { env } from 'cloudflare:workers'
import { and, asc, eq, gte, isNotNull, isNull, lt, lte, or, sql } from 'drizzle-orm'
import type { State } from '~/lib/domain'
import { timeZoneOf } from '~/lib/domain'
import { db } from '../../db/client.server'
import { cinema, film, providerCity, providerTheater, room, showtime } from '../../db/schema.server'
import { velox, type VeloxCine } from './api.server'
import { canWrite, chunk, formatHint, nameTokens, projectionHint, roomNumber, soundHint } from '../shared.server'

const DAY = 24 * 60 * 60 * 1000
// Venue refresh costs ~3 subrequests per city (fetch, candidates, one batch)
// and sessions ~5 per venue (three day pages, rooms select, one batch);
// 5 + 6 keeps a run well under the free plan's 50-subrequest cap, and gets
// every Velox city venue-synced within a day of the first deploy.
const CITY_BATCH = 5
const theaterBatch = () => Number(env.VELOX_THEATER_BATCH) || 6
/** Days of sessions pulled per venue: today, tomorrow and the day after. */
const SESSION_DAYS = 3

// ---------- 1. cities ----------

async function refreshCities() {
  const [{ n }] = (await db
    .select({ n: sql<number>`count(*)` })
    .from(providerCity)
    .where(eq(providerCity.provider, 'velox'))) as [{ n: number }]
  const [stale] = await db
    .select({ id: providerCity.id })
    .from(providerCity)
    .where(
      and(
        eq(providerCity.provider, 'velox'),
        // NULL means "venues not discovered yet" — that's the venue step's
        // queue, not a reason to re-fetch the city list.
        lt(providerCity.theatersSyncedAt, new Date(Date.now() - 7 * DAY)),
      ),
    )
    .limit(1)
  if (n > 0 && !stale) return 0
  const rows = (await velox.cities()).flatMap((s) =>
    s.cities.map((c) => ({ id: c.cityNameNorm, provider: 'velox' as const, name: c.cityName, state: s.stateCod as State })),
  )
  for (const batch of chunk(rows, 20)) {
    await db
      .insert(providerCity)
      .values(batch)
      .onConflictDoUpdate({ target: providerCity.id, set: { name: sql`excluded.name`, state: sql`excluded.state` } })
  }
  return rows.length
}

// ---------- 2. venues ----------

type Candidate = { id: string; name: string; neighborhood: string }

/**
 * Matches a Velox venue to an ANCINE cinema by shared meaningful name tokens,
 * pooling the venue's name with its district (Velox's "Fundação Joaquim
 * Nabuco" covers the Derby room, and its district says so: "Porto, Museu e
 * Derby"). Requires two tokens and a clear winner, or nothing matches.
 */
function matchCinema(venue: VeloxCine, candidates: Candidate[]): { cinemaId: string } | null {
  const tokens = new Set([...nameTokens(venue.placeName), ...nameTokens(venue.district ?? '')])
  const scored = candidates
    .map((c) => ({
      id: c.id,
      score: [...new Set([...nameTokens(c.name), ...nameTokens(c.neighborhood)])].filter((w) => tokens.has(w)).length,
    }))
    .sort((a, b) => b.score - a.score)
  const [best, second] = scored
  if (best && best.score >= 2 && best.score > (second?.score ?? 0)) return { cinemaId: best.id }
  return null
}

async function refreshVenues() {
  const cities = await db
    .select()
    .from(providerCity)
    .where(
      and(
        eq(providerCity.provider, 'velox'),
        or(isNull(providerCity.theatersSyncedAt), lt(providerCity.theatersSyncedAt, new Date(Date.now() - DAY))),
      ),
    )
    .orderBy(asc(providerCity.theatersSyncedAt))
    .limit(CITY_BATCH)

  let matched = 0
  for (const city of cities) {
    const venues = await velox.places(city.id)
    if (!venues.length) {
      await db.update(providerCity).set({ theatersSyncedAt: new Date() }).where(eq(providerCity.id, city.id))
      continue
    }
    const candidates = await db
      .select({ id: cinema.id, name: cinema.name, neighborhood: cinema.neighborhood })
      .from(cinema)
      .where(and(eq(cinema.state, city.state), sql`lower(${cinema.city}) = lower(${city.name})`))

    // One batch per city keeps the subrequest count flat in the city's size.
    type Statement = Parameters<typeof db.batch>[0][number]
    const statements: Statement[] = []
    for (const v of venues) {
      const match = matchCinema(v, candidates)
      if (match) matched++
      statements.push(
        db
          .insert(providerTheater)
          .values({
            // Velox place codes are short ("RSV"); namespace them by city.
            id: `${city.id}:${v.placeCod}`,
            provider: 'velox',
            cityId: city.id,
            cinemaId: match?.cinemaId ?? null,
            matchedBy: match ? 'name' : null,
            name: v.placeName,
            siteUrl: v.placeUrl,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: providerTheater.id,
            set: {
              cityId: city.id,
              cinemaId: match?.cinemaId ?? null,
              matchedBy: match ? 'name' : null,
              name: v.placeName,
              siteUrl: v.placeUrl,
              updatedAt: new Date(),
            },
          }),
      )
    }
    statements.push(db.update(providerCity).set({ theatersSyncedAt: new Date() }).where(eq(providerCity.id, city.id)))
    await db.batch(statements as [Statement, ...Statement[]])
  }
  return { cities: cities.length, matched }
}

// ---------- 3. sessions ----------

/** The calendar day `offset` days from now in `tz`, as YYYY-MM-DD. */
function localDay(tz: string, offset: number) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(Date.now() + offset * DAY))
}

/** The wall-clock "day + time" in `tz`, as a real Date. */
function zonedTime(tz: string, day: string, time: string) {
  // Wall clock misread as UTC, then corrected by the difference the time zone
  // makes when the same instant is rendered in `tz`.
  const asUtc = Date.parse(`${day}T${time}:00Z`)
  const [renderedDay, renderedTime] = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(new Date(asUtc))
    .split(', ')
  return new Date(asUtc - (Date.parse(`${renderedDay}T${renderedTime}:00Z`) - asUtc))
}

async function refreshSessions(theater: typeof providerTheater.$inferSelect, state: State) {
  const cinemaId = theater.cinemaId!
  const tz = timeZoneOf(state)
  const ours = await db.select().from(room).where(eq(room.cinemaId, cinemaId))
  const byNumber = new Map(ours.map((r) => [roomNumber(r.name), r]))
  const resolveRoom = (name: string) => (ours.length === 1 ? ours[0] : byNumber.get(roomNumber(name))) ?? null

  const films = new Map<string, typeof film.$inferInsert>()
  const rows: Array<typeof showtime.$inferInsert> = []
  const roomHints: Partial<typeof room.$inferInsert> & { id: string }[] = []
  for (let offset = 0; offset < SESSION_DAYS; offset++) {
    const day = localDay(tz, offset)
    const { movies } = await velox.venueDay(theater.siteUrl!, day)
    for (const { event, rooms } of movies) {
      films.set(`velox:${event.eventID}`, {
        id: `velox:${event.eventID}`,
        title: event.eventTitle,
        originalTitle: event.originalTitle || null,
        durationMinutes: event.duration || null,
        contentRating: event.typeRating || null,
        genres: event.genre ? [event.genre] : [],
        posterUrl: event.posterImageURL ?? null,
        siteUrl: event.EventTitleNormalized
          ? `https://www.veloxtickets.com/Portal/Evento/Cinema/${theater.cityId}/${event.EventTitleNormalized}/${event.eventID}`
          : null,
        updatedAt: new Date(),
      })
      for (const r of rooms) {
        const ourRoom = resolveRoom(r.roomNameShort ?? r.roomName) ?? resolveRoom(r.roomName)
        // Room filters double as room-detail hints: an "IMAX" room is an IMAX room.
        if (ourRoom) {
          const filterText = r.filters.map((f) => `${f.fCod} ${f.fCapt ?? ''}`).join(' ')
          const set: Partial<typeof room.$inferInsert> = {}
          const f = formatHint(`${r.roomName} ${filterText}`)
          const p = projectionHint(`${r.roomName} ${filterText}`)
          const s = soundHint(`${r.roomName} ${filterText}`)
          if (f && canWrite(ourRoom.formatSource)) Object.assign(set, { format: f, formatSource: 'velox' })
          if (p && canWrite(ourRoom.projectionSource)) Object.assign(set, { projection: p, projectionSource: 'velox' })
          if (s && canWrite(ourRoom.soundSource)) Object.assign(set, { sound: s, soundSource: 'velox' })
          if (Object.keys(set).length) roomHints.push({ id: ourRoom.id, ...set })
        }
        for (const s of r.schedules) {
          // "16/12 00:01" special sessions carry their day in the checkout URL.
          const time = s.startTime.includes(' ') ? s.startTime.split(' ')[1]! : s.startTime
          const sessionDay = s.url?.match(/\/(\d{4}-\d{2}-\d{2})\//)?.[1] ?? day
          // Started sessions are past; disabled ones without a checkout path are dead.
          if (s.isSessionInitiated || (s.disable && !s.url)) continue
          rows.push({
            id: `${theater.id}:${r.roomCod}:${sessionDay}:${time}`,
            theaterId: theater.id,
            cinemaId,
            roomId: ourRoom?.id ?? null,
            filmId: `velox:${event.eventID}`,
            startsAt: zonedTime(tz, sessionDay, time),
            localDay: sessionDay,
            localTime: time,
            roomName: r.roomNameShort ?? r.roomName,
            // "NUMERADA" is the room's seating policy, not a session type.
            types: r.filters.map((f) => f.fCod).filter((f) => f !== 'NUMERADA'),
            price: null,
            checkoutUrl: s.url ? new URL(s.url, 'https://www.veloxtickets.com').toString() : null,
          })
        }
      }
    }
  }

  // Replace this venue's programme for the synced window atomically; sessions
  // outside it (a special midnight première, say) survive untouched.
  const from = zonedTime(tz, localDay(tz, 0), '00:00')
  const to = zonedTime(tz, localDay(tz, SESSION_DAYS - 1), '23:59')
  const statements = [
    ...chunk([...films.values()], 8).map((batch) =>
      db
        .insert(film)
        .values(batch)
        .onConflictDoUpdate({
          target: film.id,
          set: {
            title: sql`excluded.title`,
            originalTitle: sql`excluded.original_title`,
            durationMinutes: sql`excluded.duration_minutes`,
            contentRating: sql`excluded.content_rating`,
            genres: sql`excluded.genres`,
            posterUrl: sql`excluded.poster_url`,
            siteUrl: sql`excluded.site_url`,
            updatedAt: sql`excluded.updated_at`,
          },
        }),
    ),
    db
      .delete(showtime)
      .where(and(eq(showtime.theaterId, theater.id), gte(showtime.startsAt, from), lte(showtime.startsAt, to))),
    ...chunk(rows, 7).map((batch) => db.insert(showtime).values(batch).onConflictDoNothing()),
    // Room-detail hints from filters, deduplicated per room.
    ...[...new Map(roomHints.map((h) => [h.id, h])).values()].map((h) =>
      db.update(room).set(h).where(eq(room.id, h.id)),
    ),
    db.update(providerTheater).set({ sessionsSyncedAt: new Date() }).where(eq(providerTheater.id, theater.id)),
  ]
  await db.batch(statements as [(typeof statements)[number], ...(typeof statements)[number][]])
  return rows.length
}

async function refreshStaleSessions() {
  const stale = await db
    .select({ theater: providerTheater, state: providerCity.state })
    .from(providerTheater)
    .innerJoin(providerCity, eq(providerCity.id, providerTheater.cityId))
    .where(
      and(
        eq(providerTheater.provider, 'velox'),
        isNotNull(providerTheater.cinemaId),
        or(
          isNull(providerTheater.sessionsSyncedAt),
          lt(providerTheater.sessionsSyncedAt, new Date(Date.now() - 2 * 60 * 60 * 1000)),
        ),
      ),
    )
    .orderBy(asc(providerTheater.sessionsSyncedAt))
    .limit(theaterBatch())

  let sessions = 0
  let failed = 0
  for (const { theater, state } of stale) {
    try {
      sessions += await refreshSessions(theater, state)
    } catch (error) {
      failed++
      console.error(`velox: sessions for venue ${theater.id} failed`, error)
      // Push it to the back of the queue so one bad venue can't block the rest.
      await db.update(providerTheater).set({ sessionsSyncedAt: new Date() }).where(eq(providerTheater.id, theater.id))
    }
  }
  return { venues: stale.length, sessions, failed }
}

// ---------- entry point ----------

/** Runs a step, logging (not throwing) failures so later steps still run. */
async function step<T>(name: string, run: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await run()
  } catch (error) {
    console.error(`velox: ${name} failed`, error)
    return { error: String(error) }
  }
}

export async function syncVelox() {
  const cities = await step('cities', refreshCities)
  const venues = await step('venues', refreshVenues)
  // A bootstrapping run (fresh city list) already spends its subrequest
  // budget; sessions start on the next tick.
  const bootstrapped = typeof cities === 'number' && cities > 0
  const sessions = bootstrapped ? { venues: 0, sessions: 0, failed: 0 } : await step('sessions', refreshStaleSessions)
  await step('cleanup', async () => {
    await db.delete(showtime).where(lt(showtime.startsAt, new Date(Date.now() - 3 * 60 * 60 * 1000)))
    // Films nobody is showing anymore.
    await db.delete(film).where(sql`${film.id} not in (select distinct ${showtime.filmId} from ${showtime})`)
  })
  const summary = { cities, venues, sessions }
  console.log('velox sync', JSON.stringify(summary))
  return summary
}
