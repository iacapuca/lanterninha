import { describe, expect, it } from 'vitest'
import { complexName, detectFormat, titleCase } from '../db/ancine/parse.ts'

describe('ANCINE names', () => {
  it.each([
    ['715 CINEMARK ELDORADO', 'Cinemark Eldorado'],
    ['715 - CINEMARK DIAMOND', 'Cinemark Diamond'],
    ['UCI BRASIL - NEW YORK CITY CENTER', 'UCI New York City Center'],
  ])('%s → %s', (raw, name) => {
    expect(complexName(raw, [{}, {}])).toBe(name)
  })

  it('title-cases with Portuguese particles and codes', () => {
    expect(titleCase('CINEMA DA FUNDACAO DO DERBY')).toBe('Cinema da Fundacao do Derby')
    expect(titleCase('SALA 4DX')).toBe('Sala 4DX')
  })

  it('detects formats from room names', () => {
    expect(detectFormat('SALA 3 IMAX')?.format).toBe('imax')
    expect(detectFormat('SALA 1')).toBeNull()
  })
})
