// Browser-only: shrinks a seat photo before upload. Redrawing it on a canvas
// re-encodes the pixels only, so EXIF data (GPS location, phone model) never
// leaves the device. WebP where the browser can encode it, JPEG otherwise
// (Safari's canvas can't write WebP).
import { PHOTO_MAX_BYTES, PHOTO_MAX_SIDE } from './domain'

export type ShrunkPhoto = { blob: Blob; width: number; height: number }

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))

export async function shrinkPhoto(file: File): Promise<ShrunkPhoto> {
  let bitmap: ImageBitmap
  try {
    // Applies the EXIF rotation, so portrait phone photos stay upright.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('Não deu para abrir essa foto. Tente uma em JPEG.')
  }
  const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  for (const [type, quality] of [
    ['image/webp', 0.82],
    ['image/jpeg', 0.85],
    ['image/jpeg', 0.7],
  ] as const) {
    const blob = await toBlob(canvas, type, quality)
    // A browser that can't encode the type silently returns PNG instead.
    if (blob && blob.type === type && blob.size <= PHOTO_MAX_BYTES) return { blob, width, height }
  }
  throw new Error('Não deu para preparar essa foto. Tente outra.')
}

/** Sends a shrunk photo to /api/photos for one of the viewer's reviews. */
export async function uploadPhoto(reviewId: string, photo: ShrunkPhoto) {
  const params = new URLSearchParams({ review: reviewId, w: String(photo.width), h: String(photo.height) })
  const response = await fetch(`/api/photos?${params}`, {
    method: 'POST',
    body: photo.blob,
    headers: { 'Content-Type': photo.blob.type },
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? 'Não foi possível enviar a foto.')
  }
}
