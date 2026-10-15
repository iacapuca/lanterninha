import { describe, expect, it, vi } from 'vitest'
import { cinemaEvents, decodeDataUrl, durationMinutes } from '~/server/programme/somosviva/api.server'
import fixture from './fixtures/somosviva-events.json'

describe('Somos Viva client', () => {
  it('keeps only live cinema events at the requested park', async () => {
    vi.stubGlobal('fetch', async () => Response.json(fixture))
    const events = await cinemaEvents('Apipucos')
    expect(events.map((e) => e.title)).toEqual(['Paterno'])
    expect(events[0]!.start).toMatch(/^2026-10-\d\dT\d\d:\d\d/)
  })

  it('pages until the calendar says there is no more', async () => {
    const page = (n: number, hasMore: boolean) => ({
      ...fixture,
      events: fixture.events.slice(0, n),
      pagination: { has_more: hasMore },
    })
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(Response.json(page(fixture.events.length, true)))
      .mockResolvedValueOnce(Response.json(page(1, false)))
    vi.stubGlobal('fetch', fetch)
    await cinemaEvents('Apipucos')
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(String(fetch.mock.calls[1]![0])).toContain('offset=50')
  })

  it('reads the runtime from the description', () => {
    expect(durationMinutes('Sinopse:\n…\n\nDuração:\n108 minutos')).toBe(108)
    expect(durationMinutes('sem duração')).toBeNull()
  })

  it('decodes inline posters', () => {
    const poster = decodeDataUrl(fixture.events[0]!.imageDataUrl)
    expect(poster?.contentType).toBe('image/jpeg')
    expect(poster?.bytes.slice(0, 2)).toEqual(new Uint8Array([0xff, 0xd8]))
    expect(decodeDataUrl('not a data url')).toBeNull()
  })
})
