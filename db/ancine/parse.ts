// Parses ANCINE's "Salas de Exibição e Complexos" CSV into open complexes and
// rooms with friendly names. Shared by geocode.ts and import.ts.
import { readFileSync } from 'node:fs'
import type { Format } from '../../src/lib/domain.ts'

export const CSV_PATH = 'db/ancine/salas-de-exibicao-e-complexos.csv'

export type AncineRoom = {
  ancineId: string
  rawName: string
  name: string
  format: Format | null
  seats: number
  wheelchairSeats: number
  reducedMobilitySeats: number
  largeSeats: number
  accessibleRestroom: boolean
  accessible: boolean
}

export type AncineComplex = {
  ancineId: string
  rawName: string
  name: string
  chain: string
  city: string
  state: string
  neighborhood: string
  address: string
  /** Street + number as filed, for geocoding. */
  street: string
  cep: string | null
  /** Digits only; the most common room CNPJ in the complex. */
  cnpj: string | null
  website: string | null
  rooms: AncineRoom[]
}

// ---------- CSV ----------

/** Minimal RFC 4180 parser for ';'-separated files (handles quoted fields). */
export function parseCsv(text: string, delimiter = ';'): Record<string, string>[] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === delimiter) {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field || row.length) rows.push([...row, field])
  const [header, ...body] = rows.filter((r) => r.some((v) => v.trim() !== ''))
  const keys = header!.map((h) => h.replace(/^﻿/, '').trim())
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])))
}

// ---------- Names ----------

export const fold = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim()

export const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

const LOWER = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'E', 'EM', 'NA', 'NO', 'NAS', 'NOS', 'À', 'AO'])
const UPPER = new Set([
  'UCI', 'IMAX', 'XD', 'VIP', '4DX', '3D', 'CEU', 'CEUS', 'GNC', 'AFA', 'JK', 'BH', 'II', 'III', 'IV',
  'CCBB', 'MIS', 'MAM', 'UFPE', 'UFMG', 'USP', 'UNB', 'UFRJ', 'UFF', 'SESI', 'SENAC', 'ABC', 'BR',
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE',
  'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
])
const BRANDS: Record<string, string> = {
  CINEPOLIS: 'Cinépolis', 'CINÉPOLIS': 'Cinépolis', CINEMARK: 'Cinemark', KINOPLEX: 'Kinoplex',
  CINESYSTEM: 'Cinesystem', CINESESC: 'CineSesc', SESC: 'Sesc', SPCINE: 'Spcine', CINEFLIX: 'Cineflix',
  MOVIECOM: 'Moviecom', CENTERPLEX: 'Centerplex', CINEART: 'Cineart', MOVIEMAX: 'Moviemax',
  ARCOPLEX: 'Arcoplex', CINESHOW: 'Cineshow', MULTICINE: 'Multicine', UNIPLEX: 'Uniplex',
  DELUX: 'DeLux', CINEMAIS: 'Cinemais', CINESERCLA: 'Cinesercla', MOBICINE: 'Mobicine',
}

/** "CINE BELAS ARTES - SALA 1" → "Cine Belas Artes - Sala 1", keeping acronyms and brands. */
export function titleCase(raw: string) {
  return raw
    .replace(/([,.])(?=[^\s\d.,])/g, '$1 ')
    .replace(/,(?=\d)/g, ', ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((word, i) => {
      const up = word.toUpperCase()
      if (BRANDS[up]) return BRANDS[up]
      // Codes like "4DX", "L4" or "BV.174" stay upper-case; numbers glued to words don't count.
      if (UPPER.has(up) || /^(?=.*\d)[\p{L}]{0,3}[\d.\/-]+[\p{L}]{0,3}$/u.test(word)) return up
      if (i > 0 && LOWER.has(up)) return word.toLowerCase()
      return word
        .toLowerCase()
        .replace(/(^|[-/(.'])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase())
    })
    .join(' ')
}

const COMPANY = /\b(LTDA|EIRELI|S\/A|S\.A\.|EMPRESA|CINEMATOGRAFI|ME$|EPP$)/

function complexName(raw: string, rooms: Record<string, string>[]) {
  let name = raw.replace(/^\d+\s+/, '') // Cinemark files complexes as "715 CINEMARK ELDORADO"
  // Some single-room complexes are filed under the company name; the room has the real name.
  if (COMPANY.test(fold(name)) && rooms.length === 1) name = rooms[0]!['NOME_SALA']!
  name = name.replace(/^UCI (BRASIL|RIBEIRO)\s*-\s*/i, 'UCI ')
  return titleCase(name)
}

function chainName(group: string, complex: string) {
  if (fold(complex).includes('SESC')) return 'Sesc'
  if (!group || fold(group).startsWith('NAO PERTENCE')) return 'Independente'
  if (fold(group).startsWith('UCI')) return 'UCI'
  return titleCase(group)
}

// ---------- Formats ----------

const FORMAT_PATTERNS: Array<[RegExp, Format, string]> = [
  [/(?<![A-Z0-9])IMAX(?![A-Z0-9])/, 'imax', 'IMAX'],
  [/(?<![A-Z0-9])4DX(?![A-Z0-9])/, '4dx', '4DX'],
  [/(?<![A-Z0-9])D-?BOX(?![A-Z0-9])/, 'dbox', 'D-BOX'],
  [/(?<![A-Z0-9])MACRO(\s*XE)?(?![A-Z0-9])/, 'macroxe', 'Macro XE'],
  [/(?<![A-Z0-9])XD(?![A-Z0-9])/, 'xd', 'XD'],
  [/(?<![A-Z0-9])PRIME(?![A-Z0-9])/, 'prime', 'Prime'],
  [/(?<![A-Z0-9])(STARVIP|VIP|PREMIER|PLATINUM|DELUX)(?![A-Z0-9])/, 'vip', 'VIP'],
]

/** Formats only count when ANCINE's own name says so; everything else stays unknown. */
export function detectFormat(...names: string[]): { format: Format; label: string } | null {
  const text = fold(names.join(' '))
  for (const [pattern, format, label] of FORMAT_PATTERNS) if (pattern.test(text)) return { format, label }
  return null
}

// ---------- Rooms ----------

/** Pulls the room number out of names like "UCI RIBEIRO - S C R - 03" or "SALA RIOMAR 1 - 4DX". */
function roomNumber(raw: string): number | null {
  const name = fold(raw).replace(/(?<![A-Z0-9])(4DX|3D|4D|2D|D-?BOX)(?![A-Z0-9])/g, ' ')
  const sala = name.match(/SALA\s*0*(\d{1,2})(?!\d)/)
  if (sala) return Number(sala[1])
  const numbers = [...name.matchAll(/(?<![\d.])0*(\d{1,2})(?![\d.])/g)].map((m) => Number(m[1]))
  const last = numbers.at(-1)
  return last != null && last > 0 && last <= 40 ? last : null
}

function roomNames(rawRooms: Record<string, string>[], complex: string) {
  const names = rawRooms.map((r) => {
    const raw = r['NOME_SALA']!
    const detected = detectFormat(raw)
    const n = roomNumber(raw)
    if (rawRooms.length === 1 && n == null) return detected ? `Sala ${detected.label}` : 'Sala única'
    if (n != null) return detected ? `Sala ${n} ${detected.label}` : `Sala ${n}`
    if (detected) return `Sala ${detected.label}`
    // No number: drop the complex name if the room repeats it, keep what's left.
    const rest = fold(raw).replace(fold(complex), '').replace(/^[\s-]+|[\s-]+$/g, '')
    return rest ? titleCase(rest) : titleCase(raw)
  })
  // Guarantee unique names inside a complex.
  const seen = new Map<string, number>()
  return names.map((name) => {
    const count = (seen.get(name) ?? 0) + 1
    seen.set(name, count)
    return count === 1 ? name : `${name} (${count})`
  })
}

function mostCommon(values: string[]) {
  const counts = new Map<string, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

const int = (v: string | undefined) => (v && /^\d+$/.test(v) ? Number(v) : 0)
const yes = (v: string | undefined) => fold(v ?? '') === 'SIM'

function website(raw: string) {
  const v = raw.trim().replace(/\s/g, '').replace(/,/g, '.')
  if (!v || !/\.[a-z]{2,}/i.test(v)) return null
  const url = /^https?:\/\//i.test(v) ? v : `https://${v}`
  try {
    return new URL(url).toString()
  } catch {
    return null
  }
}

// ---------- Entry point ----------

export function loadOpenComplexes(path = CSV_PATH): AncineComplex[] {
  const rows = parseCsv(readFileSync(path, 'utf8')).filter((r) => r['SITUACAO_SALA'] === 'EM FUNCIONAMENTO')
  const byComplex = new Map<string, Record<string, string>[]>()
  for (const r of rows) {
    const list = byComplex.get(r['REGISTRO_COMPLEXO']!) ?? []
    list.push(r)
    byComplex.set(r['REGISTRO_COMPLEXO']!, list)
  }

  return [...byComplex.entries()]
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([ancineId, raw]) => {
      raw.sort((a, b) => Number(a['REGISTRO_SALA']) - Number(b['REGISTRO_SALA']))
      const first = raw[0]!
      const name = complexName(first['NOME_COMPLEXO']!, raw)
      const names = roomNames(raw, first['NOME_COMPLEXO']!)
      const number = first['NUMERO_ENDERECO_COMPLEXO']
      const street = [first['ENDERECO_COMPLEXO'], number && !first['ENDERECO_COMPLEXO']!.includes(number) ? number : '']
        .filter(Boolean)
        .join(', ')
      const complement = first['COMPLEMENTO_COMPLEXO']
      return {
        ancineId,
        rawName: first['NOME_COMPLEXO']!,
        name,
        chain: chainName(first['NOME_GRUPO_EXIBIDOR']!, first['NOME_COMPLEXO']!),
        city: titleCase(first['MUNICIPIO_COMPLEXO']!),
        state: first['UF_COMPLEXO']!,
        neighborhood: titleCase(first['BAIRRO_COMPLEXO'] ?? ''),
        address: titleCase([street, complement].filter(Boolean).join(' - ')),
        street,
        cep: /^\d{5}-?\d{3}$/.test(first['CEP_COMPLEXO'] ?? '') ? first['CEP_COMPLEXO']!.replace(/^(\d{5})(\d{3})$/, '$1-$2') : null,
        website: website(first['PAGINA_ELETRONICA_COMPLEXO'] ?? ''),
        cnpj: mostCommon(raw.map((r) => (r['CNPJ_SALA'] ?? '').replace(/\D/g, '')).filter((c) => c.length === 14)),
        rooms: raw
          .map((r, i) => {
          const wheelchairSeats = int(r['ASSENTOS_CADEIRANTES'])
          const rampToSeats = yes(r['ACESSO_ASSENTOS_COM_RAMPA'])
          const rampToRoom = yes(r['ACESSO_SALA_COM_RAMPA'])
          return {
            ancineId: r['REGISTRO_SALA']!,
            rawName: r['NOME_SALA']!,
            name: names[i]!,
            // IMAX venues sometimes only say so in the complex name ("IMAX PALLADIUM").
            format: detectFormat(r['NOME_SALA']!, raw.length === 1 ? r['NOME_COMPLEXO']! : '')?.format ?? null,
            seats: int(r['ASSENTOS_SALA']),
            wheelchairSeats,
            reducedMobilitySeats: int(r['ASSENTOS_MOBILIDADE_REDUZIDA']),
            largeSeats: int(r['ASSENTOS_OBESIDADE']),
            accessibleRestroom: yes(r['BANHEIROS_ACESSIVEIS']),
            accessible: wheelchairSeats > 0 && (rampToSeats || rampToRoom),
          }
          })
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true })),
      }
    })
}

// ---------- Stable ids ----------

export type IdentifiedComplex = AncineComplex & { id: string; rooms: Array<AncineRoom & { id: string }> }

/**
 * Readable, deterministic slugs ("cinemark-eldorado", "cinemark-eldorado-sala-7").
 * Collisions fall back to the city, then the ANCINE number. Complexes are processed
 * in registration order, so ids are stable across imports.
 */
export function assignIds(complexes: AncineComplex[]): IdentifiedComplex[] {
  const taken = new Set<string>()
  const claim = (...candidates: string[]) => {
    const id = candidates.find((c) => c && !taken.has(c))!
    taken.add(id)
    return id
  }
  return complexes.map((c) => {
    const base = slugify(c.name)
    const id = claim(base, `${base}-${slugify(c.city)}`, `${base}-${c.ancineId}`)
    return {
      ...c,
      id,
      rooms: c.rooms.map((r) => ({ ...r, id: claim(`${id}-${slugify(r.name)}`, `${id}-${r.ancineId}`) })),
    }
  })
}
