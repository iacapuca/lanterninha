// Address-level geocoding for ANCINE complexes via OpenStreetMap Nominatim.
// Results © OpenStreetMap contributors (ODbL), so the app credits OSM.
// Respects the usage policy: ≤1 request/second, identifying User-Agent, and
// a committed cache (geocode-cache.json) so nothing is ever looked up twice.
//
//   node db/geo/geocode.ts            → complexes in state capitals
//   node db/geo/geocode.ts --all      → every open complex (~30 min)
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { loadOpenComplexes, type AncineComplex } from '../ancine/parse.ts'
import { distanceKm, findMunicipality, stateName } from './municipalities.ts'

const CACHE = 'db/geo/geocode-cache.json'
const USER_AGENT = 'lanterninha-importer/1.0 (+https://lanterninha.plpbs.workers.dev)'
const MAX_KM_FROM_CITY = 60

type Hit = { lat: number; lng: number; via: 'address' | 'name'; label: string }
type Cache = Record<string, Hit | null>

const cache: Cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {}
const save = () => writeFileSync(CACHE, JSON.stringify(cache, Object.keys(cache).sort(), 2) + '\n')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function nominatim(params: Record<string, string>) {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  for (const [k, v] of Object.entries({ ...params, format: 'jsonv2', limit: '1', countrycodes: 'br' })) {
    url.searchParams.set(k, v)
  }
  await sleep(1100)
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'pt-BR' } })
  if (res.status === 429 || res.status >= 500) throw new Error(`Nominatim ${res.status}`)
  const [hit] = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>
  return hit ? { lat: Number(hit.lat), lng: Number(hit.lon), label: hit.display_name } : null
}

async function geocode(c: AncineComplex): Promise<Hit | null> {
  const city = findMunicipality(c.city, c.state)
  const plausible = (h: { lat: number; lng: number } | null) =>
    h && (!city || distanceKm(h, city) <= MAX_KM_FROM_CITY) ? h : null

  // 1) Structured street address (drop "Loja 410"-style complements).
  const street = c.street.replace(/\s*-\s*(LOJA|LJ|SALA|PISO|L\d).*$/i, '')
  // (No postalcode: Nominatim ANDs every field and Brazilian CEPs are sparse in OSM.)
  const byAddress =
    plausible(await nominatim({ street, city: c.city, state: stateName(c.state) })) ??
    plausible(await nominatim({ q: `${street}, ${c.city}, ${c.state}` }))
  if (byAddress) return { ...byAddress, via: 'address', label: (byAddress as Hit).label }

  // 2) The venue itself, which OSM often knows by name (malls, cultural centres).
  const byName = plausible(await nominatim({ q: `${c.name}, ${c.city}, ${c.state}` }))
  if (byName) return { ...byName, via: 'name', label: (byName as Hit).label }
  return null
}

const all = process.argv.includes('--all')
const targets = loadOpenComplexes().filter(
  (c) => !(c.ancineId in cache) && (all || findMunicipality(c.city, c.state)?.capital),
)
console.log(`${targets.length} complexes to geocode (${Object.keys(cache).length} cached)`)

let found = 0
for (const [i, c] of targets.entries()) {
  try {
    const hit = await geocode(c)
    cache[c.ancineId] = hit
    if (hit) found++
    console.log(`[${i + 1}/${targets.length}] ${hit ? hit.via.padEnd(7) : 'miss   '} ${c.name} — ${c.city}/${c.state}`)
  } catch (error) {
    console.error(`stopping: ${String(error)}`)
    break
  }
  if (i % 10 === 9) save()
}
save()
console.log(`done: ${found}/${targets.length} found`)
