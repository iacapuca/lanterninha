import { useState } from 'react'
import { Link, createFileRoute, stripSearchParams, useNavigate } from '@tanstack/react-router'
import { ChevronsUpDownIcon } from 'lucide-react'
import { searchCinemas } from '~/functions/rooms.functions'
import { FORMATS, FORMAT_IDS, STATES, type State } from '~/lib/domain'
import { pluralize } from '~/lib/format'
import { EXPLORE_DEFAULTS, exploreSearchSchema, type ExploreSearch } from '~/lib/schemas'
import { CinemaCard } from '~/components/cinema-card'
import { Button } from '~/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '~/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'

// Reuse the route's own schema to turn raw <select> values into typed params.
const fields = exploreSearchSchema.shape

const SORT_LABELS: Record<ExploreSearch['sort'], string> = {
  rating: 'Melhor nota',
  reviews: 'Mais avaliadas',
  recent: 'Avaliadas recentemente',
  name: 'Nome',
}

// SSR: full. Search params are validated (and invalid values coerced to
// defaults) before the loader runs; `loaderDeps` makes them the cache key.
export const Route = createFileRoute('/cinemas/')({
  validateSearch: exploreSearchSchema,
  search: { middlewares: [stripSearchParams(EXPLORE_DEFAULTS)] },
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => searchCinemas({ data: deps }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `Explorar ${pluralize(loaderData.total, 'cinema', 'cinemas')} · Lanterninha`
          : 'Explorar cinemas · Lanterninha',
      },
    ],
  }),
  component: ExplorePage,
})

function ExplorePage() {
  const { cinemas, total, page, pageCount, cities } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  const setFilter = (patch: Partial<ExploreSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch, page: 1 }), replace: true })

  const hasFilters = Boolean(search.q || search.state || search.city || search.format)

  return (
    <>
      <header className="page-head">
        <p className="eyebrow">Explorar</p>
        <h1>Cinemas</h1>
        <p className="muted">{pluralize(total, 'cinema encontrado', 'cinemas encontrados')}</p>
      </header>

      {/* A plain GET form: works before hydration, and the router validates whatever it submits. */}
      <form
        method="get"
        action="/cinemas"
        className="filters"
        onSubmit={(e) => {
          e.preventDefault()
          const q = new FormData(e.currentTarget).get('q')?.toString().trim()
          setFilter({ q: q || undefined })
        }}
      >
        <label className="field field-grow">
          <span>Busca</span>
          <input name="q" defaultValue={search.q ?? ''} placeholder="Cinema, sala, bairro, rede…" key={search.q} />
        </label>

        <div className="field">
          <span>UF</span>
          <Select
            value={search.state ?? ALL}
            onValueChange={(v) => setFilter({ state: fields.state.parse(v === ALL ? '' : v), city: undefined })}
          >
            <SelectTrigger className="h-10! w-full" aria-label="UF">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas</SelectItem>
              {STATES.map((uf) => (
                <SelectItem key={uf} value={uf}>
                  {uf}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="field field-city">
          <span>Cidade</span>
          <CityCombobox
            cities={cities}
            city={search.city}
            state={search.state}
            onChange={(c) => setFilter(c ? { city: c.city, state: c.state } : { city: undefined })}
          />
        </div>

        <div className="field">
          <span>Formato</span>
          <Select
            value={search.format ?? ALL}
            onValueChange={(v) => setFilter({ format: fields.format.parse(v === ALL ? '' : v) })}
          >
            <SelectTrigger className="h-10! w-full" aria-label="Formato">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos</SelectItem>
              {FORMAT_IDS.map((f) => (
                <SelectItem key={f} value={f}>
                  {FORMATS[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="field">
          <span>Ordenar</span>
          <Select value={search.sort} onValueChange={(v) => setFilter({ sort: fields.sort.parse(v) })}>
            <SelectTrigger className="h-10! w-full" aria-label="Ordenar">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SORT_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button type="submit">Filtrar</Button>
      </form>

      {hasFilters && (
        <p className="active-filters">
          <Link to="/cinemas" search={{ sort: search.sort }}>
            Limpar filtros
          </Link>
        </p>
      )}

      {cinemas.length === 0 ? (
        <section className="empty-state">
          <h2>Nenhum cinema por aqui… ainda</h2>
          <p className="muted">Tente outra cidade ou outro formato.</p>
        </section>
      ) : (
        <div className="grid">
          {cinemas.map((cinema) => (
            <CinemaCard key={cinema.id} cinema={cinema} />
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <nav className="pagination" aria-label="Paginação">
          <Button asChild variant="outline" aria-disabled={page <= 1}>
            <Link from={Route.fullPath} search={(prev) => ({ ...prev, page: page - 1 })} disabled={page <= 1}>
              ← Anterior
            </Link>
          </Button>
          <span className="muted">
            Página {page} de {pageCount}
          </span>
          <Button asChild variant="outline" aria-disabled={page >= pageCount}>
            <Link from={Route.fullPath} search={(prev) => ({ ...prev, page: page + 1 })} disabled={page >= pageCount}>
              Próxima →
            </Link>
          </Button>
        </nav>
      )}
    </>
  )
}

/** Radix Select can't use '' as an item value, so "no filter" gets a sentinel. */
const ALL = '__all__'

/** Accent- and case-insensitive, so "sao" finds São Paulo and "goiania" Goiânia. */
const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

type CityOption = { city: string; state: State; cinemas: number }

/** Searchable city picker: 1,000+ cities is too many for a plain select. Picking one also sets its UF. */
function CityCombobox({
  cities,
  city,
  state,
  onChange,
}: {
  cities: CityOption[]
  city: string | undefined
  state: State | undefined
  onChange: (city: CityOption | undefined) => void
}) {
  const [open, setOpen] = useState(false)
  const label = city ? (state ? `${city}/${state}` : city) : 'Todas'
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Cidade"
          className="h-10 w-full justify-between rounded-lg px-3 font-normal"
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDownIcon className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-w-[calc(100vw-32px)] p-0" align="start">
        <Command filter={(value, search) => (fold(value).includes(fold(search)) ? 1 : 0)}>
          <CommandInput placeholder={state ? `Buscar cidade em ${state}…` : 'Buscar cidade…'} />
          <CommandList className="max-h-80">
            <CommandEmpty>Nenhuma cidade encontrada.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={state ? `Todas as cidades de ${state}` : 'Todas as cidades'}
                data-checked={!city}
                onSelect={() => {
                  onChange(undefined)
                  setOpen(false)
                }}
              >
                {state ? `Todas as cidades de ${state}` : 'Todas as cidades'}
              </CommandItem>
              {cities.map((c) => (
                <CommandItem
                  key={`${c.city}-${c.state}`}
                  value={`${c.city} ${c.state}`}
                  data-checked={c.city === city && c.state === state}
                  onSelect={() => {
                    onChange(c)
                    setOpen(false)
                  }}
                >
                  <span className="flex-1 truncate">
                    {c.city}
                    <span className="opacity-60">/{c.state}</span>
                  </span>
                  <span className="text-xs tabular-nums opacity-60">{pluralize(c.cinemas, 'cinema', 'cinemas')}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
