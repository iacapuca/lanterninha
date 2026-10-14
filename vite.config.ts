import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import viteReact from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

// Deployment target: Cloudflare Workers. The SSR environment runs inside
// workerd in dev and build, so local behaviour matches production.
// The application model (routes, loaders, server functions) does not depend
// on this: to target Node/Vercel/Netlify instead, swap `cloudflare()` for
// `nitro()` from 'nitro/vite' (or the Netlify plugin) — no app code changes.
export default defineConfig({
  plugins: [
    tsconfigPaths(),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tanstackStart(),
    viteReact(),
  ],
})
