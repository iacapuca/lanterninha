// Seat photos in R2 (the `PHOTOS` binding). The database rows live in
// store.server.ts; this module owns the images. Photos are shrunk and
// re-encoded in the browser (src/lib/photo-resize.ts), which also drops EXIF
// data such as GPS location; the server only checks what it receives.
import { env } from 'cloudflare:workers'
import { PHOTO_MAX_BYTES, PHOTO_MAX_SIDE } from '~/lib/domain'
import { sniffPhotoType } from './photo-type.server'
import * as store from './store.server'

export type UploadResult = { ok: true; id: string; roomId: string } | { ok: false; status: number; message: string }

const fail = (status: number, message: string) => ({ ok: false as const, status, message })

/** Stores a photo for one of the user's reviews, replacing the review's earlier photo. */
export async function uploadSeatPhoto(input: {
  userId: string
  reviewId: string
  width: number
  height: number
  body: ArrayBuffer
}): Promise<UploadResult> {
  const target = await store.getReviewForPhoto(input.userId, input.reviewId)
  if (!target) return fail(404, 'Essa avaliação não existe.')
  if (!target.row) return fail(400, 'Diga a fileira para adicionar a vista da poltrona.')
  if (input.body.byteLength > PHOTO_MAX_BYTES) return fail(413, 'A foto é grande demais.')
  const bytes = new Uint8Array(input.body)
  const contentType = sniffPhotoType(bytes)
  if (!contentType) return fail(415, 'Envie uma foto em JPEG ou WebP.')
  const sideOk = (n: number) => Number.isInteger(n) && n > 0 && n <= PHOTO_MAX_SIDE
  if (!sideOk(input.width) || !sideOk(input.height)) return fail(400, 'Tamanho de foto inválido.')

  const id = crypto.randomUUID()
  const key = `seat/${target.roomId}/${id}`
  await env.PHOTOS.put(key, bytes, { httpMetadata: { contentType } })
  const previous = await store.saveSeatPhoto({
    id,
    reviewId: target.id,
    roomId: target.roomId,
    userId: input.userId,
    key,
    contentType,
    width: input.width,
    height: input.height,
  })
  if (previous) await deleteImage(previous)
  return { ok: true, id, roomId: target.roomId }
}

/** Best effort: a leftover image is unreachable once its row is gone (/photos looks rows up). */
export async function deleteImage(key: string) {
  try {
    await env.PHOTOS.delete(key)
  } catch (error) {
    console.error('photo delete failed', key, error)
  }
}

/** The image for /photos/$photoId; hidden (reported) photos only for moderators. */
export async function readSeatPhoto(id: string, canSeeHidden: () => Promise<boolean>) {
  const photo = await store.getPhotoObject(id)
  if (!photo) return null
  if (photo.status !== 'visible' && !(await canSeeHidden())) return null
  const object = await env.PHOTOS.get(photo.key)
  if (!object) return null
  return { body: object.body, contentType: photo.contentType, hidden: photo.status !== 'visible' }
}
