import { useMemo, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { getCinemaLocations } from '~/functions/rooms.functions'
import { formatRating, pluralize } from '~/lib/format'
import { CinemaMap } from '~/components/cinema-map'
import { Lanterns } from '~/components/lanterns'
import { Button } from '~/components/ui/button'

// SSR: false. This page is entirely about the visitor's position
// (Geolocation API) and has no SEO value, so neither the loader nor the
// component run on the server. The loader still calls a server function —
// on the client that is an RPC, so the data boundary is unchanged.
export const Route = createFileRoute('/nearby')({
  ssr: false,
  loader: () => getCinemaLocations(),
  head: () => ({ meta: [{ title: 'Perto de mim · Lanterninha' }] }),
  pendingComponent: () => <div className="panel skeleton" style={{ height: 420 }} />,
  component: NearbyPage,
})

type Position = { lat: number; lng: number }

function distanceKm(a: Position, b: Position) {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}

const LIST_SIZE = 30

/** Some browsers never answer when the OS location service is off, despite `timeout`. */
const LOCATE_GIVE_UP_MS = 12_000

function NearbyPage() {
  const { cinemas, approximate } = Route.useLoaderData()
  const [precise, setPrecise] = useState<Position | null>(null)
  const [status, setStatus] = useState<'idle' | 'locating' | 'denied'>('idle')
  // The browser's position once granted; until then, the city-level one from the network.
  const position: Position | null = precise ?? approximate
  const [highlighted, setHighlighted] = useState<string | null>(null)

  const sorted = useMemo(() => {
    const withDistance = cinemas.map((c) => ({ ...c, km: position ? distanceKm(position, c) : null }))
    const ranked = position
      ? withDistance.sort((a, b) => (a.km ?? 0) - (b.km ?? 0))
      : withDistance.sort((a, b) => (b.average ?? 0) - (a.average ?? 0) || b.roomCount - a.roomCount)
    return ranked.slice(0, LIST_SIZE)
  }, [cinemas, position])

  function locate() {
    if (!('geolocation' in navigator)) return setStatus('denied')
    setStatus('locating')
    let settled = false
    const settle = (next: Position | null) => {
      if (settled) return
      settled = true
      clearTimeout(giveUp)
      if (next) setPrecise(next)
      setStatus(next ? 'idle' : 'denied')
    }
    const giveUp = setTimeout(() => settle(null), LOCATE_GIVE_UP_MS)
    navigator.geolocation.getCurrentPosition(
      (p) => settle({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => settle(null),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    )
  }

  return (
    <>
      <header className="page-head">
        <p className="eyebrow">Perto de mim</p>
        <h1>Qual a melhor sala aqui do lado?</h1>
        <p className="muted">
          {precise
            ? 'Usando a localização do seu navegador, que não sai dele.'
            : approximate
              ? `Pela sua conexão, você está perto de ${approximate.city ?? 'uma cidade brasileira'}. Para mais precisão, use a localização do navegador (ela não sai dele).`
              : 'Use a localização do navegador (ela não sai dele) para ver as salas mais próximas.'}{' '}
          Distâncias com ~ usam o centro da cidade do cinema.
        </p>
        <Button type="button" onClick={locate} disabled={status === 'locating'}>
          {status === 'locating' ? 'Procurando…' : precise ? 'Atualizar localização' : 'Usar minha localização'}
        </Button>
        {status === 'denied' && (
          <p className="form-errors">
            Não conseguimos a localização do navegador (confira se ela está ativada no sistema).{' '}
            {approximate ? 'Mostrando pela sua conexão.' : 'Mostrando por nota.'}
          </p>
        )}
      </header>

      <div className="split nearby-split">
        <ol className="stack nearby-list">
          {sorted.map((c) => (
            <li key={c.id} className="panel nearby-item">
              <div>
                {/* Hover or keyboard focus on the link lights the cinema up on the map. */}
                <Link
                  to="/cinemas/$cinemaId"
                  params={{ cinemaId: c.id }}
                  onMouseEnter={() => setHighlighted(c.id)}
                  onMouseLeave={() => setHighlighted((h) => (h === c.id ? null : h))}
                  onFocus={() => setHighlighted(c.id)}
                  onBlur={() => setHighlighted((h) => (h === c.id ? null : h))}
                >
                  <strong>{c.name}</strong>
                </Link>
                <p className="muted">
                  {c.neighborhood}, {c.city}/{c.state} · {pluralize(c.roomCount, 'sala', 'salas')}
                </p>
              </div>
              <div className="nearby-score">
                <Lanterns rating={c.average} size={13} />
                <span>{formatRating(c.average)}</span>
                {c.km != null && (
                  <span className="muted">
                    {c.geoPrecision === 'city' && '~'}
                    {Math.round(c.km).toLocaleString('pt-BR')} km
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>

        <aside className="nearby-map">
          <CinemaMap cinemas={cinemas} position={position} highlighted={highlighted} />
        </aside>
      </div>
    </>
  )
}
