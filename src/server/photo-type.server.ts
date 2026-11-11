import type { PHOTO_TYPES } from '~/lib/domain'

/** The photo's real type from its first bytes, so a renamed file of another type is refused. */
export function sniffPhotoType(bytes: Uint8Array): (typeof PHOTO_TYPES)[number] | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to))
  if (bytes.length > 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp'
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  return null
}
