import { afterEach, describe, expect, it, vi } from 'vitest'
import { env } from 'cloudflare:workers'
import { isoDay, presentations } from '~/server/programme/fundarpe/api.server'
import fixture from './fixtures/fundarpe-presentation.json'

afterEach(() => {
  delete env.FUNDARPE_API_KEY
})

describe('Fundarpe client', () => {
  it('builds ISO days from "dd/mm" plus year', () => {
    expect(isoDay('17/10', '2026')).toBe('2026-10-17')
    expect(isoDay('5/1', '2027')).toBe('2027-01-05')
    expect(isoDay('bad', '2026')).toBeNull()
  })

  it('parses a real presentation response', async () => {
    env.FUNDARPE_API_KEY = 'test-key'
    const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json(fixture))
    vi.stubGlobal('fetch', fetch)
    const sessions = await presentations(581, 55)
    expect(sessions).toHaveLength(3)
    expect(sessions[0]).toMatchObject({
      NomPeca: 'Papaya',
      day: '17/10',
      year: '2026',
      HorSessao: '14:00',
      ValPeca: 10,
    })
    expect(sessions[1]!.in_esgotado_manual).toBe(1)
    expect(String(fetch.mock.calls[0]![0])).toContain('codPeca=55')
  })

  it('treats an unused code (error object) as no sessions', async () => {
    env.FUNDARPE_API_KEY = 'test-key'
    vi.stubGlobal('fetch', async () => Response.json({ error: true, msg: 'Não foi possível achar o evento.' }))
    expect(await presentations(581, 999)).toEqual([])
  })

  it('refuses to run without a key, and never puts the key in errors', async () => {
    await expect(presentations(581, 55)).rejects.toThrow('FUNDARPE_API_KEY is not set')
    env.FUNDARPE_API_KEY = 'secret-key'
    vi.stubGlobal('fetch', async () => new Response('nope', { status: 500 }))
    const error = await presentations(581, 55).catch((e: Error) => e)
    expect(String(error)).not.toContain('secret-key')
  })
})
