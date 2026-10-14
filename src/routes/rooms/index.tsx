import { Link, createFileRoute, stripSearchParams, useNavigate } from '@tanstack/react-router'
import { searchRooms } from '~/functions/rooms.functions'
import { FORMATS, FORMAT_IDS, STATES } from '~/lib/domain'
import { pluralize } from '~/lib/format'
import { EXPLORE_DEFAULTS, exploreSearchSchema, type ExploreSearch } from '~/lib/schemas'
import { RoomCard } from '~/components/room-card'

// Reuse the route's own schema to turn raw <select> values into typed params.
const fields = exploreSearchSchema.shape

const SORT_LABELS: Record<ExploreSearch['sort'], string> = {
  rating: 'Melhor nota',
  reviews: 'Mais avaliadas',
  recent: 'Avaliadas recentemente',
  name: 'Nome do cinema',
}

// SSR: full. Search params are validated (and invalid values coerced to
// defaults) before the loader runs; `loaderDeps` makes them the cache key.
export const Route = createFileRoute('/rooms/')({
  validateSearch: exploreSearchSchema,
  search: { middlewares: [stripSearchParams(EXPLORE_DEFAULTS)] },
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => searchRooms({ data: deps }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `Explorar ${pluralize(loaderData.total, 'sala', 'salas')} · Lanterninha`
          : 'Explorar salas · Lanterninha',
      },
    ],
  }),
  component: ExplorePage,
})

function ExplorePage() {
  const { rooms, total, page, pageCount, cities } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  const setFilter = (patch: Partial<ExploreSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch, page: 1 }), replace: true })

  const hasFilters = Boolean(search.q || search.state || search.city || search.format)

  return (
    <>
      <header className="page-head">
        <p className="eyebrow">Explorar</p>
        <h1>Salas de cinema</h1>
        <p className="muted">{pluralize(total, 'sala encontrada', 'salas encontradas')}</p>
      </header>

      {/* A plain GET form: works before hydration, and the router validates whatever it submits. */}
      <form
        method="get"
        action="/rooms"
        className="filters"
        onSubmit={(e) => {
          e.preventDefault()
          const q = new FormData(e.currentTarget).get('q')?.toString().trim()
          setFilter({ q: q || undefined })
        }}
      >
        <label className="field field-grow">
          <span>Busca</span>
          <input name="q" defaultValue={search.q ?? ''} placeholder="Cinema, bairro, rede…" key={search.q} />
        </label>

        <label className="field">
          <span>Cidade</span>
          <select
            name="city"
            value={search.city ?? ''}
            onChange={(e) => setFilter({ city: e.target.value || undefined })}
          >
            <option value="">Todas</option>
            {cities.map((c) => (
              <option key={c.city} value={c.city}>
                {c.city} ({c.rooms})
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>UF</span>
          <select
            name="state"
            value={search.state ?? ''}
            onChange={(e) => setFilter({ state: fields.state.parse(e.target.value) })}
          >
            <option value="">Todas</option>
            {STATES.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Formato</span>
          <select
            name="format"
            value={search.format ?? ''}
            onChange={(e) =>
              setFilter({ format: fields.format.parse(e.target.value) })
            }
          >
            <option value="">Todos</option>
            {FORMAT_IDS.map((f) => (
              <option key={f} value={f}>
                {FORMATS[f]}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Ordenar</span>
          <select
            name="sort"
            value={search.sort}
            onChange={(e) => setFilter({ sort: fields.sort.parse(e.target.value) })}
          >
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" className="button">
          Filtrar
        </button>
      </form>

      {hasFilters && (
        <p className="active-filters">
          <Link to="/rooms" search={{ sort: search.sort }}>
            Limpar filtros
          </Link>
        </p>
      )}

      {rooms.length === 0 ? (
        <section className="empty-state">
          <h2>Nenhuma sala por aqui… ainda</h2>
          <p className="muted">Tente outra cidade ou outro formato.</p>
        </section>
      ) : (
        <div className="grid">
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <nav className="pagination" aria-label="Paginação">
          <Link
            from={Route.fullPath}
            search={(prev) => ({ ...prev, page: page - 1 })}
            disabled={page <= 1}
            className="button button-ghost"
          >
            ← Anterior
          </Link>
          <span className="muted">
            Página {page} de {pageCount}
          </span>
          <Link
            from={Route.fullPath}
            search={(prev) => ({ ...prev, page: page + 1 })}
            disabled={page >= pageCount}
            className="button button-ghost"
          >
            Próxima →
          </Link>
        </nav>
      )}
    </>
  )
}
