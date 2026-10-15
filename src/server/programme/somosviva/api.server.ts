// Somos Viva (Viva do Brasil) runs Recife's parks; Parque Apipucos's open-air
// cinema ("Cine Apipucos", the Espaço Pipoca) publishes its programme through
// the public calendar its site embeds (calendario.somosviva.com.br). That
// calendar's JSON endpoint has no location or date filter and inlines every
// poster as a base64 data URL (~28 MB for all parks), so this client pages
// through it 50 events at a time and keeps only the cinema fields it needs —
// the payload also carries staff names and other internal fields we never read.
import { z } from 'zod'

const BASE = 'https://calendario.somosviva.com.br/api/events'
const USER_AGENT = 'lanterninha/1.0 (+https://lanterninha.review)'
const PAGE = 50

const event = z.object({
  id: z.string(),
  title: z.string(),
  /** Local wall-clock time without an offset: "2026-10-15T19:00:00". */
  start: z.string(),
  end: z.string().nullish(),
  location: z.string().nullish(),
  categories: z.array(z.string()).nullish(),
  status: z.string().nullish(),
  description: z.string().nullish(),
  imageDataUrl: z.string().nullish(),
  cancelledAt: z.string().nullish(),
  deletedAt: z.string().nullish(),
})
export type SomosVivaEvent = z.infer<typeof event>

const page = z.object({
  events: z.array(z.unknown()),
  pagination: z.object({ has_more: z.boolean().nullish() }).nullish(),
})

/** Public cinema sessions at one park ("Apipucos"), all dates the calendar holds. */
export async function cinemaEvents(location: string): Promise<SomosVivaEvent[]> {
  const found: SomosVivaEvent[] = []
  for (let offset = 0; offset < 5_000; offset += PAGE) {
    const url = `${BASE}?limit=${PAGE}&offset=${offset}&status_filter=${encodeURIComponent('Público')}`
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) throw new Error(`Somos Viva ${res.status} at offset ${offset}`)
    const body = page.parse(await res.json())
    for (const raw of body.events) {
      // Lenient: a malformed record is skipped, not fatal.
      const parsed = event.safeParse(raw)
      if (!parsed.success) continue
      const e = parsed.data
      if (e.location !== location || !e.categories?.includes('Cinema')) continue
      if (e.cancelledAt || e.deletedAt) continue
      found.push(e)
    }
    if (!body.pagination?.has_more && body.events.length < PAGE) break
  }
  return found
}

/** "Duração:\n108 minutos" in the description, if present. */
export function durationMinutes(description: string | null | undefined) {
  const match = description?.match(/Dura[çc][ãa]o:\s*(\d{2,3})\s*min/i)
  return match ? Number(match[1]) : null
}

/** Decodes a base64 data URL into bytes and its media type. */
export function decodeDataUrl(dataUrl: string | null | undefined) {
  const match = dataUrl?.match(/^data:(image\/[a-z+.-]+);base64,(.+)$/i)
  if (!match) return null
  const binary = atob(match[2]!)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return { contentType: match[1]!.toLowerCase(), bytes }
}
