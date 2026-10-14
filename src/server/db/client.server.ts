import { env } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/d1'

// Bindings from `cloudflare:workers` are safe to read at module scope
// (unlike `process.env` on Workers). Same binding in dev (local D1) and prod.
export const db = drizzle(env.DB)
