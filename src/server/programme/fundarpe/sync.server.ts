// Fundarpe sync: Cinema São Luiz's sessions from ingressosfundarpe.com.br.
// Runs on the */30 cron, refreshing at most every REFRESH_EVERY. Event codes
// are sequential and shared with Fundarpe's theatres, so each run checks the
// codes from a little below the newest São Luiz film seen to a little above
// that (new films get new codes), one request at a time.
import { and, eq, gte, isNotNull, like, notLike, sql } from 'drizzle-orm'
import { db } from '../../db/client.server'
import { film, providerTheater, room, showtime } from '../../db/schema.server'
import { chunk, fold, localDay, zonedTime } from '../shared.server'
import { isoDay, presentations } from './api.server'

const REFRESH_EVERY = 3 * 60 * 60 * 1000
const TIME_ZONE = 'America/Recife'
/** Fundarpe's sales base for these venues (from the site's own requests). */
const ID_BASE = 581
/** Lowest code worth scanning (São Luiz films were 52–55 in Oct 2026). */
const CODE_FLOOR = 45
const SCAN_BELOW = 15
const SCAN_ABOVE = 25
const SITE_URL = 'https://ingressosfundarpe.com.br/'

/** Venue name in the API → our ANCINE cinema. Only cinema-only venues: the API can't tell films from shows. */
const VENUES = [
  {
    match: /cinema s[aã]o luiz/i,
    theaterId: 'fundarpe:sao-luiz',
    cinemaId: 'cinema-sao-luiz',
    name: 'Cinema São Luiz',
  },
] as const

const filmIdOf = (code: number) => `fundarpe:${ID_BASE}:${code}`
/** Title compared without case, accents or punctuation: "Naza." and "NAZA" match. */
const titleKey = (title: string) =>
  fold(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')

/**
 * Fundarpe publishes no posters or runtimes, but the same films usually play
 * elsewhere: borrow those details from another provider's film with the same
 * title (Ingresso.com first, then Velox).
 */
async function borrowDetails(films: Map<string, typeof film.$inferInsert>) {
  if (films.size === 0) return
  const donors = await db
    .select({
      id: film.id,
      title: film.title,
      posterUrl: film.posterUrl,
      durationMinutes: film.durationMinutes,
      contentRating: film.contentRating,
      genres: film.genres,
      releaseYear: film.releaseYear,
    })
    .from(film)
    .where(and(isNotNull(film.posterUrl), notLike(film.id, 'fundarpe:%')))
  const byTitle = new Map<string, (typeof donors)[number]>()
  // Velox ids are prefixed, Ingresso's are numeric: insert Velox first so Ingresso wins.
  for (const d of donors.sort((a, b) => Number(!a.id.startsWith('velox:')) - Number(!b.id.startsWith('velox:'))))
    byTitle.set(titleKey(d.title), d)
  for (const f of films.values()) {
    const donor = byTitle.get(titleKey(f.title))
    if (!donor) continue
    Object.assign(f, {
      posterUrl: donor.posterUrl,
      durationMinutes: donor.durationMinutes,
      contentRating: donor.contentRating,
      genres: donor.genres,
      releaseYear: donor.releaseYear,
    })
  }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** The newest event code we already know a São Luiz film by. */
async function newestKnownCode() {
  const [row] = await db
    .select({
      code: sql<number | null>`max(cast(substr(${film.id}, ${`fundarpe:${ID_BASE}:`.length + 1}) as integer))`,
    })
    .from(film)
    .where(like(film.id, `fundarpe:${ID_BASE}:%`))
  return Math.max(CODE_FLOOR + SCAN_BELOW, row?.code ?? 0)
}

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
      provider: 'fundarpe',
      cityId: 'fundarpe:recife',
      cinemaId: venue.cinemaId,
      matchedBy: 'manual',
      name: venue.name,
      siteUrl: SITE_URL,
      updatedAt: now,
    })
    .onConflictDoUpdate({ target: providerTheater.id, set: { cinemaId: venue.cinemaId, updatedAt: now } })

  const newest = await newestKnownCode()
  const today = localDay(TIME_ZONE, 0)
  const [onlyRoom, ...others] = await db.select({ id: room.id }).from(room).where(eq(room.cinemaId, venue.cinemaId))
  const roomId = others.length === 0 ? (onlyRoom?.id ?? null) : null

  const films = new Map<string, typeof film.$inferInsert>()
  const rows: Array<typeof showtime.$inferInsert> = []
  for (let code = Math.max(CODE_FLOOR, newest - SCAN_BELOW); code <= newest + SCAN_ABOVE; code++) {
    const sessions = (await presentations(ID_BASE, code)).filter((p) =>
      venue.match.test(p.ds_local_evento ?? p.NomSala ?? ''),
    )
    await sleep(250)
    for (const p of sessions) {
      const day = isoDay(p.day, p.year)
      if (!day || day < today || !/^\d{2}:\d{2}$/.test(p.HorSessao)) continue
      const filmId = filmIdOf(code)
      films.set(filmId, { id: filmId, title: p.NomPeca.trim(), genres: [], siteUrl: SITE_URL, updatedAt: now })
      const soldOut = Boolean(p.in_esgotado_automatico || p.in_esgotado_manual)
      rows.push({
        id: `fundarpe:${p.id_apresentacao}`,
        theaterId: venue.theaterId,
        cinemaId: venue.cinemaId,
        roomId,
        filmId,
        startsAt: zonedTime(TIME_ZONE, day, p.HorSessao),
        localDay: day,
        localTime: p.HorSessao,
        roomName: p.NomSala?.trim() || venue.name,
        types: soldOut ? ['ESGOTADO'] : [],
        price: p.ValPeca ?? null,
        checkoutUrl: soldOut ? null : SITE_URL,
      })
    }
  }

  await borrowDetails(films)

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
            posterUrl: sql`excluded.poster_url`,
            durationMinutes: sql`excluded.duration_minutes`,
            contentRating: sql`excluded.content_rating`,
            genres: sql`excluded.genres`,
            releaseYear: sql`excluded.release_year`,
            updatedAt: sql`excluded.updated_at`,
          },
        }),
    ),
    db.delete(showtime).where(and(eq(showtime.theaterId, venue.theaterId), gte(showtime.startsAt, from))),
    ...chunk(rows, 7).map((batch) => db.insert(showtime).values(batch).onConflictDoNothing()),
    db.update(providerTheater).set({ sessionsSyncedAt: now }).where(eq(providerTheater.id, venue.theaterId)),
  ]
  await db.batch(statements as [Statement, ...Statement[]])
  return {
    films: films.size,
    sessions: rows.length,
    scanned: `${Math.max(CODE_FLOOR, newest - SCAN_BELOW)}–${newest + SCAN_ABOVE}`,
  }
}

export async function syncFundarpe() {
  const results: Record<string, unknown> = {}
  for (const venue of VENUES) {
    try {
      results[venue.theaterId] = await syncVenue(venue)
    } catch (error) {
      console.error(`fundarpe: ${venue.theaterId} failed`, error)
      results[venue.theaterId] = { error: String(error) }
    }
  }
  console.log('fundarpe sync', JSON.stringify(results))
  return results
}
