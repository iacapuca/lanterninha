# 🔦 Lanterninha

Crowd-sourced reviews of Brazilian cinema rooms — Letterboxd, but for the room
instead of the film. Rate picture, sound, seats and cleanliness in 🔦, and find
the row the community likes best.

Built with **TanStack Start** (React 19, file-based TanStack Router, typed
server functions, streaming SSR), deployed to **Cloudflare Workers**.

The code is in English; the UI copy is in pt-BR.

```sh
pnpm install
cp .dev.vars.example .dev.vars
pnpm dev          # http://localhost:3000 (SSR runs inside workerd)
pnpm typecheck
pnpm run deploy   # vite build && wrangler deploy
```

## Architecture

```
src/
  routes/                file-based routes (routeTree.gen.ts is generated)
  functions/*.functions.ts  createServerFn RPCs — the only client→server boundary
  functions/auth.middleware.ts  session check enforced on every private write
  server/*.server.ts     server-only code (store, seed, session); import-protected
  lib/                   client-safe domain types, zod schemas, pt-BR formatting
  components/            tickets, 🔦 ratings, cards
```

**Server boundary.** Route loaders are isomorphic, so they only ever call server
functions. Everything that touches data or secrets lives in `*.server.ts` files,
which Start's import protection keeps out of the client bundle. Writes go
through `requireSession` middleware; `beforeLoad` redirects are only UX.

**Validation.** One set of zod schemas (`src/lib/schemas.ts`) is used for
`validateSearch` on routes and `.validator()` on server functions. Invalid search
params are coerced to defaults, and defaults are stripped from URLs.

### SSR mode per route

| Route | SSR | Why |
| --- | --- | --- |
| `/` | full + streaming | Top rooms are in the HTML; the recent-reviews feed streams in |
| `/rooms` | full | Filterable, shareable, SEO-relevant listing |
| `/rooms/$roomId` | full + streaming | Room is awaited (head, JSON-LD, 404); stats and reviews stream |
| `/rooms/$roomId/review` | `data-only` | Auth and room lookup run on the server; the form restores a localStorage draft, so it renders on the client only |
| `/nearby` | `false` | Built on the Geolocation API and has no SEO value |
| `/cinemas/$id`, `/users/$username`, `/sign-in` | full | Small pages, nothing worth deferring |
| `/sitemap.xml`, `/robots.txt` | server routes | Raw HTTP handlers |

Crawlers get fully resolved HTML; browsers get the shell first and the streamed
sections afterwards.

### Deployment target

`vite.config.ts` uses `@cloudflare/vite-plugin`, and `wrangler.jsonc` points
`main` at `@tanstack/react-start/server-entry`. App code only uses Web APIs
(Web Crypto, `fetch`) and reads env per request, so moving to Node, Vercel or
Netlify means changing the Vite plugin (`nitro()` from `nitro/vite` or the
Netlify plugin), not the routes or server functions.

Secrets: `wrangler secret put SESSION_SECRET`.

## Known limitations (demo)

- **Storage is in memory** (`src/server/store.server.ts`). On Workers each
  isolate has its own copy, so new reviews are not shared between isolates and
  are lost on restart. Next step: move the store functions onto D1; their
  signatures already form the seam.
- Sign-in is nickname-only (signed cookie, no password).
- Venues are real; reviews and usernames are generated demo data.
