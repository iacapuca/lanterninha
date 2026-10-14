// Read-side server functions. Static imports from routes are safe: the client
// build replaces each handler with an RPC stub, so the `.server.ts` modules
// they use never reach the browser bundle.
import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { exploreSearchSchema, roomSearchSchema } from '~/lib/schemas'
import { slowQuery } from '~/server/latency.server'
import * as store from '~/server/store.server'

const byId = z.object({ id: z.string().min(1).max(80) })

export const getHome = createServerFn({ method: 'GET' }).handler(() => ({
  topRooms: store.getTopRooms(6),
  totals: store.getTotals(),
}))

/** Slow on purpose (scans the whole review log): streamed on the home page. */
export const getRecentReviews = createServerFn({ method: 'GET' })
  .validator(z.object({ limit: z.number().int().min(1).max(30) }))
  .handler(async ({ data }) => {
    await slowQuery()
    return store.getRecentReviews(data.limit)
  })

export const searchRooms = createServerFn({ method: 'GET' })
  .validator(exploreSearchSchema)
  .handler(({ data }) => ({
    ...store.searchRooms(data),
    cities: store.listCities(),
  }))

export const getRoom = createServerFn({ method: 'GET' })
  .validator(byId)
  .handler(({ data }) => {
    const room = store.getRoom(data.id)
    if (!room) throw notFound()
    return room
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
  .handler(({ data }) => {
    const cinema = store.getCinema(data.id)
    if (!cinema) throw notFound()
    return cinema
  })

export const getUserProfile = createServerFn({ method: 'GET' })
  .validator(z.object({ username: z.string().min(1).max(24) }))
  .handler(({ data }) => {
    const profile = store.getUserProfile(data.username)
    if (!profile) throw notFound()
    return profile
  })

export const getCinemaLocations = createServerFn({ method: 'GET' }).handler(() =>
  store.getCinemaLocations(),
)
