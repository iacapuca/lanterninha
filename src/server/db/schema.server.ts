// D1 (SQLite) schema. Auth tables follow Better Auth's model (with the
// `username` plugin); TypeScript keys must keep Better Auth's field names.
import { sql } from 'drizzle-orm'
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import type { FactSource, Format, Projection, RoomFactField, Sound, State, Tag } from '~/lib/domain'

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
    /** ANCINE complex registration number; the key for re-imports. */
    ancineId: text('ancine_id').unique(),
    name: text('name').notNull(),
    chain: text('chain').notNull(),
    city: text('city').notNull(),
    state: text('state').$type<State>().notNull(),
    neighborhood: text('neighborhood').notNull(),
    address: text('address').notNull(),
    cep: text('cep'),
    /** CNPJ (digits only) from ANCINE; how Ingresso.com theaters are matched. */
    cnpj: text('cnpj'),
    website: text('website'),
    lat: real('lat'),
    lng: real('lng'),
    geoPrecision: text('geo_precision').$type<'address' | 'city'>(),
  },
  (t) => [index('cinema_city_idx').on(t.city), index('cinema_state_idx').on(t.state), index('cinema_cnpj_idx').on(t.cnpj)],
)

export const room = sqliteTable(
  'room',
  {
    id: text('id').primaryKey(),
    /** ANCINE room registration number; the key for re-imports. */
    ancineId: text('ancine_id').unique(),
    cinemaId: text('cinema_id')
      .notNull()
      .references(() => cinema.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    // Effective value plus where it came from; community values are recomputed on every vote.
    format: text('format').$type<Format>(),
    formatSource: text('format_source').$type<FactSource>(),
    projection: text('projection').$type<Projection>(),
    projectionSource: text('projection_source').$type<FactSource>(),
    sound: text('sound').$type<Sound>(),
    soundSource: text('sound_source').$type<FactSource>(),
    seats: integer('seats').notNull(),
    wheelchairSeats: integer('wheelchair_seats').notNull().default(0),
    reducedMobilitySeats: integer('reduced_mobility_seats').notNull().default(0),
    largeSeats: integer('large_seats').notNull().default(0),
    accessibleRestroom: integer('accessible_restroom', { mode: 'boolean' }).notNull().default(false),
    accessible: integer('accessible', { mode: 'boolean' }).notNull(),
    /** Lower-cased, accent-free text of room + cinema, for LIKE search (SQLite can't fold accents). */
    searchText: text('search_text').notNull(),
  },
  (t) => [index('room_cinema_id_idx').on(t.cinemaId), index('room_format_idx').on(t.format)],
)

/** One user's answer for one room detail (format, projection or sound). */
export const roomFact = sqliteTable(
  'room_fact',
  {
    id: text('id').primaryKey(),
    roomId: text('room_id')
      .notNull()
      .references(() => room.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    field: text('field').$type<RoomFactField>().notNull(),
    value: text('value').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [
    uniqueIndex('room_fact_one_vote_idx').on(t.userId, t.roomId, t.field),
    index('room_fact_room_field_idx').on(t.roomId, t.field),
  ],
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

// ---------- Ingresso.com programme (synced by the scheduled job) ----------

export const ingressoCity = sqliteTable('ingresso_city', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  state: text('state').$type<State>().notNull(),
  theatersSyncedAt: integer('theaters_synced_at', { mode: 'timestamp_ms' }),
})

/** An Ingresso.com theater, linked to the ANCINE cinema it corresponds to (if any). */
export const ingressoTheater = sqliteTable(
  'ingresso_theater',
  {
    id: text('id').primaryKey(),
    cityId: text('city_id').notNull(),
    cinemaId: text('cinema_id').references(() => cinema.id, { onDelete: 'set null' }),
    matchedBy: text('matched_by').$type<'cnpj' | 'location'>(),
    name: text('name').notNull(),
    cnpj: text('cnpj'),
    lat: real('lat'),
    lng: real('lng'),
    siteUrl: text('site_url'),
    sessionsSyncedAt: integer('sessions_synced_at', { mode: 'timestamp_ms' }),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('ingresso_theater_cinema_idx').on(t.cinemaId), index('ingresso_theater_synced_idx').on(t.sessionsSyncedAt)],
)

export const film = sqliteTable('film', {
  /** Ingresso.com event id (ANCINE film ids are often missing there). */
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  originalTitle: text('original_title'),
  ancineId: text('ancine_id'),
  durationMinutes: integer('duration_minutes'),
  contentRating: text('content_rating'),
  releaseYear: integer('release_year'),
  genres: text('genres', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
  posterUrl: text('poster_url'),
  siteUrl: text('site_url'),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

export const showtime = sqliteTable(
  'showtime',
  {
    /** Ingresso.com session id. */
    id: text('id').primaryKey(),
    theaterId: text('theater_id')
      .notNull()
      .references(() => ingressoTheater.id, { onDelete: 'cascade' }),
    cinemaId: text('cinema_id')
      .notNull()
      .references(() => cinema.id, { onDelete: 'cascade' }),
    roomId: text('room_id').references(() => room.id, { onDelete: 'set null' }),
    filmId: text('film_id')
      .notNull()
      .references(() => film.id, { onDelete: 'cascade' }),
    startsAt: integer('starts_at', { mode: 'timestamp_ms' }).notNull(),
    /** The cinema's own calendar day and clock time ("2026-10-14", "22:15"), as Ingresso gives them. */
    localDay: text('local_day').notNull().default(''),
    localTime: text('local_time').notNull().default(''),
    roomName: text('room_name').notNull(),
    /** Session type aliases as Ingresso shows them: "2D", "DUB", "LEG", "XD", "IMAX"… */
    types: text('types', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
    price: real('price'),
    checkoutUrl: text('checkout_url'),
  },
  (t) => [
    index('showtime_room_starts_idx').on(t.roomId, t.startsAt),
    index('showtime_cinema_starts_idx').on(t.cinemaId, t.startsAt),
    index('showtime_starts_idx').on(t.startsAt),
    index('showtime_theater_starts_idx').on(t.theaterId, t.startsAt),
  ],
)
