// Helpers shared by the provider syncs (Ingresso.com, Velox Tickets):
// accent-free text folding, ANCINE name matching, room-number extraction,
// room-detail hints from room/session names, D1 chunking and bounded concurrency.
import type { FactSource, Format, Projection, Sound } from '~/lib/domain'

/** Accents out, uppercase — the form ANCINE and the portals can be compared in. */
export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()

export const digits = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '')

const GENERIC = new Set(['CINE', 'CINEMA', 'CINEMAS', 'SHOPPING', 'SALA', 'SALAS', 'DE', 'DO', 'DA', 'THE', 'MALL', 'CENTER', 'PLAZA'])

/** The meaningful words of a name, folded: "Moviemax Rosa e Silva" → MOVEMAX, ROSA, SILVA. */
export const nameTokens = (s: string) => new Set(fold(s).split(/[^A-Z0-9]+/).filter((t) => t.length > 2 && !GENERIC.has(t)))

export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
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

export const FORMAT_HINTS: Array<[RegExp, Format]> = [
  [/IMAX/, 'imax'],
  [/4DX/, '4dx'],
  [/D-?BOX/, 'dbox'],
  [/MACRO|(?<![A-Z])XE(?![A-Z])/, 'macroxe'],
  [/(?<![A-Z])XD(?![A-Z])/, 'xd'],
  [/PRIME/, 'prime'],
  [/VIP|PREMIER|PLATINUM|DELUX|LOUNGE/, 'vip'],
]
export const formatHint = (text: string) => FORMAT_HINTS.find(([re]) => re.test(fold(text)))?.[1] ?? null
export const projectionHint = (text: string): Projection | null => (/LASER/.test(fold(text)) ? 'laser' : null)
export const soundHint = (text: string): Sound | null => (/ATMOS/.test(fold(text)) ? 'atmos' : null)

/** Portals know better than a guess from ANCINE's name, but never override the community. */
export const canWrite = (source: FactSource | null) => source == null || source === 'ancine'

/** D1 caps bound parameters per statement, so multi-row inserts are chunked. */
export function chunk<T>(rows: T[], size: number) {
  return Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, (i + 1) * size))
}

/**
 * Maps `items` through `run` with at most `limit` calls in flight, preserving
 * order. Keeps a sync quick without bursting a provider's site.
 */
export async function mapLimit<T, R>(items: readonly T[], limit: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = Array.from({ length: items.length })
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await run(items[i]!)
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker))
  return results
}

const DAY = 24 * 60 * 60 * 1000

/** The calendar day `offset` days from now in `tz`, as YYYY-MM-DD. */
export function localDay(tz: string, offset: number) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(Date.now() + offset * DAY))
}

/** The wall-clock "day + time" in `tz`, as a real Date. */
export function zonedTime(tz: string, day: string, time: string) {
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
