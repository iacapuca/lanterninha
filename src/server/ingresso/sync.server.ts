// Incremental Ingresso.com sync, run by the Worker's cron trigger. Each run
// stays well under the free plan's ~50 subrequests:
//   1. weekly: refresh the city list (1 call)
//   2. theaters for the CITY_BATCH least recently refreshed cities, matched to
//      ANCINE cinemas by CNPJ, else by location + name
//   3. today's and tomorrow's sessions for the THEATER_BATCH stalest matched theaters
//   4. drop sessions that already started more than 3 hours ago
import { env } from 'cloudflare:workers'
import { and, asc, eq, gte, isNotNull, isNull, lt, or, sql } from 'drizzle-orm'
import type { Format, FactSource, Projection, Sound, State } from '~/lib/domain'
import { db } from '../db/client.server'
import { cinema, film, ingressoCity, ingressoTheater, room, showtime } from '../db/schema.server'
import { ingresso, type IngressoMovie, type IngressoTheater } from './api.server'

const DAY = 24 * 60 * 60 * 1000
const CITY_BATCH = 5
const theaterBatch = () => Number(env.INGRESSO_THEATER_BATCH) || 15

// ---------- helpers ----------

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
const digits = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '')
const GENERIC = new Set(['CINE', 'CINEMA', 'CINEMAS', 'SHOPPING', 'SALA', 'SALAS', 'DE', 'DO', 'DA', 'THE', 'MALL', 'CENTER', 'PLAZA'])
const nameTokens = (s: string) => new Set(fold(s).split(/[^A-Z0-9]+/).filter((t) => t.length > 2 && !GENERIC.has(t)))

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (d: number) => (d * Math.PI) / 180
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2
  return 6_371_000 * 2 * Math.asin(Math.sqrt(h))
}

/** "Sala 03", "SALA 7 - IMAX", "Bradesco Prime 2" → 3, 7, 2. Ignores digits inside 4DX/3D. */
export function roomNumber(name: string): number | null {
  const cleaned = fold(name).replace(/(?<![A-Z0-9])(4DX|3D|2D|4D|4K|D-?BOX)(?![A-Z0-9])/g, ' ')
  const match = cleaned.match(/(?:SALA\s*)?0*(\d{1,2})(?!\d)/)
  return match ? Number(match[1]) : null
}

const FORMAT_HINTS: Array<[RegExp, Format]> = [
  [/IMAX/, 'imax'],
  [/4DX/, '4dx'],
  [/D-?BOX/, 'dbox'],
  [/MACRO|(?<![A-Z])XE(?![A-Z])/, 'macroxe'],
  [/(?<![A-Z])XD(?![A-Z])/, 'xd'],
  [/PRIME/, 'prime'],
  [/VIP|PREMIER|PLATINUM|DELUX|LOUNGE/, 'vip'],
]
const formatHint = (text: string) => FORMAT_HINTS.find(([re]) => re.test(fold(text)))?.[1] ?? null
const projectionHint = (text: string): Projection | null => (/LASER/.test(fold(text)) ? 'laser' : null)
const soundHint = (text: string): Sound | null => (/ATMOS/.test(fold(text)) ? 'atmos' : null)

/** Ingresso knows better than a guess from ANCINE's name, but never overrides the community. */
const canWrite = (source: FactSource | null) => source == null || source === 'ancine'

/** The São Paulo calendar day `offset` days from now, as YYYY-MM-DD. */
const spDay = (offset: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(Date.now() + offset * DAY))

/** D1 caps bound parameters per statement, so multi-row inserts are chunked. */
function chunk<T>(rows: T[], size: number) {
  return Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, (i + 1) * size))
}

// ---------- 1. cities ----------

async function refreshCities() {
  const [{ n }] = (await db.select({ n: sql<number>`count(*)` }).from(ingressoCity)) as [{ n: number }]
  const [stale] = await db.select({ id: ingressoCity.id }).from(ingressoCity).where(lt(ingressoCity.theatersSyncedAt, new Date(Date.now() - 7 * DAY))).limit(1)
  if (n > 0 && !stale) return 0
  const cities = await ingresso.cities()
  for (const batch of chunk(cities, 20)) {
    await db
      .insert(ingressoCity)
      .values(batch.map((c) => ({ id: c.id, name: c.name, state: c.uf as State })))
      .onConflictDoUpdate({ target: ingressoCity.id, set: { name: sql`excluded.name`, state: sql`excluded.state` } })
  }
  return cities.length
}

// ---------- 2. theaters ----------

type Candidate = { id: string; name: string; cnpj: string | null; lat: number | null; lng: number | null }

function matchCinema(t: IngressoTheater, candidates: Candidate[]): { cinemaId: string; matchedBy: 'cnpj' | 'location' } | null {
  const here = t.geolocation
  const near = (c: Candidate) => (here && c.lat != null && c.lng != null ? distanceMeters(here, { lat: c.lat, lng: c.lng }) : Infinity)

  // CNPJ first; if several complexes share it (one company, many venues), take the closest.
  const byCnpj = candidates.filter((c) => c.cnpj && c.cnpj === digits(t.cnpj)).sort((a, b) => near(a) - near(b))
  if (byCnpj.length === 1 || (byCnpj.length > 1 && near(byCnpj[0]!) < 2_000)) return { cinemaId: byCnpj[0]!.id, matchedBy: 'cnpj' }

  // Otherwise: within 600 m and sharing a meaningful word in the name.
  const tokens = nameTokens(t.name)
  const byPlace = candidates
    .filter((c) => near(c) < 600 && [...nameTokens(c.name)].some((w) => tokens.has(w)))
    .sort((a, b) => near(a) - near(b))
  return byPlace[0] ? { cinemaId: byPlace[0].id, matchedBy: 'location' } : null
}

/** Room names like "Sala 1 - LASER" or "Sala 5 - IMAX" fill in unknown room details. */
async function applyRoomNameHints(cinemaId: string, rooms: IngressoTheater['rooms']) {
  const ours = await db.select().from(room).where(eq(room.cinemaId, cinemaId))
  const byNumber = new Map(ours.map((r) => [roomNumber(r.name), r]))
  for (const ingressoRoom of rooms) {
    const target = ours.length === 1 ? ours[0] : byNumber.get(roomNumber(ingressoRoom.name))
    if (!target) continue
    const set: Partial<typeof room.$inferInsert> = {}
    const f = formatHint(ingressoRoom.name)
    const p = projectionHint(ingressoRoom.name)
    const s = soundHint(ingressoRoom.name)
    if (f && canWrite(target.formatSource)) Object.assign(set, { format: f, formatSource: 'ingresso' })
    if (p && canWrite(target.projectionSource)) Object.assign(set, { projection: p, projectionSource: 'ingresso' })
    if (s && canWrite(target.soundSource)) Object.assign(set, { sound: s, soundSource: 'ingresso' })
    if (Object.keys(set).length) await db.update(room).set(set).where(eq(room.id, target.id))
  }
}

async function refreshTheaters() {
  const cities = await db
    .select()
    .from(ingressoCity)
    .where(or(isNull(ingressoCity.theatersSyncedAt), lt(ingressoCity.theatersSyncedAt, new Date(Date.now() - DAY))))
    .orderBy(asc(ingressoCity.theatersSyncedAt))
    .limit(CITY_BATCH)

  let matched = 0
  for (const city of cities) {
    const theaters = await ingresso.theatersInCity(city.id)
    const candidates = theaters.length
      ? await db
          .select({ id: cinema.id, name: cinema.name, cnpj: cinema.cnpj, lat: cinema.lat, lng: cinema.lng })
          .from(cinema)
          .where(eq(cinema.state, city.state))
      : []

    for (const t of theaters) {
      const match = matchCinema(t, candidates)
      if (match) matched++
      await db
        .insert(ingressoTheater)
        .values({
          id: t.id,
          cityId: city.id,
          cinemaId: match?.cinemaId ?? null,
          matchedBy: match?.matchedBy ?? null,
          name: t.name,
          cnpj: digits(t.cnpj) || null,
          lat: t.geolocation?.lat ?? null,
          lng: t.geolocation?.lng ?? null,
          siteUrl: t.siteURL ?? null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: ingressoTheater.id,
          set: {
            cityId: city.id,
            cinemaId: match?.cinemaId ?? null,
            matchedBy: match?.matchedBy ?? null,
            name: t.name,
            cnpj: digits(t.cnpj) || null,
            lat: t.geolocation?.lat ?? null,
            lng: t.geolocation?.lng ?? null,
            siteUrl: t.siteURL ?? null,
            updatedAt: new Date(),
          },
        })
      if (match) {
        await applyRoomNameHints(match.cinemaId, t.rooms)
        // Ingresso's coordinates are exact; prefer them over city centroids and geocoding.
        if (t.geolocation) {
          await db
            .update(cinema)
            .set({ lat: t.geolocation.lat, lng: t.geolocation.lng, geoPrecision: 'address' })
            .where(eq(cinema.id, match.cinemaId))
        }
      }
    }
    await db.update(ingressoCity).set({ theatersSyncedAt: new Date() }).where(eq(ingressoCity.id, city.id))
  }
  return { cities: cities.length, matched }
}

// ---------- 3. sessions ----------

function posterOf(m: IngressoMovie) {
  return (m.images.find((i) => /poster/i.test(i.type ?? '')) ?? m.images[0])?.url ?? null
}

async function refreshSessions(theater: typeof ingressoTheater.$inferSelect) {
  const cinemaId = theater.cinemaId!
  const ours = await db.select().from(room).where(eq(room.cinemaId, cinemaId))
  const byNumber = new Map(ours.map((r) => [roomNumber(r.name), r]))
  const resolveRoom = (name: string) => (ours.length === 1 ? ours[0] : byNumber.get(roomNumber(name))) ?? null

  const movies = (await Promise.all([0, 1].map((d) => ingresso.sessions(theater.cityId, theater.id, spDay(d))))).flat()

  const films = new Map<string, typeof film.$inferInsert>()
  const rows: Array<typeof showtime.$inferInsert> = []
  const typesByRoom = new Map<string, string[]>()
  for (const m of movies) {
    films.set(m.id, {
      id: m.id,
      title: m.title,
      originalTitle: m.originalTitle || null,
      ancineId: m.ancineId || null,
      durationMinutes: m.duration || null,
      contentRating: m.contentRating || null,
      releaseYear: m.releaseYear || null,
      genres: m.genres,
      posterUrl: posterOf(m),
      siteUrl: m.siteURL ?? null,
      updatedAt: new Date(),
    })
    for (const r of m.rooms) {
      for (const s of r.sessions) {
        const when = (s.realDate ?? s.date)?.localDate
        if (!when) continue
        const roomName = s.room ?? r.name ?? ''
        const ourRoom = resolveRoom(roomName)
        const types = s.types.map((t) => t.alias || t.name)
        if (ourRoom) typesByRoom.set(ourRoom.id, [...(typesByRoom.get(ourRoom.id) ?? []), ...s.types.map((t) => t.name)])
        rows.push({
          id: s.id,
          theaterId: theater.id,
          cinemaId,
          roomId: ourRoom?.id ?? null,
          filmId: m.id,
          startsAt: new Date(when),
          // "2026-10-14T22:15:00-03:00" → the cinema's own day and time, whatever its time zone.
          localDay: when.slice(0, 10),
          localTime: when.slice(11, 16),
          roomName,
          types,
          price: s.price ?? null,
          checkoutUrl: s.siteURL ?? null,
        })
      }
    }
  }

  // Replace this theater's programme for the synced window atomically.
  const from = new Date(`${spDay(0)}T00:00:00-03:00`)
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
            ancineId: sql`excluded.ancine_id`,
            durationMinutes: sql`excluded.duration_minutes`,
            contentRating: sql`excluded.content_rating`,
            releaseYear: sql`excluded.release_year`,
            genres: sql`excluded.genres`,
            posterUrl: sql`excluded.poster_url`,
            siteUrl: sql`excluded.site_url`,
            updatedAt: sql`excluded.updated_at`,
          },
        }),
    ),
    db.delete(showtime).where(and(eq(showtime.theaterId, theater.id), gte(showtime.startsAt, from))),
    ...chunk(rows, 7).map((batch) => db.insert(showtime).values(batch).onConflictDoNothing()),
    db.update(ingressoTheater).set({ sessionsSyncedAt: new Date() }).where(eq(ingressoTheater.id, theater.id)),
  ]
  await db.batch(statements as [(typeof statements)[number], ...(typeof statements)[number][]])

  // Session types reveal formats: a room that runs IMAX sessions is an IMAX room.
  for (const [roomId, names] of typesByRoom) {
    const target = ours.find((r) => r.id === roomId)!
    const counts = new Map<Format, number>()
    for (const n of names) {
      const f = formatHint(n)
      if (f) counts.set(f, (counts.get(f) ?? 0) + 1)
    }
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    if (best && canWrite(target.formatSource)) {
      await db.update(room).set({ format: best, formatSource: 'ingresso' }).where(eq(room.id, roomId))
    } else if (!best && names.length >= 6 && target.format == null) {
      // Plenty of sessions and none premium: it's a standard room.
      await db.update(room).set({ format: 'standard', formatSource: 'ingresso' }).where(eq(room.id, roomId))
    }
  }
  return rows.length
}

async function refreshStaleSessions() {
  const stale = await db
    .select()
    .from(ingressoTheater)
    .where(
      and(
        isNotNull(ingressoTheater.cinemaId),
        or(isNull(ingressoTheater.sessionsSyncedAt), lt(ingressoTheater.sessionsSyncedAt, new Date(Date.now() - 2 * 60 * 60 * 1000))),
      ),
    )
    .orderBy(asc(ingressoTheater.sessionsSyncedAt))
    .limit(theaterBatch())

  let sessions = 0
  let failed = 0
  for (const t of stale) {
    try {
      sessions += await refreshSessions(t)
    } catch (error) {
      failed++
      console.error(`ingresso: sessions for theater ${t.id} failed`, error)
      // Push it to the back of the queue so one bad theater can't block the rest.
      await db.update(ingressoTheater).set({ sessionsSyncedAt: new Date() }).where(eq(ingressoTheater.id, t.id))
    }
  }
  return { theaters: stale.length, sessions, failed }
}

// ---------- entry point ----------

/** Runs a step, logging (not throwing) failures so later steps still run. */
async function step<T>(name: string, run: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await run()
  } catch (error) {
    console.error(`ingresso: ${name} failed`, error)
    return { error: String(error) }
  }
}

export async function syncIngresso() {
  const cities = await step('cities', refreshCities)
  const theaters = await step('theaters', refreshTheaters)
  const sessions = await step('sessions', refreshStaleSessions)
  await step('cleanup', async () => {
    await db.delete(showtime).where(lt(showtime.startsAt, new Date(Date.now() - 3 * 60 * 60 * 1000)))
    // Films nobody is showing anymore.
    await db.delete(film).where(sql`${film.id} not in (select distinct ${showtime.filmId} from ${showtime})`)
  })
  const summary = { cities, theaters, sessions }
  console.log('ingresso sync', JSON.stringify(summary))
  return summary
}

