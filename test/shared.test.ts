import { describe, expect, it } from 'vitest'
import {
  chunk,
  fold,
  formatHint,
  localDay,
  mapLimit,
  nameTokens,
  projectionHint,
  roomNumber,
  soundHint,
  zonedTime,
} from '~/server/programme/shared.server'

describe('text helpers', () => {
  it('folds accents and case', () => {
    expect(fold('Cinéfilo São Luiz')).toBe('CINEFILO SAO LUIZ')
  })

  it('keeps only meaningful name tokens', () => {
    expect([...nameTokens('Cinemark Shopping Center Recife')]).toEqual(['CINEMARK', 'RECIFE'])
  })
})

describe('roomNumber', () => {
  it.each([
    ['Sala 03', 3],
    ['SALA 7 - IMAX', 7],
    ['Bradesco Prime 2', 2],
    ['Sala 4DX', null],
    ['Sala única', null],
  ])('%s → %s', (name, number) => {
    expect(roomNumber(name)).toBe(number)
  })
})

describe('room-detail hints', () => {
  it('reads formats, projection and sound from names and session types', () => {
    expect(formatHint('SALA 1 IMAX')).toBe('imax')
    expect(formatHint('Macro XE')).toBe('macroxe')
    expect(formatHint('Sala VIP')).toBe('vip')
    expect(formatHint('Sala 2')).toBeNull()
    expect(projectionHint('LASER 4K')).toBe('laser')
    expect(soundHint('Dolby Atmos')).toBe('atmos')
  })
})

describe('time zones', () => {
  it('turns a local wall-clock time into the right instant', () => {
    expect(zonedTime('America/Sao_Paulo', '2026-10-17', '14:00').toISOString()).toBe('2026-10-17T17:00:00.000Z')
    expect(zonedTime('America/Manaus', '2026-10-17', '14:00').toISOString()).toBe('2026-10-17T18:00:00.000Z')
    expect(zonedTime('America/Rio_Branco', '2026-10-17', '23:30').toISOString()).toBe('2026-10-18T04:30:00.000Z')
  })

  it('gives the local calendar day, not UTC’s', () => {
    // 02:00 UTC is still the previous evening in São Paulo.
    const realNow = Date.now
    Date.now = () => Date.parse('2026-10-16T02:00:00Z')
    try {
      expect(localDay('America/Sao_Paulo', 0)).toBe('2026-10-15')
      expect(localDay('America/Sao_Paulo', 1)).toBe('2026-10-16')
    } finally {
      Date.now = realNow
    }
  })
})

describe('chunk and mapLimit', () => {
  it('chunks', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('keeps order and never exceeds the concurrency limit', async () => {
    let inFlight = 0
    let peak = 0
    const results = await mapLimit([30, 10, 20, 5, 15], 2, async (ms) => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await new Promise((r) => setTimeout(r, ms))
      inFlight--
      return ms * 2
    })
    expect(results).toEqual([60, 20, 40, 10, 30])
    expect(peak).toBe(2)
  })
})
