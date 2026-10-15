// Ingresso.com content API (https://api-content.ingresso.com/swagger). Only
// the fields Lanterninha uses are parsed; schemas are lenient so a new or
// missing field upstream skips a record instead of breaking the sync.
import { env } from 'cloudflare:workers'
import { z } from 'zod'

const BASE = 'https://api-content.ingresso.com/v0'
const USER_AGENT = 'lanterninha/1.0 (+https://lanterninha.review)'

// Ingresso's CDN is Akamai, which answers 403 to production Worker egress —
// while the same calls pass from a home connection and even from `wrangler dev
// --remote` previews. The workaround is to relay /v0/* through any host outside
// Cloudflare (a one-file Deno Deploy or Fly.io service does); point
// INGRESSO_PROXY_URL at it to route every call through the relay.
const base = () => (env.INGRESSO_PROXY_URL || BASE).replace(/\/+$/, '')

const partnership = () => env.INGRESSO_PARTNERSHIP || 'lanterninha'

async function get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    // A hung upstream call must not eat the whole cron run.
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`Ingresso ${res.status} for ${path}`)
  // 204 No Content: the theater/day simply has nothing to sell (common late
  // at night) — the API's equivalent of its `null` response, not an error.
  if (res.status === 204) return schema.parse(null)
  return schema.parse(await res.json())
}

const city = z.object({ id: z.string(), name: z.string(), uf: z.string() })
const states = z.array(z.object({ uf: z.string(), cities: z.array(city) }))

const theater = z.object({
  id: z.string(),
  name: z.string(),
  cityId: z.coerce.string(),
  cnpj: z.string().nullish(),
  enabled: z.boolean().optional(),
  siteURL: z.string().nullish(),
  geolocation: z.object({ lat: z.number(), lng: z.number() }).nullish(),
  rooms: z.array(z.object({ id: z.coerce.string(), name: z.string() })).default([]),
})
export type IngressoTheater = z.infer<typeof theater>

const session = z.object({
  id: z.coerce.string(),
  room: z.string().nullish(),
  price: z.number().nullish(),
  siteURL: z.string().nullish(),
  realDate: z.object({ localDate: z.string() }).optional(),
  date: z.object({ localDate: z.string() }).optional(),
  types: z.array(z.object({ name: z.string(), alias: z.string().nullish() })).default([]),
})
export type IngressoSession = z.infer<typeof session>

const movie = z.object({
  id: z.coerce.string(),
  title: z.string(),
  originalTitle: z.string().nullish(),
  ancineId: z.string().nullish(),
  duration: z.coerce.number().nullish(),
  contentRating: z.string().nullish(),
  releaseYear: z.coerce.number().nullish(),
  genres: z.array(z.string()).default([]),
  siteURL: z.string().nullish(),
  images: z.array(z.object({ url: z.string(), type: z.string().nullish() })).default([]),
  rooms: z.array(z.object({ name: z.string().nullish(), sessions: z.array(session).default([]) })).default([]),
})
export type IngressoMovie = z.infer<typeof movie>

const sessionDays = z.array(z.object({ date: z.string(), movies: z.array(movie).default([]) }))

export const ingresso = {
  cities: async () => (await get('/states', states)).flatMap((s) => s.cities),

  theatersInCity: async (cityId: string) => {
    const body = await get(`/theaters/city/${cityId}/partnership/${partnership()}`, z.object({ items: z.array(z.unknown()) }))
    // Parse one by one so a single malformed theater doesn't drop the whole city.
    return body.items.flatMap((item) => {
      const parsed = theater.safeParse(item)
      return parsed.success && parsed.data.enabled !== false ? [parsed.data] : []
    })
  },

  /** Sessions grouped by movie for one theater and one day (YYYY-MM-DD). */
  sessions: async (cityId: string, theaterId: string, date: string) => {
    const days = await get(
      `/sessions/city/${cityId}/theater/${theaterId}/partnership/${partnership()}?date=${date}`,
      z.union([sessionDays, z.null()]),
    )
    return (days ?? []).flatMap((d) => d.movies)
  },
}
