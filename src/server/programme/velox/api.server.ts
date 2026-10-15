// Velox Tickets has no public REST API: the ASP.NET portal server-renders
// every page with the full data model embedded as JavaScript literals
// (`var eventsData = [...]`, `var eventPlacesDetailData = [...]`…). Those
// literals are the de-facto API, so this client fetches the HTML and
// extracts the JSON blobs. Only fields Lanterninha uses are parsed; schemas
// are lenient so a new or missing field upstream skips a record instead of
// breaking the sync.
//
// Page map (city is the URL-normalized name, e.g. "Recife"):
//   /Portal/Ingresso/Cinema/<city>                        → eventsData (now showing + coming soon)
//   /Portal/Locais/Cinema/<city>                          → cinesData (the city's venues)
//   /Portal/Evento/Cinema/<city>/<slug>/<id>              → eventDetailData, eventDatesData, eventPlacesData
//   /Portal/Evento/Cinema/<city>/<slug>/<id>/<YYYY-MM-DD> → eventPlacesDetailData (rooms + schedules)
import { z } from 'zod'

const BASE = 'https://www.veloxtickets.com/Portal'
const USER_AGENT = 'lanterninha/1.0 (+https://lanterninha.plpbs.workers.dev)'

async function page(path: string): Promise<string> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    // A hung upstream call must not eat the whole sync run.
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`Velox ${res.status} for ${path}`)
  return res.text()
}

/**
 * Extracts the JSON value assigned right after `needle` (e.g. `var eventsData =`),
 * scanning with a string-aware bracket counter so a `]` inside a string can't
 * truncate the value. Throws when the literal is missing or unbalanced.
 */
function extractJson(html: string, needle: string): unknown {
  const at = html.indexOf(needle)
  if (at < 0) throw new Error(`Velox: ${needle.trim()} not found`)
  let i = html.indexOf('=', at) + 1
  while (i < html.length && /\s/.test(html[i]!)) i++
  const open = html[i]!
  if (open !== '[' && open !== '{') throw new Error(`Velox: no JSON after ${needle.trim()}`)
  const close = open === '[' ? ']' : '}'
  let depth = 0
  let inString = false
  let escaped = false
  for (let j = i; j < html.length; j++) {
    const c = html[j]!
    if (inString) {
      if (escaped) escaped = false
      else if (c === '\\') escaped = true
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') inString = true
    else if (c === open) depth++
    else if (c === close && --depth === 0) return JSON.parse(html.slice(i, j + 1))
  }
  throw new Error(`Velox: unbalanced JSON after ${needle.trim()}`)
}

/** Parses a page literal one item at a time so a single malformed record never sinks the rest. */
function parseAll<T>(value: unknown, schema: z.ZodType<T>): T[] {
  return (Array.isArray(value) ? value : []).flatMap((item) => {
    const parsed = schema.safeParse(item)
    return parsed.success ? [parsed.data] : []
  })
}

/** Velox ships "Selecione…" placeholder entries in its place and city lists. */
const notPlaceholder = (name: string | null | undefined) => !(name ?? '').startsWith('Selecione')

// ---------- schemas ----------

const event = z.object({
  eventID: z.coerce.string(),
  eventTitle: z.string(),
  eventComingSoon: z.boolean().default(false),
  /** "EmCartaz" for now showing; "Outubro2026", "Novembro2026"… for coming soon. */
  releaseDateStr: z.string().nullish(),
  /** "Venda Antecipada", "Estreia"…; null when the movie is plainly on. */
  complementaryText: z.string().nullish(),
  posterImage: z.string().nullish(),
  trailerURL: z.string().nullish(),
  /** Portal path of the movie page: `/Portal/Evento/Cinema/<city>/<slug>/<id>`. */
  moviePage: z.string(),
  distributor: z.string().nullish(),
  genre: z.string().nullish(),
  typeRating: z.string().nullish(),
  /** Free-form HTML with the full content-rating justification. */
  contentRating: z.string().nullish(),
})
export type VeloxEvent = z.infer<typeof event>

const cityEntry = z.object({
  stateCod: z.string(),
  stateName: z.string().nullish(),
  cities: z
    .array(
      z.object({
        cityCod: z.string().nullish(),
        cityName: z.string(),
        /** URL form with dashes: "Recife", "Delmiro-Gouveia". */
        cityNameNorm: z.string(),
      }),
    )
    .default([]),
})
export type VeloxCity = z.infer<typeof cityEntry>

const detail = z.object({
  eventID: z.coerce.string(),
  eventTitle: z.string(),
  EventTitleNormalized: z.string().nullish(),
  originalTitle: z.string().nullish(),
  posterImageURL: z.string().nullish(),
  trailerURL: z.string().nullish(),
  /** ISO date, "0001-01-01…" when genuinely unset. */
  releaseDate: z.string().nullish(),
  /** Synopsis ("review" is Velox's field name). */
  review: z.string().nullish(),
  /** Minutes. */
  duration: z.coerce.number().nullish(),
  genre: z.string().nullish(),
  typeRating: z.string().nullish(),
  distributor: z.string().nullish(),
})
export type VeloxDetail = z.infer<typeof detail>

const date = z.object({ date: z.string(), url: z.string() })
export type VeloxDate = z.infer<typeof date>

const place = z.object({
  placeCod: z.string(),
  placeName: z.string(),
  placeUrl: z.string().nullish(),
  address: z.string().nullish(),
  district: z.string().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  addr: z.string().nullish(),
  redeName: z.string().nullish(),
})
export type VeloxPlace = z.infer<typeof place>

/** Filter codes as Velox shows them: "LEG", "DUB", "3D", "IMAX", "NUMERADA"… */
const filter = z.object({ fCod: z.string(), fCapt: z.string().nullish() })
export type VeloxFilter = z.infer<typeof filter>

const schedule = z.object({
  /** "HH:MM"; special sessions carry the day too ("16/12 00:01"). */
  startTime: z.string(),
  isSpecial: z.boolean().default(false),
  specialAlert: z.string().nullish(),
  /** Portal path to buy this session (empty once the session has started). */
  url: z.string().nullish(),
  id: z.string().nullish(),
  /** Velox's flag for sessions that can no longer be bought ("Já exibido"…). */
  disable: z.boolean().default(false),
  isSoldOut: z.boolean().default(false),
  isLastSeats: z.boolean().default(false),
  /** True when the session already started (id/url are then blank). */
  isSessionInitiated: z.boolean().default(false),
})
export type VeloxSchedule = z.infer<typeof schedule>

const room = z.object({
  roomCod: z.string(),
  roomName: z.string(),
  roomNameShort: z.string().nullish(),
  filters: z.array(filter).default([]),
  schedules: z.array(schedule).default([]),
})
export type VeloxRoom = z.infer<typeof room>

const placeDetail = z.object({ place: place, rooms: z.array(room).default([]) })
export type VeloxPlaceDetail = z.infer<typeof placeDetail>

/** A movie playing at a venue, with its rooms and schedules for one day. */
const venueMovie = z.object({ event: detail, rooms: z.array(room).default([]) })
export type VeloxVenueMovie = z.infer<typeof venueMovie>

const cine = z.object({
  placeCod: z.string(),
  placeName: z.string(),
  /** URL form with dashes; required, since the venue pages are keyed by it. */
  placeNameNorm: z.string(),
  district: z.string().nullish(),
  redeName: z.string().nullish(),
  fulladdress: z.string().nullish(),
  pagePlace: z.string().nullish(),
})
export type VeloxCine = z.infer<typeof cine> & { placeUrl: string }

// ---------- client ----------

const eventPath = (city: string, slug: string, id: string) => `/Evento/Cinema/${city}/${slug}/${id}`

export const velox = {
  /**
   * Every movie listed for a city: now showing (`eventComingSoon: false`) plus
   * coming soon, each with its portal path for detail/dates/sessions.
   */
  movies: async (city: string): Promise<VeloxEvent[]> =>
    parseAll(await extractJson(await page(`/Ingresso/Cinema/${city}`), 'var eventsData ='), event),

  /** All states and cities Velox sells in, as embedded in the portal home page. */
  cities: async (): Promise<VeloxCity[]> => {
    const states = parseAll(await extractJson(await page(`/Ingresso/Cinema/Recife`), 'MainData.Header.citiesData='), cityEntry)
    return states.map((s) => ({ ...s, cities: s.cities.filter((c) => notPlaceholder(c.cityNameNorm)) }))
  },

  /** The city's venues (cinemas and other screening places), with their day-page path. */
  places: async (city: string): Promise<VeloxCine[]> =>
    parseAll(await extractJson(await page(`/Locais/Cinema/${city}`), 'var cinesData ='), cine).map((c) => ({
      ...c,
      // The listed `pagePlace` is sometimes wrapped in an /Authenticate/ flow;
      // the venue-day pages are always reachable at the canonical path.
      placeUrl: `/Local/Cinema/${city}/${c.placeNameNorm}/${c.placeCod}`,
    })),

  /** Movie metadata, sale dates and the venues playing it. */
  movie: async (city: string, slug: string, id: string) => {
    const html = await page(eventPath(city, slug, id))
    return {
      detail: detail.parse(await extractJson(html, 'var eventDetailData =')),
      dates: parseAll(await extractJson(html, 'var eventDatesData ='), date),
      places: parseAll(await extractJson(html, 'var eventPlacesData ='), place).filter((p) => notPlaceholder(p.placeName)),
    }
  },

  /**
   * Rooms and schedules for one movie on one calendar day (YYYY-MM-DD). The
   * date page embeds one placeDetail per venue actually playing that day.
   */
  sessions: async (city: string, slug: string, id: string, date: string): Promise<VeloxPlaceDetail[]> =>
    parseAll(
      await extractJson(await page(`${eventPath(city, slug, id)}/${date}`), 'var eventPlacesDetailData ='),
      placeDetail,
    ),

  /**
   * A venue's whole programme for one calendar day — every movie, room and
   * schedule in a single page fetch. `placeUrl` is the venue's portal path
   * (`/Portal/Local/Cinema/<city>/<placeNameNorm>/<placeCod>`), as `places()`
   * reports it.
   */
  venueDay: async (placeUrl: string, date: string) => {
    const html = await page(`${placeUrl}/${date}`)
    return {
      place: place.parse(await extractJson(html, 'var placeDetailData =')),
      movies: parseAll(await extractJson(html, 'var placeEventsDetailData ='), venueMovie),
    }
  },
}
