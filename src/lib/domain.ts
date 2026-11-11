// Shared, client-safe domain vocabulary. No server imports here.
// Identifiers are English; the label maps hold the pt-BR copy shown in the UI.

export const FORMATS = {
  standard: 'Padrão',
  imax: 'IMAX',
  xd: 'Cinemark XD',
  macroxe: 'Macro XE',
  '4dx': '4DX',
  dbox: 'D-BOX',
  vip: 'VIP',
  prime: 'Prime',
  street: 'Cinema de rua',
} as const
export type Format = keyof typeof FORMATS
export const FORMAT_IDS = Object.keys(FORMATS) as [Format, ...Format[]]

export const STATES = [
  'AC',
  'AL',
  'AM',
  'AP',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MG',
  'MS',
  'MT',
  'PA',
  'PB',
  'PE',
  'PI',
  'PR',
  'RJ',
  'RN',
  'RO',
  'RR',
  'RS',
  'SC',
  'SE',
  'SP',
  'TO',
] as const
export type State = (typeof STATES)[number]

/** The four things people actually argue about after a screening. */
export const CRITERIA = {
  picture: 'Imagem',
  sound: 'Som',
  comfort: 'Poltrona',
  cleanliness: 'Limpeza',
} as const
export type Criterion = keyof typeof CRITERIA
export const CRITERION_IDS = Object.keys(CRITERIA) as Criterion[]

/** Crowd-sourced tags. The values are pt-BR because they are user-facing. */
export const TAGS = [
  'poltrona reclinável',
  'ar-condicionado no polo norte',
  'tela gigante',
  'som de show',
  'pipoca cara',
  'lugar marcado que ninguém respeita',
  'trailer infinito',
  'acessível',
  'estacionamento fácil',
  'perto do metrô',
  'público silencioso',
  'celular aceso na fileira da frente',
  'meia-entrada sem drama',
  'sessão legendada',
] as const
export type Tag = (typeof TAGS)[number]

export const PROJECTIONS = {
  'digital-2k': 'Digital 2K',
  'digital-4k': 'Digital 4K',
  laser: 'Laser',
  'laser-4k': 'Laser 4K',
  '35mm': 'Película 35mm',
  '70mm': 'Película 70mm',
} as const
export type Projection = keyof typeof PROJECTIONS

export const SOUNDS = {
  '5.1': '5.1',
  '7.1': '7.1',
  atmos: 'Dolby Atmos',
  'dts-x': 'DTS:X',
  imax: 'IMAX',
} as const
export type Sound = keyof typeof SOUNDS

/** Which IMAX a room really has; "IMAX" on a ticket covers very different screens. */
export const IMAX_TYPES = {
  'laser-gt': 'IMAX Laser GT (tela 1.43:1)',
  laser: 'IMAX com Laser',
  digital: 'IMAX Digital (xenônio)',
  '70mm': 'IMAX 70mm (película)',
} as const
export type ImaxType = keyof typeof IMAX_TYPES

/** Screen width in ranges: few people know the exact size, most can guess the range. */
export const SCREEN_SIZES = {
  'under-10': 'Menos de 10 m',
  '10-15': 'De 10 a 15 m',
  '15-20': 'De 15 a 20 m',
  'over-20': 'Mais de 20 m',
} as const
export type ScreenSize = keyof typeof SCREEN_SIZES

export const THREE_D = { yes: 'Exibe 3D', no: 'Não exibe 3D' } as const
export type ThreeD = keyof typeof THREE_D

export const SEAT_TYPES = {
  standard: 'Comum',
  reclining: 'Reclinável',
  motion: 'Com movimento (D-BOX, 4DX)',
} as const
export type SeatType = keyof typeof SEAT_TYPES

/**
 * Room details the community can fill in, with the options and pt-BR copy for
 * each. `onlyFor` limits a detail to rooms of one format.
 */
export const ROOM_FACTS = {
  format: { label: 'Tipo de tela', cta: 'Adicione o tipo de tela', options: FORMATS },
  imaxType: { label: 'Qual IMAX', cta: 'Diga qual IMAX é', options: IMAX_TYPES, onlyFor: 'imax' },
  screenSize: { label: 'Largura da tela', cta: 'Adicione a largura da tela', options: SCREEN_SIZES },
  projection: { label: 'Projeção', cta: 'Adicione a projeção', options: PROJECTIONS },
  sound: { label: 'Som', cta: 'Adicione o som', options: SOUNDS },
  threeD: { label: '3D', cta: 'Diga se exibe 3D', options: THREE_D },
  seatType: { label: 'Poltronas', cta: 'Adicione o tipo de poltrona', options: SEAT_TYPES },
} as const satisfies Record<string, { label: string; cta: string; options: Record<string, string>; onlyFor?: Format }>
export type RoomFactField = keyof typeof ROOM_FACTS
export const ROOM_FACT_FIELDS = Object.keys(ROOM_FACTS) as RoomFactField[]

/** The details that apply to a room: all of them, minus the ones for other formats. */
export function factFieldsFor(format: Format | null) {
  return ROOM_FACT_FIELDS.filter((field) => {
    const onlyFor = (ROOM_FACTS[field] as { onlyFor?: Format }).onlyFor
    return !onlyFor || onlyFor === format
  })
}

/**
 * Where a room detail came from, weakest to strongest: guessed from ANCINE's
 * room name, seen in a ticketing portal's sessions/room names, or voted by the
 * community.
 */
export type FactSource = 'ancine' | 'ingresso' | 'velox' | 'community'

/** The ticketing portals Lanterninha syncs showtimes from. */
export type Provider = 'ingresso' | 'velox' | 'somosviva' | 'fundarpe'

export type Cinema = {
  id: string
  ancineId: string | null
  name: string
  chain: string
  city: string
  state: State
  neighborhood: string
  address: string
  cep: string | null
  cnpj: string | null
  website: string | null
  lat: number | null
  lng: number | null
  /** 'address' = geocoded street address; 'city' = municipality centroid (approximate). */
  geoPrecision: 'address' | 'city' | null
}

export type Room = {
  id: string
  ancineId: string | null
  cinemaId: string
  name: string
  format: Format | null
  formatSource: FactSource | null
  projection: Projection | null
  projectionSource: FactSource | null
  sound: Sound | null
  soundSource: FactSource | null
  imaxType: ImaxType | null
  imaxTypeSource: FactSource | null
  screenSize: ScreenSize | null
  screenSizeSource: FactSource | null
  threeD: ThreeD | null
  threeDSource: FactSource | null
  seatType: SeatType | null
  seatTypeSource: FactSource | null
  seats: number
  wheelchairSeats: number
  reducedMobilitySeats: number
  largeSeats: number
  accessibleRestroom: boolean
  accessible: boolean
}

export type Review = {
  id: string
  roomId: string
  username: string
  rating: number // 0.5 – 5, half steps
  criteria: Record<Criterion, number> // 1 – 5
  row: string | null
  seatPosition: SeatPosition | null
  film: string | null
  /** Set when the film came from the TMDB autocomplete. */
  filmTmdbId: number | null
  body: string
  tags: Tag[]
  createdAt: string // ISO
  /** How many readers marked it "útil". */
  helpful: number
  /** Whether the signed-in viewer is one of them. */
  markedHelpful: boolean
  /** The view from the reviewer's seat, if they added one (and it isn't hidden). */
  photo: SeatPhoto | null
}

/** Where in the row the reviewer sat, for "Fileira H · centro". */
export const SEAT_POSITIONS = { left: 'esquerda', center: 'centro', right: 'direita' } as const
export type SeatPosition = keyof typeof SEAT_POSITIONS
export const SEAT_POSITION_IDS = Object.keys(SEAT_POSITIONS) as [SeatPosition, ...SeatPosition[]]

/** 'reported' photos are hidden from everyone but moderators. */
export type PhotoStatus = 'visible' | 'reported'

export type SeatPhoto = {
  id: string
  width: number
  height: number
}

/** Served by the /photos/$photoId route from R2. */
export const photoUrl = (id: string) => `/photos/${id}`

/** Sort key for rows, lettered from the screen back: A … Z, then AA, AB…; no row sorts last. */
export function rowOrder(row: string | null) {
  if (!row) return Number.MAX_SAFE_INTEGER
  return [...row.toUpperCase()].reduce((n, c) => n * 26 + (c.charCodeAt(0) - 64), 0)
}

/** Photo upload limits; the browser shrinks photos to fit before sending them. */
export const PHOTO_MAX_SIDE = 1600
export const PHOTO_MAX_BYTES = 3 * 1024 * 1024
export const PHOTO_TYPES = ['image/webp', 'image/jpeg'] as const

export type RoomSummary = Room & {
  cinema: Cinema
  average: number | null
  reviewCount: number
}

export type CinemaSummary = Cinema & {
  roomCount: number
  seats: number
  /** Special formats among its rooms (IMAX, 4DX, VIP…). */
  formats: Format[]
  average: number | null
  reviewCount: number
  /** Has synced sessions from today on. */
  showing: boolean
}

export type RoomStats = {
  histogram: Record<string, number> // "0.5" … "5" → count
  criteriaAverages: Record<Criterion, number | null>
  bestRow: string | null
  topTags: Array<{ tag: Tag; count: number }>
}

export type ReviewWithRoom = Review & {
  room: Pick<Room, 'id' | 'name' | 'format'>
  cinema: Pick<Cinema, 'id' | 'name' | 'city' | 'state'>
}

export type Viewer = { username: string } | null

export const RATINGS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const

/** What a user has done, counted on the server; badges are derived from it (no stored state). */
export type ContributionStats = {
  reviews: number
  cities: number
  format: number
  projection: number
  sound: number
  /** Room details where this user's answer was the first one anyone gave. */
  firstAnswers: number
}

/**
 * Each badge is a goal on one contribution counter, so locked badges can show
 * progress. Artwork: /badges/<id>.png (rubber stamps drawn with Workers AI by
 * db/badges/generate.ts; names stay in HTML).
 */
export const BADGES = [
  { id: 'first-review', name: 'Primeira sessão', hint: 'Avalie sua primeira sala', metric: 'reviews', goal: 1 },
  { id: 'regular', name: 'Lanterninha de plantão', hint: 'Avalie 10 salas', metric: 'reviews', goal: 10 },
  { id: 'traveler', name: 'Cinéfilo viajante', hint: 'Avalie salas em 3 cidades', metric: 'cities', goal: 3 },
  { id: 'screen-spotter', name: 'Olho de tela', hint: 'Informe o tipo de tela de uma sala', metric: 'format', goal: 1 },
  {
    id: 'screen-inspector',
    name: 'Fiscal de tela',
    hint: 'Informe o tipo de tela de 10 salas',
    metric: 'format',
    goal: 10,
  },
  { id: 'projectionist', name: 'Projecionista', hint: 'Informe a projeção de 5 salas', metric: 'projection', goal: 5 },
  { id: 'sharp-ears', name: 'Ouvido apurado', hint: 'Informe o som de 5 salas', metric: 'sound', goal: 5 },
  {
    id: 'trailblazer',
    name: 'Abre-alas',
    hint: 'Seja a primeira pessoa a informar um detalhe de uma sala',
    metric: 'firstAnswers',
    goal: 1,
  },
] as const satisfies ReadonlyArray<
  { metric: keyof ContributionStats; goal: number } & Record<'id' | 'name' | 'hint', string>
>
export type BadgeId = (typeof BADGES)[number]['id']

export const badgeImage = (id: BadgeId) => `/badges/${id}.png`

export function earnedBadges(stats: ContributionStats): BadgeId[] {
  return BADGES.filter((b) => stats[b.metric] >= b.goal).map((b) => b.id)
}

/** Brazil's time zones by state (Fernando de Noronha and western Amazonas aside). */
export function timeZoneOf(state: State) {
  if (state === 'AC') return 'America/Rio_Branco'
  if (state === 'AM' || state === 'RR' || state === 'RO') return 'America/Manaus'
  if (state === 'MT' || state === 'MS') return 'America/Cuiaba'
  return 'America/Sao_Paulo'
}

/** URL slug for a city, with its state so namesakes don't collide: "São Paulo", "SP" → "sao-paulo-sp". */
export function citySlug(city: string, state: State) {
  const name = city
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${name}-${state.toLowerCase()}`
}

/** The whole country, in /melhores-salas/<place> URLs. */
export const NATIONAL_SLUG = 'brasil'
