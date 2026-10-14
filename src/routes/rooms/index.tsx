import { useState } from 'react'
import { Link, createFileRoute, stripSearchParams, useNavigate } from '@tanstack/react-router'
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react'
import { searchRooms } from '~/functions/rooms.functions'
import { FORMATS, FORMAT_IDS, STATES } from '~/lib/domain'
import { pluralize } from '~/lib/format'
import { EXPLORE_DEFAULTS, exploreSearchSchema, type ExploreSearch } from '~/lib/schemas'
import { RoomCard } from '~/components/room-card'
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

        <div className="field">
          <span>Cidade</span>
          <CityCombobox
            cities={cities}
            value={search.city}
            onChange={(city) => setFilter({ city })}
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

/** Searchable city picker: 500+ cities is too many for a plain select. */
function CityCombobox({
  cities,
  value,
  onChange,
}: {
  cities: Array<{ city: string; state: string; rooms: number }>
  value: string | undefined
  onChange: (city: string | undefined) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="h-10 w-full justify-between rounded-lg font-normal">
          <span className="truncate">{value ?? 'Todas'}</span>
          <ChevronsUpDownIcon className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar cidade…" />
          <CommandList>
            <CommandEmpty>Nenhuma cidade encontrada.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__todas__"
                onSelect={() => {
                  onChange(undefined)
                  setOpen(false)
                }}
              >
                Todas as cidades
              </CommandItem>
              {cities.map((c) => (
                <CommandItem
                  key={`${c.city}-${c.state}`}
                  value={`${c.city} ${c.state}`}
                  onSelect={() => {
                    onChange(c.city)
                    setOpen(false)
                  }}
                >
                  <CheckIcon className={c.city === value ? 'opacity-100' : 'opacity-0'} />
                  <span className="flex-1">{c.city}</span>
                  <span className="text-xs opacity-60">
                    {c.state} · {c.rooms}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
