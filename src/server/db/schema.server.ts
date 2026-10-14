// D1 (SQLite) schema. Auth tables follow Better Auth's model (with the
// `username` plugin); TypeScript keys must keep Better Auth's field names.
import { sql } from 'drizzle-orm'
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import type { Format, State, Tag } from '~/lib/domain'

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`)
    .$onUpdate(() => new Date()),
}

// ---------- Better Auth ----------

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  username: text('username').unique(),
  displayUsername: text('display_username'),
  ...timestamps,
})

export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    token: text('token').notNull().unique(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [index('session_user_id_idx').on(t.userId)],
)

export const account = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
    scope: text('scope'),
    password: text('password'),
    ...timestamps,
  },
  (t) => [index('account_user_id_idx').on(t.userId)],
)

export const verification = sqliteTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    ...timestamps,
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
)

// ---------- Lanterninha ----------

export const cinema = sqliteTable(
  'cinema',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    chain: text('chain').notNull(),
    city: text('city').notNull(),
    state: text('state').$type<State>().notNull(),
    neighborhood: text('neighborhood').notNull(),
    address: text('address').notNull(),
    lat: real('lat').notNull(),
    lng: real('lng').notNull(),
  },
  (t) => [index('cinema_city_idx').on(t.city), index('cinema_state_idx').on(t.state)],
)

export const room = sqliteTable(
  'room',
  {
    id: text('id').primaryKey(),
    cinemaId: text('cinema_id')
      .notNull()
      .references(() => cinema.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    format: text('format').$type<Format>().notNull(),
    seats: integer('seats').notNull(),
    projection: text('projection').notNull(),
    sound: text('sound').notNull(),
    accessible: integer('accessible', { mode: 'boolean' }).notNull(),
    /** Lower-cased, accent-free text of room + cinema, for LIKE search (SQLite can't fold accents). */
    searchText: text('search_text').notNull(),
  },
  (t) => [index('room_cinema_id_idx').on(t.cinemaId), index('room_format_idx').on(t.format)],
)

export const review = sqliteTable(
  'review',
  {
    id: text('id').primaryKey(),
    roomId: text('room_id')
      .notNull()
      .references(() => room.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    rating: real('rating').notNull(),
    picture: integer('picture').notNull(),
    sound: integer('sound').notNull(),
    comfort: integer('comfort').notNull(),
    cleanliness: integer('cleanliness').notNull(),
    row: text('row'),
    film: text('film'),
    body: text('body').notNull(),
    tags: text('tags', { mode: 'json' }).$type<Tag[]>().notNull().default(sql`'[]'`),
    /** São Paulo calendar day (YYYY-MM-DD), used for the one-review-per-room-per-day rule. */
    day: text('day').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [
    index('review_room_created_idx').on(t.roomId, t.createdAt),
    index('review_user_created_idx').on(t.userId, t.createdAt),
    index('review_created_idx').on(t.createdAt),
    uniqueIndex('review_one_per_day_idx').on(t.userId, t.roomId, t.day),
  ],
)
