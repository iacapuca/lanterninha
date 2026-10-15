// Municipality centroids (IBGE codes, lat/lng) from kelvins/municipios-brasileiros (MIT).
import { readFileSync } from 'node:fs'
import { fold, parseCsv } from '../ancine/parse.ts'

export type Municipality = { name: string; state: string; lat: number; lng: number; capital: boolean }

const states = parseCsv(readFileSync('db/geo/estados.csv', 'utf8'), ',')
const stateByCode = new Map(states.map((s) => [s['codigo_uf']!, s]))

const municipalities = new Map<string, Municipality>(
  parseCsv(readFileSync('db/geo/municipios.csv', 'utf8'), ',').map((m) => {
    const state = stateByCode.get(m['codigo_uf']!)!['uf']!
    return [
      `${fold(m['nome']!)}|${state}`,
      {
        name: m['nome']!,
        state,
        lat: Number(m['latitude']),
        lng: Number(m['longitude']),
        capital: m['capital'] === '1',
      },
    ]
  }),
)

/** ANCINE spellings that differ from IBGE's. */
const ALIASES: Record<string, string> = { 'CAMPOS DOS GOITACAZES|RJ': 'CAMPOS DOS GOYTACAZES|RJ' }

export function findMunicipality(city: string, state: string) {
  const key = `${fold(city)}|${state}`
  return municipalities.get(ALIASES[key] ?? key) ?? null
}

export function stateName(uf: string) {
  return states.find((s) => s['uf'] === uf)?.['nome'] ?? uf
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (d: number) => (d * Math.PI) / 180
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}
