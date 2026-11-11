// Reader-to-reader features: "útil" marks on reviews, following people, and
// the feed of reviews from the people you follow.
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { usernameSchema } from '~/lib/schemas'
import { track } from '~/server/analytics.server'
import * as store from '~/server/store.server'
import { requireSession } from './auth.middleware'

const ERRORS = {
  'unknown-review': 'Essa avaliação não existe mais.',
  'own-review': 'Você não pode marcar a sua própria avaliação como útil.',
  'unknown-user': 'Essa pessoa não existe.',
  self: 'Você não pode seguir a si mesmo.',
} as const

export const setReviewHelpful = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator(z.object({ reviewId: z.string().min(1).max(80), on: z.boolean() }))
  .handler(async ({ data, context }) => {
    const result = await store.setReviewHelpful(context.userId, data.reviewId, data.on)
    if (!result.ok) throw new Error(ERRORS[result.reason])
    if (data.on) track('review_marked_helpful', { reviewId: data.reviewId })
    return { helpful: result.helpful, markedHelpful: result.markedHelpful }
  })

export const setFollow = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator(z.object({ username: usernameSchema, on: z.boolean() }))
  .handler(async ({ data, context }) => {
    const result = await store.setFollow(context.userId, data.username, data.on)
    if (!result.ok) throw new Error(ERRORS[result.reason])
    if (data.on) track('user_followed')
    return { followers: result.followers }
  })

export const getFeed = createServerFn({ method: 'GET' })
  .middleware([requireSession])
  .handler(async ({ context }) => {
    const [feed, suggestions] = await Promise.all([
      store.getFeed(context.userId, 30),
      store.getSuggestedReviewers(context.userId, 6),
    ])
    return { ...feed, suggestions }
  })
