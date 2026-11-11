// Product events in Workers Analytics Engine (the `ANALYTICS` binding, dataset
// `lanterninha_events`). Written from the server, so ad blockers can't drop
// them, and cookieless: no user ids, IPs or emails, only what happened and
// where. Page views come from Cloudflare Web Analytics instead.
import { env } from 'cloudflare:workers'

/**
 * Each event's fields, in blob order: blob1 is always the event name, blob2…
 * follow this list. Querying: `SELECT blob2 AS provider, count() FROM
 * lanterninha_events WHERE blob1 = 'checkout_click' GROUP BY provider`.
 * Append new fields at the end so old rows keep their meaning.
 */
const EVENTS = {
  signup: [],
  email_confirmed: [],
  review_draft_started: ['roomId'],
  review_created: ['roomId', 'cinemaId', 'city', 'state'],
  fact_voted: ['roomId', 'field', 'value'],
  checkout_click: ['provider', 'cinemaId', 'roomId', 'filmId', 'city', 'state'],
  search_empty: ['q', 'city', 'state', 'format'],
  review_marked_helpful: ['reviewId'],
  user_followed: [],
  photo_uploaded: ['roomId'],
  photo_reported: [],
} as const satisfies Record<string, readonly string[]>

export type AnalyticsEvent = keyof typeof EVENTS
type Fields<E extends AnalyticsEvent> = Record<(typeof EVENTS)[E][number], string | null | undefined>

/** Fire and forget: analytics never fails or slows down the request it describes. */
export function track<E extends AnalyticsEvent>(
  event: E,
  ...[fields]: (typeof EVENTS)[E] extends readonly [] ? [] : [Fields<E>]
) {
  try {
    const values = fields as Record<string, string | null | undefined> | undefined
    env.ANALYTICS?.writeDataPoint({
      indexes: [event],
      blobs: [event, ...EVENTS[event].map((key: string) => values?.[key] ?? '')],
    })
  } catch (error) {
    console.error('analytics write failed', error)
  }
}
