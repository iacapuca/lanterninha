// Contact sheet for reviewing the badges on both backgrounds they appear on:
// paper (earned) above, the dark page (locked) below.
//   node db/badges/sheet.ts /tmp/badges.png
import { readdirSync } from 'node:fs'
import sharp from 'sharp'

const out = process.argv[2] ?? 'badges-sheet.png'
const dir = 'public/badges'
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.png'))
  .sort()
const tile = 200
const overlays = await Promise.all(
  files.flatMap((f, i) =>
    [0, tile].map(async (top) => ({
      input: await sharp(`${dir}/${f}`).resize(176, 176).toBuffer(),
      left: i * tile + 12,
      top: top + 12,
    })),
  ),
)
const bg = `<svg xmlns="http://www.w3.org/2000/svg" width="${files.length * tile}" height="${tile * 2}"><rect width="100%" height="${tile}" fill="#f3e7d0"/><rect y="${tile}" width="100%" height="${tile}" fill="#1c1511"/></svg>`
await sharp(Buffer.from(bg)).composite(overlays).png().toFile(out)
console.log(files.join(' '))
