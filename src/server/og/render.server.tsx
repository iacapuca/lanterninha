// Share-preview images (Open Graph, 1200×630 PNG) drawn on the Worker:
// satori lays out JSX into SVG, resvg rasterizes it. Workers can't compile
// Wasm from bytes at runtime, so both engines come in as precompiled modules.
// satori is pinned to 0.32: from 0.33 it bundles HarfBuzz as inline Wasm
// that it compiles on import, which Workers refuse.
// Fonts (Fraunces, Figtree; SIL OFL) are bundled as binary data modules.
import { Resvg, initWasm } from '@resvg/resvg-wasm'
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm'
import satori, { init as initSatori } from 'satori/standalone'
import yogaWasm from 'satori/yoga.wasm'
import type { ReactNode } from 'react'
import figtree400 from './fonts/figtree-400.bin'
import figtree600 from './fonts/figtree-600.bin'
import fraunces900 from './fonts/fraunces-900.bin'

export const OG_WIDTH = 1200
export const OG_HEIGHT = 630

let ready: Promise<void> | null = null
const engines = () => (ready ??= Promise.all([initSatori(yogaWasm), initWasm(resvgWasm)]).then(() => undefined))

const FONTS = [
  { name: 'Fraunces', data: fraunces900, weight: 900 as const, style: 'normal' as const },
  { name: 'Figtree', data: figtree600, weight: 600 as const, style: 'normal' as const },
  { name: 'Figtree', data: figtree400, weight: 400 as const, style: 'normal' as const },
]

export async function renderPng(node: ReactNode) {
  await engines()
  const svg = await satori(node, { width: OG_WIDTH, height: OG_HEIGHT, fonts: FONTS })
  return new Resvg(svg, { fitTo: { mode: 'width', value: OG_WIDTH } }).render().asPng()
}
