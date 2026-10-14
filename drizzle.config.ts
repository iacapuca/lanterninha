import { defineConfig } from 'drizzle-kit'

// Generates SQL migrations only; they are applied with `wrangler d1 migrations apply`.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/server/db/schema.server.ts',
  out: './drizzle',
})
