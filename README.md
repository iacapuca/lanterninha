# 🔦 Lanterninha

Crowd-sourced reviews of Brazilian cinema rooms — Letterboxd, but for the room
instead of the film. Rate picture, sound, seats and cleanliness in 🔦, and find
the row the community likes best.

Built with **TanStack Start** (React 19, file-based TanStack Router, typed
server functions, streaming SSR), **Better Auth**, **Drizzle ORM** and **D1**,
deployed to **Cloudflare Workers**.

The code is in English; the UI copy is in pt-BR.

```sh
pnpm install
cp .dev.vars.example .dev.vars   # BETTER_AUTH_SECRET, SLOW_QUERY_MS
pnpm ancine:download && pnpm ancine:build
pnpm db:migrate:local && pnpm db:import:local
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
pnpm ancine:build         # write db/ancine/import.sql + db/demo/seed.sql
pnpm db:import:remote     # upsert venues and demo reviews into D1 (idempotent)
```

The import upserts by ANCINE registration number:
- **Friendly names:** "715 CINEMARK ELDORADO" becomes "Cinemark Eldorado", and
  "UCI RIBEIRO - S C R - 03" becomes "Sala 3".
- **Formats** are filled in only when ANCINE's name says so (IMAX, XD, VIP…).
- **Community votes survive re-imports.**
- **Closed rooms are removed,** unless they have reviews.

Demo reviews (`db/demo/`) are fictional and placed on real rooms in 18 well-known
venues. Demo users have no credentials.

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
that reason.

### Community details and badges

ANCINE doesn't record screen type, projection or sound. Rooms show
"Adicione o tipo de tela" and similar calls to action, and signed-in users vote
from fixed options. A room shows the most-voted answer ("segundo N pessoas").
A value detected in ANCINE's name only gets overridden once 3 people disagree.

Badges are derived from contributions and reviews (`BADGES` in
`src/lib/domain.ts`), so there's no badge state to keep in sync. The profile
shows them as a collection of ticket stubs.

### Auth

Better Auth with email + password and the `username` plugin: the simplest
setup that needs no email provider or OAuth app. You register with a username,
email and password, and sign in with either the username or the email. The
browser talks to `/api/auth/*` through `authClient`. On the server,
`auth.api.getSession()` backs `getViewer` (root `beforeLoad`) and the
`requireSession` middleware that protects writes.

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
