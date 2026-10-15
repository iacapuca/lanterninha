// Custom Worker entry: TanStack Start's request handler plus cron-triggered
// `scheduled` handlers that sync the providers' programmes into D1. Ingresso
// and Velox run on separate schedules, so one provider's slow or failing run
// never delays the other's.
import { createServerEntry, createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'
import { syncIngresso } from './server/programme/ingresso/sync.server'
import { syncVelox } from './server/programme/velox/sync.server'

const app = createServerEntry({ fetch: createStartHandler(defaultStreamHandler) })
const VELOX_CRON = '*/30 * * * *'

export default {
  fetch: app.fetch,
  // Awaited directly: scheduled handlers may run for minutes, while waitUntil work
  // can be cut off once the handler returns.
  async scheduled(event: ScheduledEvent) {
    if (event.cron === VELOX_CRON) await syncVelox()
    else await syncIngresso()
  },
}
