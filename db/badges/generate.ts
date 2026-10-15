// Generates the badge artwork with Cloudflare Workers AI (FLUX.2 [dev]) and
// turns each stamp into a transparent PNG: the paper is estimated from the
// image's border and keyed out, leaving only the ink. Run once, review, commit:
//
//   CLOUDFLARE_API_TOKEN=$(pnpm exec wrangler auth token) node db/badges/generate.ts [badge-id…]
//
// Raw generations are cached in db/badges/raw/ (git-ignored); delete one to
// regenerate it. Text is never drawn by the model: badge names are HTML.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'
import { BADGES } from '../../src/lib/domain.ts'

const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID ?? '9f7fa9c20147e7cb8bf168bd5bbf2185'
const TOKEN = process.env.CLOUDFLARE_API_TOKEN
const MODEL = '@cf/black-forest-labs/flux-2-dev'
const RAW = 'db/badges/raw'
const OUT = 'public/badges'
const SIZE = 256

const SUBJECTS: Record<(typeof BADGES)[number]['id'], string> = {
  'first-review': 'a striped bucket of popcorn',
  regular:
    "a cinema usherette's torch: a slim vintage metal flashlight held low in a white-gloved hand, its cone of light falling diagonally across a row of cinema seats",
  traveler: 'a vintage compass rose whose centre is a film reel',
  'screen-spotter': 'a cinema screen with theatre curtains on both sides',
  'screen-inspector': 'a wide cinema screen with a measuring tape stretched across its width',
  projectionist: 'a vintage film projector with two reels',
  'sharp-ears': 'a pair of over-ear headphones with small sound waves',
  trailblazer: 'a small pennant flag planted on the armrest of a single red cinema seat',
}

const prompt = (subject: string) =>
  `A circular rubber stamp emblem printed on cream paper (#f3e7d0). Subject in the center: ${subject}. ` +
  'Style: vintage cinema ticket stamp, letterpress, two-color only: deep ticket red (#a8231b) ink for the subject ' +
  'and dark brown (#2b1a10) ink for the rings, bold simple linework, double concentric ring border with a ring of ' +
  'small stars between the rings, slightly worn and uneven ink texture, flat, centered, fills most of the frame, ' +
  'no text, no letters, no words, no numbers, plain cream background filling the whole image.'

async function generate(id: string, subject: string) {
  const file = `${RAW}/${id}.jpg`
  if (existsSync(file)) return readFileSync(file)
  if (!TOKEN) throw new Error('Set CLOUDFLARE_API_TOKEN (e.g. $(pnpm exec wrangler auth token))')
  const form = new FormData()
  form.set('prompt', prompt(subject))
  form.set('width', '768')
  form.set('height', '768')
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai/run/${MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: form,
  })
  const body = (await res.json()) as { success: boolean; errors: unknown; result?: { image?: string } }
  if (!body.success || !body.result?.image) throw new Error(`${id}: ${JSON.stringify(body.errors)}`)
  const bytes = Buffer.from(body.result.image, 'base64')
  writeFileSync(file, bytes)
  return bytes
}

/** Keys out the paper: alpha from how much darker than the paper a pixel is; colour un-mixed from the paper. */
async function inkOnly(input: Buffer) {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height } = info
  const px = (x: number, y: number) => (y * width + x) * 3
  // Paper colour: median of a thin frame around the edge.
  const samples: number[][] = [[], [], []]
  for (let x = 0; x < width; x += 4)
    for (const y of [2, height - 3]) for (let c = 0; c < 3; c++) samples[c]!.push(data[px(x, y) + c]!)
  for (let y = 0; y < height; y += 4)
    for (const x of [2, width - 3]) for (let c = 0; c < 3; c++) samples[c]!.push(data[px(x, y) + c]!)
  const paper = samples.map((s) => s.sort((a, b) => a - b)[s.length >> 1]!)
  const lum = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b
  const paperLum = lum(paper[0]!, paper[1]!, paper[2]!)

  const out = Buffer.alloc(width * height * 4)
  for (let i = 0, o = 0; i < data.length; i += 3, o += 4) {
    const r = data[i]!,
      g = data[i + 1]!,
      b = data[i + 2]!
    // Ink shows up as darkness relative to the paper; ignore the faint vignette.
    const ink = Math.max(0, paperLum - lum(r, g, b) - 14) / Math.max(1, paperLum - 60)
    const a = Math.min(1, ink * 1.25)
    if (a < 0.04) continue
    for (let c = 0; c < 3; c++) {
      const v = data[i + c]!
      out[o + c] = Math.max(0, Math.min(255, Math.round((v - (1 - a) * paper[c]!) / a)))
    }
    out[o + 3] = Math.round(a * 255)
  }
  return sharp(out, { raw: { width, height, channels: 4 } })
    .trim({ threshold: 1 })
    .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toBuffer()
}

mkdirSync(RAW, { recursive: true })
mkdirSync(OUT, { recursive: true })
const only = process.argv.slice(2)
for (const badge of BADGES) {
  if (only.length && !only.includes(badge.id)) continue
  const raw = await generate(badge.id, SUBJECTS[badge.id])
  const png = await inkOnly(raw)
  writeFileSync(`${OUT}/${badge.id}.png`, png)
  console.log(`${badge.id}: ${(png.length / 1024).toFixed(1)} KB`)
}
