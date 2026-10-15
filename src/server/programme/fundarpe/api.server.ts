// Fundarpe (Pernambuco's culture foundation) sells Cinema São Luiz's tickets
// on ingressosfundarpe.com.br. Its API has no listing endpoint: the site asks
// for each event's sessions by `codPeca`, numbered sequentially across all of
// Fundarpe's venues, so the sync scans a window of codes around the newest
// one seen. Calls need FUNDARPE_API_KEY (a Worker secret).
import { env } from 'cloudflare:workers'
import { z } from 'zod'

const BASE = 'https://api.ingressosfundarpe.com.br/v1'
const USER_AGENT = 'lanterninha/1.0 (+https://lanterninha.review)'

const presentation = z.object({
  id_apresentacao: z.coerce.number(),
  /** "17/10" */
  day: z.string(),
  year: z.coerce.string(),
  /** "14:00" */
  HorSessao: z.string(),
  NomPeca: z.string(),
  ds_local_evento: z.string().nullish(),
  NomSala: z.string().nullish(),
  ValPeca: z.coerce.number().nullish(),
  in_esgotado_automatico: z.coerce.number().nullish(),
  in_esgotado_manual: z.coerce.number().nullish(),
})
export type FundarpePresentation = z.infer<typeof presentation>

/** Every upcoming session of one event; empty when the code is unused. */
export async function presentations(idBase: number, codPeca: number): Promise<FundarpePresentation[]> {
  const key = env.FUNDARPE_API_KEY
  if (!key) throw new Error('FUNDARPE_API_KEY is not set')
  const url = `${BASE}/event/presentation?id_base=${idBase}&codPeca=${codPeca}&apikey=${encodeURIComponent(key)}`
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  })
  // Never echo the URL: it carries the key.
  if (!res.ok) throw new Error(`Fundarpe ${res.status} for codPeca ${codPeca}`)
  const body: unknown = await res.json()
  if (!Array.isArray(body)) return []
  return body.flatMap((raw) => {
    const parsed = presentation.safeParse(raw)
    return parsed.success ? [parsed.data] : []
  })
}

/** "17/10" + "2026" → "2026-10-17". */
export function isoDay(day: string, year: string) {
  const [d, m] = day.split('/')
  return d && m ? `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` : null
}
