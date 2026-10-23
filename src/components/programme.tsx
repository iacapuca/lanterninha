import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { FilmTitle, type FilmCardData } from '~/components/film-card'
import type { Provider } from '~/lib/domain'

type Showtime = {
  id: string
  localDay: string
  localTime: string
  roomName: string
  types: string[]
  price: number | null
  checkoutUrl: string | null
  film: FilmCardData & { id: string }
  room: { id: string; name: string } | null
}

type Props = {
  linked: boolean
  /** Where the sessions come from, for the credit line. */
  providers: Provider[]
  /** The cinema's local date (YYYY-MM-DD). */
  today: string
  showtimes: Showtime[]
  /** On a cinema page, each time also says which room it's in. */
  showRoom?: boolean
}

const PROVIDER_SITES: Record<Provider, { name: string; url: string }> = {
  ingresso: { name: 'Ingresso.com', url: 'https://www.ingresso.com' },
  velox: { name: 'Velox Tickets', url: 'https://www.veloxtickets.com' },
  somosviva: { name: 'Parque Apipucos', url: 'https://apipucos.somosviva.com.br/' },
  fundarpe: { name: 'Fundarpe', url: 'https://ingressosfundarpe.com.br/' },
}

/** Session types worth showing next to a time (plain 2D is the default). */
const HIDDEN_TYPES = new Set(['2D', 'NORMAL', 'NAC', 'NACIONAL'])

const dayFormat = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  timeZone: 'UTC',
})

const shortDayFormat = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  timeZone: 'UTC',
})

function dayLabel(day: string, today: string, short = false) {
  const date = new Date(`${day}T12:00:00Z`)
  if (day === today) return 'Hoje'
  if (date.getTime() - new Date(`${today}T12:00:00Z`).getTime() === 86_400_000) return 'Amanhã'
  const label = (short ? shortDayFormat : dayFormat).format(date).replace('.', '')
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function groupByDayAndFilm(showtimes: Showtime[]) {
  const days = new Map<string, Map<string, { film: Showtime['film']; sessions: Showtime[] }>>()
  for (const s of showtimes) {
    const films = days.get(s.localDay) ?? new Map()
    const entry = films.get(s.film.id) ?? { film: s.film, sessions: [] }
    entry.sessions.push(s)
    films.set(s.film.id, entry)
    days.set(s.localDay, films)
  }
  return [...days.entries()].map(([day, films]) => ({ day, films: [...films.values()] }))
}

/** "Em cartaz": the next few days of sessions from the ticket providers, one day at a time, linking to their checkout. */
export function Programme({ linked, providers, today, showtimes, showRoom = false }: Props) {
  const days = groupByDayAndFilm(showtimes)
  const [selected, setSelected] = useState<string | null>(null)
  if (!linked) return null
  const current = days.find((d) => d.day === selected) ?? days[0]

  return (
    <section className="section" aria-labelledby="programme-title">
      <div className="section-head">
        <h2 id="programme-title">Em cartaz</h2>
        {providers.length > 0 && (
          <span className="text-xs text-muted-foreground">
            Programação e ingressos via{' '}
            {providers.map((p, i) => (
              <span key={p}>
                {i > 0 && ' e '}
                <a href={PROVIDER_SITES[p].url} target="_blank" rel="noopener noreferrer" className="underline">
                  {PROVIDER_SITES[p].name}
                </a>
              </span>
            ))}
          </span>
        )}
      </div>

      {!current ? (
        <p className="text-muted-foreground">Nenhuma sessão nos próximos dias por aqui.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div role="tablist" aria-label="Dia" className="flex flex-wrap gap-2">
            {days.map(({ day }) => {
              const active = day === current.day
              return (
                <button
                  key={day}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelected(day)}
                  className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border text-muted-foreground hover:border-primary hover:text-foreground'
                  }`}
                >
                  {dayLabel(day, today, true)}
                </button>
              )
            })}
          </div>
          {[current].map(({ day, films }) => (
            <div key={day} role="tabpanel" aria-label={dayLabel(day, today)}>
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-3">
                {films.map(({ film, sessions }) => (
                  <li key={film.id} className="flex gap-4 rounded-xl bg-paper p-3 text-ink shadow-lg">
                    {film.posterUrl ? (
                      <img
                        src={film.posterUrl}
                        alt=""
                        loading="lazy"
                        className="h-24 w-16 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <div className="h-24 w-16 shrink-0 rounded-md bg-ink/10" aria-hidden="true" />
                    )}
                    <div className="min-w-0 flex-1">
                      <FilmTitle film={film} />
                      <p className="mt-0.5 text-xs text-ink/60">
                        {[film.contentRating, film.durationMinutes && `${film.durationMinutes} min`, film.genres[0]]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {sessions.map((s) => {
                          const tags = s.types.filter((t) => !HIDDEN_TYPES.has(t.toUpperCase()))
                          const label = (
                            <>
                              <span className="font-semibold">{s.localTime}</span>
                              {tags.length > 0 && <span className="text-[0.68rem] opacity-70">{tags.join(' · ')}</span>}
                              {showRoom && (
                                <span className="text-[0.68rem] opacity-70">· {s.room?.name ?? s.roomName}</span>
                              )}
                            </>
                          )
                          const chip =
                            'inline-flex items-center gap-1.5 rounded-full border border-ink/20 px-2.5 py-1 text-sm no-underline'
                          return (
                            <li key={s.id}>
                              {s.checkoutUrl ? (
                                <a
                                  href={s.checkoutUrl}
                                  target="_blank"
                                  rel="noopener noreferrer nofollow"
                                  className={`${chip} text-ink hover:border-ticket-red hover:bg-ticket-red hover:text-paper`}
                                  title={s.price ? `A partir de R$ ${s.price.toFixed(2).replace('.', ',')}` : undefined}
                                >
                                  {label}
                                </a>
                              ) : (
                                <span className={chip}>{label}</span>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                      {showRoom && sessions.some((s) => s.room) && (
                        <p className="mt-2 text-xs text-ink/60">
                          Salas:{' '}
                          {[...new Map(sessions.filter((s) => s.room).map((s) => [s.room!.id, s.room!])).values()].map(
                            (r, i) => (
                              <span key={r.id}>
                                {i > 0 && ', '}
                                <Link to="/rooms/$roomId" params={{ roomId: r.id }} className="underline">
                                  {r.name}
                                </Link>
                              </span>
                            ),
                          )}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export function ProgrammeSkeleton() {
  return <div className="section h-40 animate-pulse rounded-xl bg-paper/10" aria-busy="true" />
}
