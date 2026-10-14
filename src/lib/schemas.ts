// Shared validation schemas: used by route `validateSearch` (client + server)
// and by server function `.validator()` (enforced at the server boundary).
// Error messages are pt-BR because they are shown to users.
import { z } from 'zod'
import { FORMAT_IDS, PROJECTIONS, RATINGS, SOUNDS, STATES, TAGS } from './domain'

export const SORTS = ['rating', 'reviews', 'recent', 'name'] as const

// Search params arrive JSON-parsed (`?q=2001` becomes the number 2001), and
// plain `<form method="get">` submissions send empty strings. Normalise both.
const emptyToUndefined = (v: unknown) => (v == null || v === '' ? undefined : v)
const searchText = (max: number) =>
  z.preprocess(
    (v) => (emptyToUndefined(v) === undefined ? undefined : String(v)),
    z.string().trim().max(max).optional(),
  )

export const exploreSearchSchema = z.object({
  q: searchText(80).catch(undefined),
  state: z.preprocess(emptyToUndefined, z.enum(STATES).optional()).catch(undefined),
  city: searchText(60).catch(undefined),
  format: z.preprocess(emptyToUndefined, z.enum(FORMAT_IDS).optional()).catch(undefined),
  sort: z.enum(SORTS).default('rating').catch('rating'),
  page: z.coerce.number().int().min(1).max(500).default(1).catch(1),
})
export type ExploreSearch = z.infer<typeof exploreSearchSchema>
/** Defaults are omitted from URLs so canonical links stay clean. */
export const EXPLORE_DEFAULTS = { sort: 'rating', page: 1 } as const

export const REVIEW_SORTS = ['recent', 'best', 'worst'] as const
export const roomSearchSchema = z.object({
  reviews: z.enum(REVIEW_SORTS).default('recent').catch('recent'),
})
export const ROOM_SEARCH_DEFAULTS = { reviews: 'recent' } as const

export const USERNAME_PATTERN = /^[a-z0-9_]+$/

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Use pelo menos 3 caracteres')
  .max(24, 'Use no máximo 24 caracteres')
  .regex(USERNAME_PATTERN, 'Apenas letras minúsculas, números e _')

export const signUpSchema = z.object({
  username: usernameSchema,
  email: z.email('E-mail inválido').trim().toLowerCase(),
  password: z.string().min(8, 'A senha precisa de pelo menos 8 caracteres').max(128),
})

export const signInSchema = z.object({
  /** Username or email. */
  login: z.string().trim().toLowerCase().min(3, 'Informe seu usuário ou e-mail'),
  password: z.string().min(1, 'Informe sua senha'),
})

const score = z.coerce.number().int().min(1, 'Dê uma nota de 1 a 5').max(5)

export const newReviewSchema = z.object({
  roomId: z.string().min(1).max(80),
  rating: z.coerce
    .number()
    .refine((n) => (RATINGS as readonly number[]).includes(n), 'Escolha de meia a cinco lanternas'),
  criteria: z.object({
    picture: score,
    sound: score,
    comfort: score,
    cleanliness: score,
  }),
  row: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{1,2}$/, 'A fileira é uma ou duas letras')
      .nullable()
      .default(null),
  ),
  film: z.preprocess(emptyToUndefined, z.string().trim().max(120).nullable().default(null)),
  body: z.string().trim().min(10, 'Conte um pouco mais (mín. 10 caracteres)').max(2000),
  tags: z.array(z.enum(TAGS)).max(5, 'No máximo 5 etiquetas').default([]),
})
export type NewReview = z.infer<typeof newReviewSchema>
export type NewReviewInput = z.input<typeof newReviewSchema>

/** A vote for one room detail; the value must be one of that field's options. */
export const roomFactVoteSchema = z.discriminatedUnion('field', [
  z.object({ roomId: z.string().min(1).max(120), field: z.literal('format'), value: z.enum(FORMAT_IDS) }),
  z.object({
    roomId: z.string().min(1).max(120),
    field: z.literal('projection'),
    value: z.enum(Object.keys(PROJECTIONS) as [keyof typeof PROJECTIONS, ...Array<keyof typeof PROJECTIONS>]),
  }),
  z.object({
    roomId: z.string().min(1).max(120),
    field: z.literal('sound'),
    value: z.enum(Object.keys(SOUNDS) as [keyof typeof SOUNDS, ...Array<keyof typeof SOUNDS>]),
  }),
])
