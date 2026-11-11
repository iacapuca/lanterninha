import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { track } from '~/server/analytics.server'
import { deleteImage } from '~/server/photos.server'
import * as store from '~/server/store.server'
import { requireAdmin, requireSession } from './auth.middleware'

// Uploads go through the /api/photos server route (raw body); everything else is here.

const id = z.string().min(1).max(80)

/** The author takes the photo off their review. */
export const removeSeatPhoto = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator(z.object({ reviewId: id }))
  .handler(async ({ data, context }) => {
    if (!(await store.getReviewForPhoto(context.userId, data.reviewId))) throw new Error('Avaliação não encontrada.')
    const key = await store.removeSeatPhoto(data.reviewId)
    if (key) await deleteImage(key)
  })

const REPORT_ERRORS = {
  'unknown-photo': 'Essa foto não existe mais.',
  'own-photo': 'Essa foto é sua. Para tirá-la, edite a avaliação.',
} as const

/** A reader reports a photo; it's hidden at once, until a moderator looks at it. */
export const reportPhoto = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator(z.object({ photoId: id }))
  .handler(async ({ data, context }) => {
    const result = await store.reportPhoto(context.userId, data.photoId)
    if (!result.ok) throw new Error(REPORT_ERRORS[result.reason])
    track('photo_reported')
  })

/** Whether the viewer moderates photos; drives the /admin/photos guard (the functions below check again). */
export const getIsAdmin = createServerFn({ method: 'GET' })
  .middleware([requireSession])
  .handler(({ context }) => store.isAdmin(context.userId))

export const getReportedPhotos = createServerFn({ method: 'GET' })
  .middleware([requireAdmin])
  .handler(async () => {
    const rows = await store.listReportedPhotos()
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))
  })

export const moderatePhoto = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(z.object({ photoId: id, action: z.enum(['restore', 'delete']) }))
  .handler(async ({ data }) => {
    const key = await store.moderatePhoto(data.photoId, data.action)
    if (key) await deleteImage(key)
  })
