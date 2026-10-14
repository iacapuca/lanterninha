import { env } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/d1'
import { relations } from './relations.server'

// Bindings from `cloudflare:workers` are safe to read at module scope
// (unlike `process.env` on Workers). Same binding in dev (local D1) and prod.
// `relations` enables the relational query API (`db.query.*`).
export const db = drizzle(env.DB, { relations })
