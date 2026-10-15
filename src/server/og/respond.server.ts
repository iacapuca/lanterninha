import type { ReactNode } from 'react'
import { renderPng } from './render.server'

/**
 * Renders a card once per URL and keeps it in the edge cache for a day.
 * Pages add a version (?v=) that changes with the rating, so a new review
 * gets a fresh image without waiting for the cache to expire.
 */
export async function ogResponse(request: Request, draw: () => Promise<ReactNode | null>) {
  const cache = (caches as unknown as { default: Cache }).default
  const hit = await cache.match(request)
  if (hit) return hit
  const node = await draw()
  if (!node) return new Response('Not found', { status: 404 })
  const png = await renderPng(node)
  const response = new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' },
  })
  await cache.put(request, response.clone())
  return response
}
