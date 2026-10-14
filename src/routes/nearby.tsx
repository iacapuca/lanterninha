import { useMemo, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { getCinemaLocations } from '~/functions/rooms.functions'
import { formatRating, pluralize } from '~/lib/format'
import { Lanterns } from '~/components/lanterns'

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
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}

// Bounding box of mainland Brazil for the dot plot.
const BOUNDS = { west: -74, east: -34, north: 5.5, south: -34 }
const project = (p: Position) => ({
  x: ((p.lng - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * 400,
  y: ((BOUNDS.north - p.lat) / (BOUNDS.north - BOUNDS.south)) * 400,
})

function NearbyPage() {
  const cinemas = Route.useLoaderData()
  const [position, setPosition] = useState<Position | null>(null)
  const [status, setStatus] = useState<'idle' | 'locating' | 'denied'>('idle')

  const sorted = useMemo(() => {
    const withDistance = cinemas.map((c) => ({ ...c, km: position ? distanceKm(position, c) : null }))
    return position
      ? withDistance.sort((a, b) => (a.km ?? 0) - (b.km ?? 0))
      : withDistance.sort((a, b) => (b.average ?? 0) - (a.average ?? 0))
  }, [cinemas, position])

  const me = position && project(position)

  function locate() {
    if (!('geolocation' in navigator)) return setStatus('denied')
    setStatus('locating')
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPosition({ lat: p.coords.latitude, lng: p.coords.longitude })
        setStatus('idle')
      },
      () => setStatus('denied'),
      { enableHighAccuracy: false, timeout: 10_000 },
    )
  }

  return (
    <>
      <header className="page-head">
        <p className="eyebrow">Perto de mim</p>
        <h1>Qual a melhor sala aqui do lado?</h1>
        <p className="muted">
          Sua localização fica só no seu navegador — nada é enviado ao servidor.
        </p>
        <button type="button" className="button" onClick={locate} disabled={status === 'locating'}>
          {status === 'locating' ? 'Procurando…' : position ? 'Atualizar localização' : 'Usar minha localização'}
        </button>
        {status === 'denied' && (
          <p className="form-errors">Não conseguimos sua localização. Mostrando por nota.</p>
        )}
      </header>

      <div className="split">
        <ol className="stack nearby-list">
          {sorted.map((c) => (
            <li key={c.id} className="panel nearby-item">
              <div>
                <Link to="/cinemas/$cinemaId" params={{ cinemaId: c.id }}>
                  <strong>{c.name}</strong>
                </Link>
                <p className="muted">
                  {c.neighborhood}, {c.city}/{c.state} · {pluralize(c.roomCount, 'sala', 'salas')}
                </p>
              </div>
              <div className="nearby-score">
                <Lanterns rating={c.average} size={13} />
                <span>{formatRating(c.average)}</span>
                {c.km != null && <span className="muted">{Math.round(c.km).toLocaleString('pt-BR')} km</span>}
              </div>
            </li>
          ))}
        </ol>

        <aside className="panel">
          <svg viewBox="0 0 400 400" className="dot-map" role="img" aria-label="Cinemas no mapa do Brasil">
            {cinemas.map((c) => {
              const { x, y } = project(c)
              return (
                <circle key={c.id} cx={x} cy={y} r={3 + (c.average ?? 0)} className="dot">
                  <title>{c.name}</title>
                </circle>
              )
            })}
            {me && (
              <circle cx={me.x} cy={me.y} r={6} className="dot-me">
                <title>Você</title>
              </circle>
            )}
          </svg>
        </aside>
      </div>
    </>
  )
}
