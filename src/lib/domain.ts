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
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA',
  'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
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

/** Room details the community can fill in, with the options and pt-BR copy for each. */
export const ROOM_FACTS = {
  format: { label: 'Tipo de tela', cta: 'Adicione o tipo de tela', options: FORMATS },
  projection: { label: 'Projeção', cta: 'Adicione a projeção', options: PROJECTIONS },
  sound: { label: 'Som', cta: 'Adicione o som', options: SOUNDS },
} as const
export type RoomFactField = keyof typeof ROOM_FACTS
export const ROOM_FACT_FIELDS = Object.keys(ROOM_FACTS) as RoomFactField[]

/**
 * Where a room detail came from, weakest to strongest: guessed from ANCINE's
 * room name, seen in a ticketing portal's sessions/room names, or voted by the
 * community.
 */
export type FactSource = 'ancine' | 'ingresso' | 'velox' | 'community'

/** The ticketing portals Lanterninha syncs showtimes from. */
export type Provider = 'ingresso' | 'velox'

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
  film: string | null
  body: string
  tags: Tag[]
  createdAt: string // ISO
}

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

/** Each badge is a goal on one contribution counter, so locked badges can show progress. */
export const BADGES = [
  { id: 'first-review', emoji: '🍿', name: 'Primeira sessão', hint: 'Avalie sua primeira sala', metric: 'reviews', goal: 1 },
  { id: 'regular', emoji: '🔦', name: 'Lanterninha de plantão', hint: 'Avalie 10 salas', metric: 'reviews', goal: 10 },
  { id: 'traveler', emoji: '🧭', name: 'Cinéfilo viajante', hint: 'Avalie salas em 3 cidades', metric: 'cities', goal: 3 },
  { id: 'screen-spotter', emoji: '🖼️', name: 'Olho de tela', hint: 'Informe o tipo de tela de uma sala', metric: 'format', goal: 1 },
  { id: 'screen-inspector', emoji: '📐', name: 'Fiscal de tela', hint: 'Informe o tipo de tela de 10 salas', metric: 'format', goal: 10 },
  { id: 'projectionist', emoji: '📽️', name: 'Projecionista', hint: 'Informe a projeção de 5 salas', metric: 'projection', goal: 5 },
  { id: 'sharp-ears', emoji: '🎧', name: 'Ouvido apurado', hint: 'Informe o som de 5 salas', metric: 'sound', goal: 5 },
  { id: 'trailblazer', emoji: '🚩', name: 'Abre-alas', hint: 'Seja a primeira pessoa a informar um detalhe de uma sala', metric: 'firstAnswers', goal: 1 },
] as const satisfies ReadonlyArray<{ metric: keyof ContributionStats; goal: number } & Record<'id' | 'emoji' | 'name' | 'hint', string>>
export type BadgeId = (typeof BADGES)[number]['id']

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
