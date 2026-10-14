// Demo seed data. Venues are real Brazilian cinemas (addresses and coordinates
// are approximate); every review and username is fictional and generated.
import type { Cinema, Criterion, Review, Room, Tag } from '../src/lib/domain.ts'
import { TAGS } from '../src/lib/domain.ts'

export const CINEMAS: Cinema[] = [
  { id: 'cinemark-eldorado', name: 'Cinemark Eldorado', chain: 'Cinemark', city: 'São Paulo', state: 'SP', neighborhood: 'Pinheiros', address: 'Av. Rebouças, 3970', lat: -23.5726, lng: -46.696 },
  { id: 'cinepolis-jk-iguatemi', name: 'Cinépolis JK Iguatemi', chain: 'Cinépolis', city: 'São Paulo', state: 'SP', neighborhood: 'Vila Olímpia', address: 'Av. Pres. Juscelino Kubitschek, 2041', lat: -23.5857, lng: -46.6829 },
  { id: 'uci-analia-franco', name: 'UCI Anália Franco', chain: 'UCI', city: 'São Paulo', state: 'SP', neighborhood: 'Tatuapé', address: 'Av. Regente Feijó, 1739', lat: -23.5617, lng: -46.5604 },
  { id: 'espaco-itau-augusta', name: 'Espaço Itaú de Cinema Augusta', chain: 'Espaço Itaú', city: 'São Paulo', state: 'SP', neighborhood: 'Consolação', address: 'Rua Augusta, 1475', lat: -23.556, lng: -46.658 },
  { id: 'petra-belas-artes', name: 'Petra Belas Artes', chain: 'Independente', city: 'São Paulo', state: 'SP', neighborhood: 'Consolação', address: 'Rua da Consolação, 2423', lat: -23.5559, lng: -46.6624 },
  { id: 'cinesesc', name: 'CineSesc', chain: 'Sesc', city: 'São Paulo', state: 'SP', neighborhood: 'Cerqueira César', address: 'Rua Augusta, 2075', lat: -23.5617, lng: -46.6633 },
  { id: 'estacao-net-botafogo', name: 'Estação NET Botafogo', chain: 'Grupo Estação', city: 'Rio de Janeiro', state: 'RJ', neighborhood: 'Botafogo', address: 'Rua Voluntários da Pátria, 88', lat: -22.9512, lng: -43.1847 },
  { id: 'cine-odeon', name: 'Cine Odeon', chain: 'Independente', city: 'Rio de Janeiro', state: 'RJ', neighborhood: 'Centro', address: 'Praça Floriano, 7 — Cinelândia', lat: -22.9105, lng: -43.1756 },
  { id: 'uci-new-york-city-center', name: 'UCI New York City Center', chain: 'UCI', city: 'Rio de Janeiro', state: 'RJ', neighborhood: 'Barra da Tijuca', address: 'Av. das Américas, 5000', lat: -23.0006, lng: -43.3654 },
  { id: 'cine-belas-artes-bh', name: 'Cine Belas Artes', chain: 'Independente', city: 'Belo Horizonte', state: 'MG', neighborhood: 'Lourdes', address: 'Rua Gonçalves Dias, 1581', lat: -19.9339, lng: -43.9394 },
  { id: 'cine-brasilia', name: 'Cine Brasília', chain: 'Público', city: 'Brasília', state: 'DF', neighborhood: 'Asa Sul', address: 'EQS 106/107', lat: -15.811, lng: -47.8912 },
  { id: 'cinema-sao-luiz', name: 'Cinema São Luiz', chain: 'Público', city: 'Recife', state: 'PE', neighborhood: 'Boa Vista', address: 'Rua da Aurora, 175', lat: -8.0605, lng: -34.8812 },
  { id: 'cinemateca-capitolio', name: 'Cinemateca Capitólio', chain: 'Público', city: 'Porto Alegre', state: 'RS', neighborhood: 'Centro Histórico', address: 'Rua Demétrio Ribeiro, 1085', lat: -30.0313, lng: -51.2272 },
  { id: 'cine-passeio', name: 'Cine Passeio', chain: 'Público', city: 'Curitiba', state: 'PR', neighborhood: 'Centro', address: 'Rua Riachuelo, 410', lat: -25.4264, lng: -49.2706 },
  { id: 'uci-orient-shopping-da-bahia', name: 'UCI Orient Shopping da Bahia', chain: 'UCI', city: 'Salvador', state: 'BA', neighborhood: 'Caminho das Árvores', address: 'Av. Tancredo Neves, 148', lat: -12.9784, lng: -38.4555 },
]

type RoomSeed = Omit<Room, 'id' | 'cinemaId'> & { quality: number }

const ROOMS_BY_CINEMA: Record<string, RoomSeed[]> = {
  'cinemark-eldorado': [
    { name: 'Sala 7 XD', format: 'xd', seats: 412, projection: 'Laser 4K', sound: 'Dolby Atmos', accessible: true, quality: 4.3 },
    { name: 'Sala 3 D-BOX', format: 'dbox', seats: 180, projection: 'Digital 2K', sound: '7.1', accessible: true, quality: 3.6 },
    { name: 'Sala 9 Prime', format: 'prime', seats: 96, projection: 'Digital 4K', sound: 'Dolby 7.1', accessible: true, quality: 4.1 },
    { name: 'Sala 2', format: 'standard', seats: 220, projection: 'Digital 2K', sound: '5.1', accessible: false, quality: 3.1 },
  ],
  'cinepolis-jk-iguatemi': [
    { name: 'Sala 1 Macro XE', format: 'macroxe', seats: 380, projection: 'Laser 4K', sound: 'Dolby Atmos', accessible: true, quality: 4.2 },
    { name: 'Sala 5 VIP', format: 'vip', seats: 64, projection: 'Digital 4K', sound: 'Dolby 7.1', accessible: true, quality: 4.5 },
    { name: 'Sala 6 4DX', format: '4dx', seats: 140, projection: 'Digital 2K', sound: '7.1', accessible: false, quality: 3.4 },
  ],
  'uci-analia-franco': [
    { name: 'Sala IMAX', format: 'imax', seats: 440, projection: 'IMAX com Laser', sound: 'IMAX 12 canais', accessible: true, quality: 4.7 },
    { name: 'Sala 4', format: 'standard', seats: 210, projection: 'Digital 2K', sound: '5.1', accessible: true, quality: 3.2 },
  ],
  'espaco-itau-augusta': [
    { name: 'Sala 1', format: 'standard', seats: 270, projection: 'Digital 4K', sound: 'Dolby 7.1', accessible: true, quality: 4.0 },
    { name: 'Sala 3', format: 'standard', seats: 90, projection: 'Digital 2K', sound: '5.1', accessible: false, quality: 3.5 },
  ],
  'petra-belas-artes': [
    { name: 'Sala Villa-Lobos', format: 'street', seats: 180, projection: 'Digital 2K e 35mm', sound: '5.1', accessible: true, quality: 4.2 },
    { name: 'Sala Aleijadinho', format: 'street', seats: 60, projection: 'Digital 2K', sound: '5.1', accessible: false, quality: 3.7 },
  ],
  cinesesc: [
    { name: 'Sala única', format: 'street', seats: 324, projection: 'Digital 4K e 35mm', sound: 'Dolby 7.1', accessible: true, quality: 4.6 },
  ],
  'estacao-net-botafogo': [
    { name: 'Sala 1', format: 'standard', seats: 150, projection: 'Digital 2K', sound: '5.1', accessible: true, quality: 3.9 },
    { name: 'Sala 3', format: 'standard', seats: 70, projection: 'Digital 2K', sound: '5.1', accessible: false, quality: 3.3 },
  ],
  'cine-odeon': [
    { name: 'Sala única', format: 'street', seats: 550, projection: 'Digital 4K e 35mm', sound: 'Dolby 7.1', accessible: true, quality: 4.5 },
  ],
  'uci-new-york-city-center': [
    { name: 'Sala IMAX', format: 'imax', seats: 400, projection: 'IMAX Digital', sound: 'IMAX 6 canais', accessible: true, quality: 4.1 },
    { name: 'Sala 10 4DX', format: '4dx', seats: 120, projection: 'Digital 2K', sound: '7.1', accessible: false, quality: 3.0 },
  ],
  'cine-belas-artes-bh': [
    { name: 'Sala 1', format: 'street', seats: 140, projection: 'Digital 2K', sound: '5.1', accessible: false, quality: 3.8 },
  ],
  'cine-brasilia': [
    { name: 'Sala única', format: 'street', seats: 600, projection: 'Digital 4K e 35mm', sound: 'Dolby 7.1', accessible: true, quality: 4.4 },
  ],
  'cinema-sao-luiz': [
    { name: 'Sala única', format: 'street', seats: 990, projection: 'Digital 2K e 35mm', sound: '5.1', accessible: true, quality: 4.6 },
  ],
  'cinemateca-capitolio': [
    { name: 'Sala Capitólio', format: 'street', seats: 160, projection: 'Digital 2K e 35mm', sound: '5.1', accessible: true, quality: 4.0 },
  ],
  'cine-passeio': [
    { name: 'Sala Ritz', format: 'street', seats: 110, projection: 'Digital 2K', sound: '5.1', accessible: true, quality: 4.1 },
    { name: 'Sala Luz', format: 'street', seats: 70, projection: 'Digital 2K', sound: '5.1', accessible: true, quality: 3.9 },
  ],
  'uci-orient-shopping-da-bahia': [
    { name: 'Sala IMAX', format: 'imax', seats: 360, projection: 'IMAX Digital', sound: 'IMAX 6 canais', accessible: true, quality: 4.0 },
    { name: 'Sala 8', format: 'standard', seats: 190, projection: 'Digital 2K', sound: '5.1', accessible: true, quality: 2.9 },
  ],
}

function slugify(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export const ROOMS: Room[] = []
const QUALITY = new Map<string, number>()
for (const [cinemaId, rooms] of Object.entries(ROOMS_BY_CINEMA)) {
  for (const { quality, ...room } of rooms) {
    const id = `${cinemaId}-${slugify(room.name)}`
    ROOMS.push({ ...room, id, cinemaId })
    QUALITY.set(id, quality)
  }
}

// Deterministic PRNG so every server instance seeds identical reviews.
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const USERNAMES = [
  'pipoqueira', 'fileira_g', 'cinefilo_da_augusta', 'lanterna_vermelha', 'cinema_novo_sempre',
  'tela_grande', 'meia_entrada', 'sessao_das_dez', 'creditos_finais', 'joao_do_centro',
  'mari_no_escurinho', 'nao_fala_no_cinema', 'super8', 'trilha_sonora', 'balde_de_pipoca',
]

const FILMS = [
  'Ainda Estou Aqui', 'O Agente Secreto', 'Bacurau', 'Central do Brasil', 'Cidade de Deus',
  'Duna: Parte Dois', 'Oppenheimer', 'Interestelar', 'Aquarius', 'Que Horas Ela Volta?',
  'O Auto da Compadecida 2', 'Mad Max: Estrada da Fúria', 'Retrato de uma Jovem em Chamas', 'Marte Um',
]

// Review bodies are user content, so they are pt-BR.
const BODIES: Record<'high' | 'mid' | 'low', string[]> = {
  high: [
    'Imagem impecável, preto de verdade e som que você sente no peito. Vale cada centavo do ingresso.',
    'Uma das melhores salas que já frequentei. Poltronas confortáveis e o público respeita o filme.',
    'Saí arrepiado. A projeção estava perfeitamente calibrada e o som envolve sem estourar.',
    'Sala histórica muito bem cuidada. Ver filme aqui é programa completo.',
    'Escolhi a fileira do meio e a experiência foi absurda. Volto com certeza.',
  ],
  mid: [
    'Boa sala, mas o ar-condicionado estava gelado demais. Leve um casaco.',
    'Imagem ok, som um pouco baixo nos diálogos. Nada que estrague a sessão.',
    'Poltrona razoável, limpeza poderia ser melhor. Pelo preço, cumpre o que promete.',
    'Experiência correta. Os trailers duraram uns 25 minutos, o que cansa.',
    'Gostei da tela, mas as fileiras da frente ficam desconfortáveis para o pescoço.',
  ],
  low: [
    'Projeção escura e fora de foco no canto da tela. Reclamei e ninguém resolveu.',
    'Som estourado e chão grudando. Não volto tão cedo.',
    'Poltrona quebrada e muita conversa durante o filme. Faltou um lanterninha de verdade!',
    'Caro para o que entrega. A sala precisa de uma reforma urgente.',
  ],
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

function generateReviews(): Review[] {
  const rand = mulberry32(20261014)
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!
  const start = Date.UTC(2025, 0, 1)
  const end = Date.UTC(2026, 9, 10)
  const reviews: Review[] = []
  let seq = 0

  for (const room of ROOMS) {
    const quality = QUALITY.get(room.id) ?? 3.5
    const attempts = 3 + Math.floor(rand() * 12)
    const authors = new Set<string>()
    for (let i = 0; i < attempts; i++) {
      const username = pick(USERNAMES)
      if (authors.has(username)) continue
      authors.add(username)

      const noise = () => (rand() - 0.5) * 1.6
      const rating = clamp(Math.round((quality + noise()) * 2) / 2, 0.5, 5)
      const criterion = (bias: number) => clamp(Math.round(quality + bias + noise()), 1, 5)
      const criteria: Record<Criterion, number> = {
        picture: criterion(room.format === 'imax' ? 0.4 : 0),
        sound: criterion(room.sound.includes('Atmos') || room.format === 'imax' ? 0.4 : 0),
        comfort: criterion(room.format === 'vip' || room.format === 'prime' ? 0.6 : -0.2),
        cleanliness: criterion(0),
      }
      const band = rating >= 4 ? 'high' : rating >= 2.5 ? 'mid' : 'low'
      const tags = new Set<Tag>()
      const tagCount = Math.floor(rand() * 3)
      for (let t = 0; t < tagCount; t++) tags.add(pick(TAGS))

      reviews.push({
        id: `r${(++seq).toString(36)}`,
        roomId: room.id,
        username,
        rating,
        criteria,
        // Rows C–O; 'C' is char code 67.
        row: rand() > 0.3 ? String.fromCharCode(67 + Math.floor(rand() * 9 + rand() * 4)) : null,
        film: rand() > 0.15 ? pick(FILMS) : null,
        body: pick(BODIES[band]),
        tags: [...tags],
        createdAt: new Date(start + rand() * (end - start)).toISOString(),
      })
    }
  }
  return reviews
}

export const SEED_REVIEWS = generateReviews()
