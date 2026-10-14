// Downloads ANCINE's monthly "Salas de Exibição e Complexos Registrados" open
// dataset (one row per room, with its complex and exhibitor). Licence: CC-BY;
// credit "Fonte: ANCINE" wherever the data is shown.
// Catalogue: https://dados.gov.br/dados/conjuntos-dados/salas-de-exibicao-e-complexos-registrados-na-ancine
import { mkdirSync, writeFileSync } from 'node:fs'

const URL = 'https://dados.ancine.gov.br/dados-abertos/salas-de-exibicao-e-complexos.csv'
const OUT = 'db/ancine/salas-de-exibicao-e-complexos.csv'

const res = await fetch(URL)
if (!res.ok) throw new Error(`ANCINE download failed: ${res.status} ${res.statusText}`)
const body = Buffer.from(await res.arrayBuffer())
mkdirSync('db/ancine', { recursive: true })
writeFileSync(OUT, body)
console.log(`${OUT}: ${(body.length / 1024).toFixed(0)} KiB, ${body.toString('utf8').split('\n').length - 1} rows`)
