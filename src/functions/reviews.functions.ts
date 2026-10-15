import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { earnedBadges } from '~/lib/domain'
import { newReviewSchema, roomFactVoteSchema, updateReviewSchema } from '~/lib/schemas'
import * as store from '~/server/store.server'
import { requireSession } from './auth.middleware'

const ERRORS = {
  'unknown-room': 'Essa sala não existe.',
  duplicate: 'Você já avaliou esta sala hoje. Volte depois da próxima sessão!',
} as const

export const createReview = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator(newReviewSchema)
  .handler(async ({ data, context }) => {
    let result: store.CreateReviewResult
    try {
      result = await store.createReview(context.userId, data)
    } catch (error) {
      // Never send database errors (SQL, parameters) to the client, not even as `cause`.
      console.error('createReview failed', error)
      // oxlint-disable-next-line preserve-caught-error
      throw new Error('Não foi possível publicar agora. Tente de novo em instantes.')
    }
    if (!result.ok) throw new Error(ERRORS[result.reason])
    return { id: result.id, roomId: result.roomId }
  })

/** Fill in a room detail (format, projection or sound); returns any badges it unlocked. */
export const voteRoomFact = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator(roomFactVoteSchema)
  .handler(async ({ data, context }) => {
    const before = earnedBadges(await store.getContributionStats(context.userId))
    const result = await store.voteRoomFact(context.userId, data.roomId, data.field, data.value)
    if (!result.ok) throw new Error(ERRORS[result.reason])
    const after = earnedBadges(await store.getContributionStats(context.userId))
    return { newBadges: after.filter((b) => !before.includes(b)) }
  })

const reviewId = z.object({ id: z.string().min(1).max(80) })

/** The signed-in author's own review, for the edit form. */
export const getOwnReview = createServerFn({ method: 'GET' })
  .middleware([requireSession])
  .validator(reviewId)
  .handler(async ({ data, context }) => {
    const found = await store.getOwnReview(context.userId, data.id)
    if (!found) throw new Error('Avaliação não encontrada.')
    return found
  })

export const updateReview = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator(updateReviewSchema)
  .handler(async ({ data, context }) => {
    const updated = await store.updateReview(context.userId, data)
    if (!updated) throw new Error('Avaliação não encontrada.')
    return updated
  })

export const deleteReview = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator(reviewId)
  .handler(async ({ data, context }) => {
    const deleted = await store.deleteReview(context.userId, data.id)
    if (!deleted) throw new Error('Avaliação não encontrada.')
    return deleted
  })
