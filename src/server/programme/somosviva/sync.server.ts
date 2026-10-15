// Somos Viva sync: the parks' public calendar → Cine Apipucos's sessions.
// Runs on the */30 cron alongside Velox but refreshes at most every
// REFRESH_EVERY, since one pass downloads the whole calendar (~28 MB) and an
// open-air park cinema's schedule changes a few times a week at most.
import { and, eq, gte, inArray, sql } from 'drizzle-orm'
import { db } from '../../db/client.server'
import { film, filmPoster, providerTheater, room, showtime } from '../../db/schema.server'
import { chunk, fold, localDay, zonedTime } from '../shared.server'
import { cinemaEvents, decodeDataUrl, durationMinutes } from './api.server'

const REFRESH_EVERY = 6 * 60 * 60 * 1000
const TIME_ZONE = 'America/Recife'

/** Single-venue source, so the ANCINE cinema is linked by hand. */
const VENUES = [
  {
    theaterId: 'somosviva:apipucos',
    location: 'Apipucos',
    cinemaId: 'complexo-parque-de-apipucos',
    name: 'Cine Apipucos (Parque Apipucos)',
    siteUrl: 'https://apipucos.somosviva.com.br/',
  },
] as const

/** Films recur across dates under new record ids, so they're keyed by title. */
const filmId = (title: string) =>
  `somosviva:${fold(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`

async function syncVenue(venue: (typeof VENUES)[number]) {
  const [existing] = await db
    .select({ syncedAt: providerTheater.sessionsSyncedAt })
    .from(providerTheater)
    .where(eq(providerTheater.id, venue.theaterId))
  if (existing?.syncedAt && Date.now() - existing.syncedAt.getTime() < REFRESH_EVERY) return { skipped: true }

  const now = new Date()
  await db
    .insert(providerTheater)
    .values({
      id: venue.theaterId,
      provider: 'somosviva',
      cityId: 'somosviva:recife',
      cinemaId: venue.cinemaId,
      matchedBy: 'manual',
      name: venue.name,
      siteUrl: venue.siteUrl,
      updatedAt: now,
    })
    .onConflictDoUpdate({ target: providerTheater.id, set: { cinemaId: venue.cinemaId, name: venue.name, updatedAt: now } })

  const events = await cinemaEvents(venue.location)
  const today = localDay(TIME_ZONE, 0)
  const upcoming = events.filter((e) => e.start.slice(0, 10) >= today)
  const [onlyRoom, ...others] = await db.select({ id: room.id }).from(room).where(eq(room.cinemaId, venue.cinemaId))
  const roomId = others.length === 0 ? (onlyRoom?.id ?? null) : null

  const films = new Map<string, typeof film.$inferInsert>()
  const posters = new Map<string, string | null | undefined>()
  const rows: Array<typeof showtime.$inferInsert> = []
  for (const e of upcoming) {
    const id = filmId(e.title)
    films.set(id, {
      id,
      title: e.title.trim(),
      durationMinutes: durationMinutes(e.description),
      genres: [],
      posterUrl: e.imageDataUrl ? `/posters/${encodeURIComponent(id)}` : null,
      siteUrl: venue.siteUrl,
      updatedAt: now,
    })
    if (!posters.has(id)) posters.set(id, e.imageDataUrl)
    const [day, clock] = e.start.split('T') as [string, string]
    const time = clock.slice(0, 5)
    rows.push({
      id: `${venue.theaterId}:${e.id}`,
      theaterId: venue.theaterId,
      cinemaId: venue.cinemaId,
      roomId,
      filmId: id,
      startsAt: zonedTime(TIME_ZONE, day, time),
      localDay: day,
      localTime: time,
      roomName: 'Espaço Pipoca',
      types: ['GRATUITO'],
      price: 0,
      checkoutUrl: null,
    })
  }

  // Only decode posters we don't have yet: they're ~250 KB each.
  const stored = films.size
    ? new Set(
        (
          await db
            .select({ filmId: filmPoster.filmId })
            .from(filmPoster)
            .where(inArray(filmPoster.filmId, [...films.keys()]))
        ).map((p) => p.filmId),
      )
    : new Set<string>()

  const from = zonedTime(TIME_ZONE, today, '00:00')
  type Statement = Parameters<typeof db.batch>[0][number]
  const statements: Statement[] = [
    ...chunk([...films.values()], 8).map((batch) =>
      db
        .insert(film)
        .values(batch)
        .onConflictDoUpdate({
          target: film.id,
          set: {
            title: sql`excluded.title`,
            durationMinutes: sql`excluded.duration_minutes`,
            posterUrl: sql`excluded.poster_url`,
            updatedAt: sql`excluded.updated_at`,
          },
        }),
    ),
    db.delete(showtime).where(and(eq(showtime.theaterId, venue.theaterId), gte(showtime.startsAt, from))),
    ...chunk(rows, 7).map((batch) => db.insert(showtime).values(batch).onConflictDoNothing()),
    db.update(providerTheater).set({ sessionsSyncedAt: now }).where(eq(providerTheater.id, venue.theaterId)),
  ]
  await db.batch(statements as [Statement, ...Statement[]])

  // Posters after their films exist (foreign key), one row each to stay under D1's statement size.
  let newPosters = 0
  for (const [id, dataUrl] of posters) {
    if (stored.has(id)) continue
    const poster = decodeDataUrl(dataUrl)
    if (!poster) continue
    await db
      .insert(filmPoster)
      .values({ filmId: id, contentType: poster.contentType, data: poster.bytes })
      .onConflictDoNothing()
    newPosters++
  }
  return { sessions: rows.length, films: films.size, newPosters }
}

export async function syncSomosViva() {
  const results: Record<string, unknown> = {}
  for (const venue of VENUES) {
    try {
      results[venue.theaterId] = await syncVenue(venue)
    } catch (error) {
      console.error(`somosviva: ${venue.theaterId} failed`, error)
      results[venue.theaterId] = { error: String(error) }
    }
  }
  console.log('somosviva sync', JSON.stringify(results))
  return results
}
