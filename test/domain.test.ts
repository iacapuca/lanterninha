import { describe, expect, it } from 'vitest'
import { citySlug, earnedBadges, factFieldsFor, rowOrder, timeZoneOf, type ContributionStats } from '~/lib/domain'
import { formatRating, pluralize } from '~/lib/format'
import { exploreSearchSchema, newReviewSchema, roomFactVoteSchema } from '~/lib/schemas'
import { sniffPhotoType } from '~/server/photo-type.server'

const none: ContributionStats = { reviews: 0, cities: 0, format: 0, projection: 0, sound: 0, firstAnswers: 0 }

describe('badges', () => {
  it('are earned exactly at their goal', () => {
    expect(earnedBadges(none)).toEqual([])
    expect(earnedBadges({ ...none, reviews: 1 })).toEqual(['first-review'])
    expect(earnedBadges({ ...none, reviews: 10, cities: 3 })).toEqual(['first-review', 'regular', 'traveler'])
    expect(earnedBadges({ ...none, format: 1, firstAnswers: 1 })).toEqual(['screen-spotter', 'trailblazer'])
  })
})

describe('time zones by state', () => {
  it.each([
    ['PE', 'America/Sao_Paulo'],
    ['AM', 'America/Manaus'],
    ['AC', 'America/Rio_Branco'],
    ['MS', 'America/Cuiaba'],
  ] as const)('%s → %s', (state, tz) => {
    expect(timeZoneOf(state)).toBe(tz)
  })
})

describe('pt-BR formatting', () => {
  it('formats ratings and plurals', () => {
    expect(formatRating(4.5)).toBe('4,5')
    expect(formatRating(null)).toBe('—')
    expect(pluralize(1, 'sala', 'salas')).toBe('1 sala')
    expect(pluralize(1369, 'lugar', 'lugares')).toBe('1.369 lugares')
  })
})

describe('schemas', () => {
  it('coerces bad explore params to defaults instead of failing', () => {
    expect(exploreSearchSchema.parse({ state: 'XX', page: '-3', sort: 'nope', q: 2001 })).toEqual({
      q: '2001',
      state: undefined,
      city: undefined,
      format: undefined,
      sort: 'rating',
      page: 1,
    })
  })

  it('validates a review', () => {
    const review = {
      roomId: 'cinema-sao-luiz-sala-unica',
      rating: 4.5,
      criteria: { picture: 5, sound: 4, comfort: 3, cleanliness: 5 },
      row: 'g',
      film: '',
      body: 'Tela linda, som ótimo, poltrona ok.',
      tags: [],
    }
    expect(newReviewSchema.parse(review)).toMatchObject({ row: 'G', film: null })
    expect(newReviewSchema.safeParse({ ...review, rating: 4.2 }).success).toBe(false)
    expect(newReviewSchema.safeParse({ ...review, body: 'curto' }).success).toBe(false)
  })
})

describe('city slugs', () => {
  it('fold accents and punctuation, and keep the state so namesakes differ', () => {
    expect(citySlug('São Paulo', 'SP')).toBe('sao-paulo-sp')
    expect(citySlug("Santa Bárbara d'Oeste", 'SP')).toBe('santa-barbara-d-oeste-sp')
    expect(citySlug('Valença', 'BA')).not.toBe(citySlug('Valença', 'RJ'))
  })
})

describe('room facts', () => {
  it('ask which IMAX only on IMAX rooms', () => {
    expect(factFieldsFor('imax')).toContain('imaxType')
    expect(factFieldsFor('standard')).not.toContain('imaxType')
    expect(factFieldsFor(null)).not.toContain('imaxType')
    expect(factFieldsFor(null)).toEqual(['format', 'screenSize', 'projection', 'sound', 'threeD', 'seatType'])
  })

  it('accept only the options of the field voted on', () => {
    const vote = (field: string, value: string) => roomFactVoteSchema.safeParse({ roomId: 'r1', field, value }).success
    expect(vote('imaxType', 'laser-gt')).toBe(true)
    expect(vote('screenSize', '15-20')).toBe(true)
    expect(vote('threeD', 'no')).toBe(true)
    expect(vote('seatType', 'reclining')).toBe(true)
    expect(vote('seatType', 'laser-gt')).toBe(false)
    expect(vote('size', '15-20')).toBe(false)
  })
})

describe('seat photos', () => {
  it('sort rows from the screen back, with no row last', () => {
    const rows = ['AA', null, 'B', 'Z', 'A']
    expect(rows.sort((a, b) => rowOrder(a) - rowOrder(b))).toEqual(['A', 'B', 'Z', 'AA', null])
  })

  it('trust the file bytes, not the name', () => {
    const bytes = (...xs: Array<number | string>) =>
      new Uint8Array(xs.flatMap((x) => (typeof x === 'string' ? [...x].map((c) => c.charCodeAt(0)) : [x])))
    expect(sniffPhotoType(bytes('RIFF', 0, 0, 0, 0, 'WEBP', 'VP8 '))).toBe('image/webp')
    expect(sniffPhotoType(bytes(0xff, 0xd8, 0xff, 0xe0, 0))).toBe('image/jpeg')
    expect(sniffPhotoType(bytes(0x89, 'PNG', 0x0d, 0x0a))).toBe(null)
    expect(sniffPhotoType(bytes('<svg onload=alert(1)>'))).toBe(null)
  })

  it('keep the seat position only as a known option', () => {
    const base = {
      roomId: 'r1',
      rating: 4,
      criteria: { picture: 4, sound: 4, comfort: 4, cleanliness: 4 },
      body: 'Boa sala, tela grande.',
    }
    expect(newReviewSchema.parse({ ...base, row: 'h', seatPosition: 'center' })).toMatchObject({
      row: 'H',
      seatPosition: 'center',
    })
    expect(newReviewSchema.parse({ ...base, seatPosition: '' }).seatPosition).toBe(null)
    expect(newReviewSchema.safeParse({ ...base, seatPosition: 'aisle' }).success).toBe(false)
  })
})
