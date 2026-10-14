import { createServerFn } from '@tanstack/react-start'
import { newReviewSchema } from '~/lib/schemas'
import * as store from '~/server/store.server'
import { requireSession } from './auth.middleware'

const ERRORS = {
  'unknown-room': 'Essa sala não existe.',
  duplicate: 'Você já avaliou esta sala hoje. Volte depois da próxima sessão!',
} as const

export const createReview = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator(newReviewSchema)
  .handler(({ data, context }) => {
    const result = store.createReview(context.username, data)
    if (!result.ok) throw new Error(ERRORS[result.reason])
    return { id: result.review.id, roomId: result.review.roomId }
  })
