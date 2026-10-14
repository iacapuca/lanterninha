// Read-side server functions. Static imports from routes are safe: the client
// build replaces each handler with an RPC stub, so the `.server.ts` modules
// they use never reach the browser bundle.
import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { earnedBadges } from '~/lib/domain'
import { exploreSearchSchema, roomSearchSchema } from '~/lib/schemas'
import { auth } from '~/server/auth.server'
import { slowQuery } from '~/server/latency.server'
import * as store from '~/server/store.server'

const byId = z.object({ id: z.string().min(1).max(80) })

export const getHome = createServerFn({ method: 'GET' }).handler(async () => {
  const [topRooms, totals] = await Promise.all([store.getTopRooms(6), store.getTotals()])
  return { topRooms, totals }
})

/** Slow on purpose (scans the whole review log): streamed on the home page. */
export const getRecentReviews = createServerFn({ method: 'GET' })
  .validator(z.object({ limit: z.number().int().min(1).max(30) }))
  .handler(async ({ data }) => {
    await slowQuery()
    return store.getRecentReviews(data.limit)
  })

export const searchRooms = createServerFn({ method: 'GET' })
  .validator(exploreSearchSchema)
  .handler(async ({ data }) => {
    const [result, cities] = await Promise.all([store.searchRooms(data), store.listCities(data.state)])
    return { ...result, cities }
  })

export const getRoom = createServerFn({ method: 'GET' })
  .validator(byId)
  .handler(async ({ data }) => {
    const room = await store.getRoom(data.id)
    if (!room) throw notFound()
    const session = await auth.api.getSession({ headers: getRequestHeaders() })
    const facts = await store.getRoomFactVotes(data.id, session?.user.id)
    return { ...room, facts }
  })

export const getRoomStats = createServerFn({ method: 'GET' })
  .validator(byId)
  .handler(async ({ data }) => {
    await slowQuery()
    return store.getRoomStats(data.id)
  })

export const getRoomReviews = createServerFn({ method: 'GET' })
  .validator(byId.extend(roomSearchSchema.shape))
  .handler(async ({ data }) => {
    await slowQuery()
    return store.getRoomReviews(data.id, data.reviews)
  })

export const getCinema = createServerFn({ method: 'GET' })
  .validator(byId)
  .handler(async ({ data }) => {
    const cinema = await store.getCinema(data.id)
    if (!cinema) throw notFound()
    return cinema
  })

export const getUserProfile = createServerFn({ method: 'GET' })
  .validator(z.object({ username: z.string().min(1).max(24) }))
  .handler(async ({ data }) => {
    const [profile, userId] = await Promise.all([
      store.getUserProfile(data.username),
      store.getUserIdByUsername(data.username),
    ])
    if (!profile || !userId) throw notFound()
    return { ...profile, badges: earnedBadges(await store.getContributionStats(userId)) }
  })

export const getCinemaLocations = createServerFn({ method: 'GET' }).handler(() =>
  store.getCinemaLocations(),
)
