import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Unit tests run in Node, without the Cloudflare plugin: they cover pure logic
// (parsers, matching, time zones, schemas). `cloudflare:workers` is stubbed so
// modules that read `env` can still be imported.
export default defineConfig({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./src', import.meta.url)),
      'cloudflare:workers': fileURLToPath(new URL('./test/stubs/cloudflare-workers.ts', import.meta.url)),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    restoreMocks: true,
    unstubGlobals: true,
  },
})
