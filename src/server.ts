// Custom Worker entry: TanStack Start's request handler plus cron-triggered
// `scheduled` handlers that sync the providers' programmes into D1. Ingresso
// and Velox run on separate schedules, so one provider's slow or failing run
// never delays the other's.
import { createServerEntry, createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'
import { syncIngresso } from './server/programme/ingresso/sync.server'
import { syncSomosViva } from './server/programme/somosviva/sync.server'
import { syncVelox } from './server/programme/velox/sync.server'

const app = createServerEntry({ fetch: createStartHandler(defaultStreamHandler) })
const VELOX_CRON = '*/30 * * * *'
const CANONICAL_HOST = 'lanterninha.review'

export default {
  // One public address: the old workers.dev URL and www redirect, keeping path and query.
  fetch(request: Request) {
    const url = new URL(request.url)
    if (url.hostname === `www.${CANONICAL_HOST}` || url.hostname.endsWith('.workers.dev')) {
      url.protocol = 'https:'
      url.hostname = CANONICAL_HOST
      url.port = ''
      return Response.redirect(url.toString(), 301)
    }
    return app.fetch(request)
  },
  // Awaited directly: scheduled handlers may run for minutes, while waitUntil work
  // can be cut off once the handler returns.
  async scheduled(event: ScheduledEvent) {
    if (event.cron === VELOX_CRON) {
      await syncVelox()
      // Self-throttled to every 6 h; shares the */30 trigger rather than adding a cron.
      await syncSomosViva()
    }
    else await syncIngresso()
  },
}
