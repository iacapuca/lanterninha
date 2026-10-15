# 🔦 Lanterninha

Crowd-sourced reviews of Brazilian cinema rooms — Letterboxd, but for the room
instead of the film. Rate picture, sound, seats and cleanliness in 🔦, and find
the row the community likes best.

Built with **TanStack Start** (React 19, file-based TanStack Router, typed
server functions, streaming SSR), **Better Auth**, **Drizzle ORM** and **D1**,
deployed to **Cloudflare Workers** at https://lanterninha.review (www and the
old `lanterninha.plpbs.workers.dev` redirect there).

The code is in English; the UI copy is in pt-BR.

```sh
pnpm install
cp .dev.vars.example .dev.vars   # BETTER_AUTH_SECRET, SLOW_QUERY_MS
pnpm ancine:download && pnpm ancine:build
pnpm db:migrate:local && pnpm db:import:local
pnpm demo:build && pnpm db:demo:local   # optional: fictional reviews, local only
pnpm dev          # http://localhost:3000 (SSR + local D1 run inside workerd)
pnpm typecheck
pnpm run deploy   # vite build && wrangler deploy
```

### Data

Venues come from ANCINE's open data, *Salas de Exibição e Complexos Registrados*
(monthly, CC BY): every open complex and room in Brazil, with seats and
accessibility. Coordinates come from municipality centroids
([kelvins/municipios-brasileiros](https://github.com/kelvins/municipios-brasileiros), MIT)
and, for capitals, OpenStreetMap Nominatim (© OpenStreetMap contributors, ODbL).

```sh
pnpm ancine:download      # fetch the latest CSV into db/ancine/ (git-ignored)
pnpm ancine:geocode       # address-level coordinates for capitals (cached in db/geo/geocode-cache.json)
pnpm ancine:build         # write db/ancine/import.sql
pnpm db:import:remote     # upsert venues into D1 (idempotent)
```

The import upserts by ANCINE registration number:
- **Friendly names:** "715 CINEMARK ELDORADO" becomes "Cinemark Eldorado", and
  "UCI RIBEIRO - S C R - 03" becomes "Sala 3".
- **Formats** are filled in only when ANCINE's name says so (IMAX, XD, VIP…).
- **Community votes survive re-imports.**
- **Closed rooms are removed,** unless they have reviews.

Demo reviews (`db/demo/`, `pnpm demo:build && pnpm db:demo:local`) are fictional,
placed on real rooms in 18 well-known venues, and for local development only:
production holds real reviews only. Demo users have no credentials.

### Database

```sh
pnpm db:generate          # drizzle-kit generate + copy into migrations/
pnpm db:migrate:remote    # wrangler d1 migrations apply --remote
```

drizzle-kit 1.x writes one folder per migration, but Wrangler applies flat
`.sql` files, so `db/sync-migrations.ts` copies `drizzle/*/migration.sql` into
`migrations/`. Review generated SQL before applying it. D1 ignores
`PRAGMA foreign_keys=OFF` inside migrations, so table rebuilds that drizzle-kit
emits can cascade. `20261014233241_ancine_and_room_facts` is hand-edited for
that reason, and `20261015020303_narrow_marvel_boy` (the ingresso_* tables
becoming provider-neutral) adds a `DEFAULT 'ingresso'` backfill so existing
rows survive the rename.

### What's playing (provider syncs)

Two Worker crons (`src/server.ts` → `src/server/programme/*/sync.server.ts`)
sync Ingresso.com and Velox Tickets into D1 incrementally. Each provider runs on
its own schedule — Ingresso every 5 minutes, Velox every 30 — so a single
invocation stays under the free plan's ~50-subrequest limit. Shared matching
and room-hint helpers live in `src/server/programme/shared.server.ts`, and both
write the same provider-neutral tables (`provider_city`, `provider_theater`,
`film`, `showtime`; film ids are namespaced, e.g. `velox:90050`).

**Ingresso.com** (content API, `partnership=lanterninha`):

1. **Cities:** the city list is refreshed weekly.
2. **Cinemas:** 3 cities' cinemas are refreshed per run. Each cinema is matched
   to an ANCINE cinema by **CNPJ**, falling back to within 600 m with a shared
   word in the name. A match brings exact coordinates and room-name hints
   ("Sala 1 - LASER", "Sala 7 - IMAX").
3. **Sessions:** today's and tomorrow's sessions are refreshed for 12 matched
   cinemas per run (`INGRESSO_THEATER_BATCH`). Sessions link to our rooms by
   room number. Session types fill in formats: a room that runs IMAX sessions
   is IMAX.
4. **Cleanup:** sessions that started more than 3 hours ago are deleted.

Ingresso's API sits behind Akamai, which answers `403` to requests egressing
from **production** Workers — the very calls pass from a home connection and,
confusingly, from `wrangler dev --remote` previews, so only a deployed cron
reveals the block (that's how the sync got re-enabled by mistake and then
re-diagnosed from the live logs). A day with nothing left to sell answers
`204`, which the client reads as the API's `null`. Matching was verified
locally: 19 of 22 cinemas matched, with real sessions on room and cinema
pages.

**Workaround (opt-in):** `INGRESSO_PROXY_URL` routes every call through a
relay outside Cloudflare — Akamai only blocks the Worker egress, not the
relay's. Any small always-on host works; a one-file
[Deno Deploy](https://dash.deno.com) (free) is enough:

```ts
// proxy.ts — deploy with: deno deploy proxy.ts
const UPSTREAM = 'https://api-content.ingresso.com'
Deno.serve(async (req) => {
  const { pathname, search } = new URL(req.url)
  const res = await fetch(UPSTREAM + pathname + search, {
    headers: { 'User-Agent': req.headers.get('user-agent') ?? '', Accept: 'application/json' },
  })
  return new Response(res.body, { status: res.status, headers: { 'content-type': 'application/json' } })
})
```

Then set `"INGRESSO_PROXY_URL": "https://<your-relay>.deno.dev/v0"` in
`wrangler.jsonc` and deploy. Until then the cron keeps retrying (and failing)
harmlessly, so the sync lights up the moment the relay is configured.

Requests identify themselves (`partnership=lanterninha` and a User-Agent).
Ingresso's integration guide says partners should register at
relacionamento@ingresso.com — a registered partnership may also lift the block
at the source.

**Velox Tickets** (veloxtickets.com, the ticketing portal behind Moviemax,
Centerplex and other regional chains) has no public API, but its ASP.NET portal
server-renders the full data model into every page as JavaScript literals.
Those literals are the de-facto API, and `src/server/programme/velox/api.server.ts`
extracts them:

1. **Cities:** the home page embeds every city Velox sells in.
2. **Venues:** `/Portal/Locais/Cinema/<city>` embeds the city's venues; each is
   matched to an ANCINE cinema by city + shared name tokens (Velox publishes
   neither CNPJ nor coordinates; the district field disambiguates multi-venue
   places like Fundação Joaquim Nabuco).
3. **Sessions:** one venue-day page per day covers every movie, room and
   session, including filters (LEG/DUB/3D…), sold-out flags and checkout URLs —
   three pages (days) per venue. Every matched venue is refreshed on each
   `*/30` run, `VELOX_CONCURRENCY` (2) page fetches at a time; `VELOX_THEATER_BATCH`
   caps venues per run. Past a few hundred venues, move to a Queue with one
   message per venue.
4. **Cleanup:** shared with Ingresso's.

`node --experimental-strip-types scripts/velox-smoke.ts` prints what the Velox
client currently extracts from the live portal, so upstream template changes
surface quickly.

**Somos Viva (Cine Apipucos).** Parque Apipucos's free open-air cinema publishes
its programme through the public calendar embedded on
apipucos.somosviva.com.br (`calendario.somosviva.com.br/api/events`). The
endpoint has no location or date filter and inlines posters as base64, so the
sync (`src/server/programme/somosviva/`) pages through it 50 events at a time,
keeps only Apipucos "Cinema" events, and runs at most every 6 h on the `*/30`
trigger. Posters are stored once in `film_poster` and served from
`/posters/<film id>`. The venue is linked to its ANCINE cinema by hand.

Room details resolve **community vote > provider > ANCINE name**. Rooms and
cinemas show an "Em cartaz" programme linking to the provider's checkout, with
times in the cinema's own time zone.

The dev server runs TanStack's default entry, so it has no `scheduled` handler.
To test the crons locally, use `pnpm build && pnpm exec vite preview`, then
`POST /cdn-cgi/local/explorer/api/local/scheduled?worker=lanterninha`.

### Community details and badges

ANCINE doesn't record screen type, projection or sound. Rooms show
"Adicione o tipo de tela" and similar calls to action, and signed-in users vote
from fixed options. A room shows the most-voted answer ("segundo N pessoas").
A value detected in ANCINE's name only gets overridden once 3 people disagree.

Badges are derived from contributions and reviews (`BADGES` in
`src/lib/domain.ts`), so there's no badge state to keep in sync. The profile
shows them as a collection of ticket stubs.

Badge artwork (`public/badges/<id>.png`) is a set of rubber stamps drawn once
with Workers AI (FLUX.2 [dev]) by `db/badges/generate.ts`, which also keys out
the paper so only the ink is left. The model draws no text; names live in HTML.
To redo one: delete `db/badges/raw/<id>.jpg`, then
`CLOUDFLARE_API_TOKEN=$(pnpm exec wrangler auth token) node db/badges/generate.ts <id>`,
and review with `node db/badges/sheet.ts /tmp/badges.png`.

### Auth

Better Auth with email + password and the `username` plugin. You register with
a username, email and password (accepting the Terms and Privacy policy), and
sign in with either the username or the email. The browser talks to
`/api/auth/*` through `authClient`. On the server, `auth.api.getSession()`
backs `getViewer` (root `beforeLoad`) and the `requireSession` middleware that
protects writes.

**Email** goes out through Cloudflare Email Service (the `EMAIL` send_email
binding, sender `nao-responda@lanterninha.review`, `src/server/email.server.ts`):
a confirmation link on sign-up and password-reset links
(`/forgot-password` → email → `/reset-password`). Confirming is encouraged, not
required. Locally, Miniflare writes sent emails under `.wrangler/tmp/email/`.

**Account and LGPD:** `/account` shows the email status (with resend), changes
the password, and deletes the account (reviews and votes cascade). Authors can
edit (`/rooms/<id>/review?edit=<review id>`) or delete their reviews. `/privacy`
and `/terms` are linked from the footer and sign-up; contact
`contato@lanterninha.review` (route it with Email Routing).

### Share previews

Cinema and room pages set Open Graph/Twitter tags with a 1200×630 PNG drawn on
the Worker (`/og/cinema/<id>`, `/og/room/<id>`, `/og/site` as the default): a
paper ticket with the name, place, chips and rating. satori (pinned to 0.32 —
later versions compile bundled HarfBuzz Wasm on import, which Workers forbid)
lays out JSX, resvg rasterizes; both Wasm files and the fonts (Fraunces,
Figtree, OFL) are bundled modules. Images are edge-cached for a day, and the
page adds `?v=<reviews>` so a new review gets a new card.

### UI

Tailwind CSS v4 with [shadcn/ui](https://ui.shadcn.com) (Radix base) for
interactive primitives: Button, Select, Popover, Command (city combobox) and
Sonner toasts. The theme tokens in `src/styles.css` map shadcn onto Lanterninha's
palette, with popovers printed on ticket paper. The bespoke ticket styles live in
`@layer components`, so Tailwind utilities can still override them. Add more
components with `pnpm dlx shadcn@latest add <name>`.

## Architecture

```
src/
  routes/                file-based routes (routeTree.gen.ts is generated)
  functions/*.functions.ts  createServerFn RPCs — the only client→server boundary
  functions/auth.middleware.ts  session check enforced on every private write
  server/*.server.ts     server-only code (auth, D1 client, schema, queries); import-protected
  lib/                   client-safe domain types, zod schemas, pt-BR formatting
  components/            tickets, 🔦 ratings, cards
db/                      seed data + scripts (not bundled)
drizzle/, migrations/    generated SQL (drizzle-kit output / Wrangler input)
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
`main` at `@tanstack/react-start/server-entry`. Only two modules import
`cloudflare:workers`: `server/db/client.server.ts` (the D1 binding) and
`server/auth.server.ts` (the secret). Moving to Node, Vercel or Netlify means
swapping the Vite plugin and those two modules (for example, D1 for libSQL or
Postgres through Drizzle), not the routes, loaders or server functions.

Secrets: `wrangler secret put BETTER_AUTH_SECRET`. The D1 binding is `DB`, and `pnpm cf-typegen` regenerates `worker-configuration.d.ts`.

## Known limitations

- No email verification or password reset yet (both need an email provider).
- Coordinates outside state capitals are the city centre, so distances are
  approximate (shown with ~). Run `node db/geo/geocode.ts --all` to geocode
  everything (about 30 minutes at Nominatim's rate limit).
- Formats come from ANCINE room names or community votes. Most rooms start unknown.
