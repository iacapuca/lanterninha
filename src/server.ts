// Custom Worker entry: TanStack Start's request handler plus a cron-triggered
// `scheduled` handler that syncs the Ingresso.com programme into D1.
import { createServerEntry, createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'
import { syncIngresso } from './server/ingresso/sync.server'

const app = createServerEntry({ fetch: createStartHandler(defaultStreamHandler) })

export default {
  fetch: app.fetch,
  // Awaited directly: scheduled handlers may run for minutes, while waitUntil work
  // can be cut off once the handler returns.
  async scheduled() {
    await syncIngresso()
  },
}
