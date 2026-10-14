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

export type Cinema = {
  id: string
  name: string
  chain: string
  city: string
  state: State
  neighborhood: string
  address: string
  lat: number
  lng: number
}

export type Room = {
  id: string
  cinemaId: string
  name: string
  format: Format
  seats: number
  projection: string
  sound: string
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
