import { describe, expect, it } from 'vitest'
import { earnedBadges, timeZoneOf, type ContributionStats } from '~/lib/domain'
import { formatRating, pluralize } from '~/lib/format'
import { exploreSearchSchema, newReviewSchema } from '~/lib/schemas'

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
