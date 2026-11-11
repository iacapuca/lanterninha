// /melhores-salas: the best-rated rooms in Brazil, a city, or a format.
import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { loadRanking, summarizeRankingIndex } from '~/server/rankings.server'
import * as store from '~/server/store.server'

export type { RankingPlace } from '~/server/rankings.server'

export const getRankingHub = createServerFn({ method: 'GET' }).handler(async () => {
  const [top, index] = await Promise.all([store.rankRooms({}, 10), store.getRankingIndex()])
  return { top, ...summarizeRankingIndex(index) }
})

export const getRanking = createServerFn({ method: 'GET' })
  .validator(z.object({ place: z.string().min(1).max(80), format: z.string().max(20).optional() }))
  .handler(async ({ data }) => {
    const ranking = await loadRanking(data.place, data.format)
    if (!ranking) throw notFound()
    return ranking
  })
