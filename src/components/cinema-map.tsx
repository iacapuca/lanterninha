import { useEffect, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { GeoJSONSource, Map as MapLibreMap, Marker } from 'maplibre-gl'
import { formatRating, pluralize } from '~/lib/format'

export type MapCinema = {
  id: string
  name: string
  city: string
  state: string
  lat: number
  lng: number
  geoPrecision: 'address' | 'city' | null
  roomCount: number
  average: number | null
  reviewCount: number
}

type Props = {
  cinemas: MapCinema[]
  /** The visitor, when known: the map centres on them. */
  position: { lat: number; lng: number } | null
  /** Cinema highlighted from the list. */
  highlighted: string | null
}

// OpenFreeMap: free OpenStreetMap vector tiles, no key. Map data © OpenStreetMap contributors.
const STYLE = 'https://tiles.openfreemap.org/styles/dark'
const BRAZIL: [[number, number], [number, number]] = [
  [-74, -34],
  [-34, 5.5],
]
const AMBER = '#ffb547'
const RED = '#a8231b'

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/**
 * MapLibre map of every geocoded cinema: clustered when zoomed out, amber dots
 * sized by room count (brighter once reviewed), a popup linking to the cinema.
 * MapLibre (~250 KB gzipped) is imported on mount, so only this page pays for it.
 */
export function CinemaMap({ cinemas, position, highlighted }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibreMap | null>(null)
  const me = useRef<Marker | null>(null)
  const lastHighlight = useRef<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    let instance: MapLibreMap | null = null
    void (async () => {
      const [maplibregl, { default: workerUrl }] = await Promise.all([
        import('maplibre-gl'),
        // MapLibre finds its worker relative to its own module, which breaks once
        // Vite bundles it; hand it the worker file's emitted URL instead.
        import('maplibre-gl/dist/maplibre-gl-worker.mjs?url'),
        import('maplibre-gl/dist/maplibre-gl.css'),
      ])
      if (cancelled || !container.current) return
      maplibregl.setWorkerUrl(workerUrl)
      const created = new maplibregl.Map({
        container: container.current,
        style: STYLE,
        bounds: BRAZIL,
        fitBoundsOptions: { padding: 12 },
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
      })
      created.touchZoomRotate.disableRotation()
      created.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
      instance = map.current = created

      instance.on('load', () => {
        instance!.addSource('cinemas', {
          type: 'geojson',
          promoteId: 'id',
          cluster: true,
          clusterRadius: 38,
          clusterMaxZoom: 11,
          data: {
            type: 'FeatureCollection',
            features: cinemas.map((c) => ({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
              properties: {
                id: c.id,
                name: c.name,
                place: `${c.city}/${c.state}`,
                rooms: c.roomCount,
                average: c.average ?? 0,
                reviews: c.reviewCount,
                approximate: c.geoPrecision === 'city',
              },
            })),
          },
        })
        instance!.addLayer({
          id: 'clusters',
          type: 'circle',
          source: 'cinemas',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': AMBER,
            'circle-opacity': 0.85,
            'circle-radius': ['step', ['get', 'point_count'], 14, 10, 18, 50, 24, 200, 30],
            'circle-stroke-width': 3,
            'circle-stroke-color': '#ffb54744',
          },
        })
        instance!.addLayer({
          id: 'cluster-count',
          type: 'symbol',
          source: 'cinemas',
          filter: ['has', 'point_count'],
          layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12, 'text-font': ['Noto Sans Bold'] },
          paint: { 'text-color': '#1b1006' },
        })
        instance!.addLayer({
          id: 'cinema',
          type: 'circle',
          source: 'cinemas',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': ['case', ['boolean', ['feature-state', 'highlight'], false], RED, AMBER],
            'circle-opacity': ['case', ['>', ['get', 'reviews'], 0], 1, 0.6],
            'circle-radius': [
              '+',
              ['interpolate', ['linear'], ['get', 'rooms'], 1, 5, 12, 9],
              ['case', ['boolean', ['feature-state', 'highlight'], false], 4, 0],
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#130d0a',
          },
        })

        // Clusters zoom in; cinemas open a popup that links to their page.
        instance!.on('click', 'clusters', async (e) => {
          const feature = e.features?.[0]
          if (!feature) return
          const source = instance!.getSource('cinemas') as GeoJSONSource
          const zoom = await source.getClusterExpansionZoom(feature.properties.cluster_id)
          instance!.easeTo({ center: (feature.geometry as unknown as { coordinates: [number, number] }).coordinates, zoom })
        })
        instance!.on('click', 'cinema', (e) => {
          const feature = e.features?.[0]
          if (!feature) return
          const p = feature.properties as { id: string; name: string; place: string; rooms: number; average: number; reviews: number; approximate: boolean }
          const html = `
            <a class="map-popup" href="/cinemas/${encodeURIComponent(p.id)}" data-cinema="${escapeHtml(p.id)}">
              <strong>${escapeHtml(p.name)}</strong>
              <span>${escapeHtml(p.place)} · ${pluralize(p.rooms, 'sala', 'salas')}</span>
              <span>${p.reviews > 0 ? `🔦 ${formatRating(p.average)} · ${pluralize(p.reviews, 'avaliação', 'avaliações')}` : 'Sem avaliações ainda'}</span>
              ${p.approximate ? '<em>Localização aproximada (centro da cidade)</em>' : ''}
            </a>`
          const popup = new maplibregl.Popup({ offset: 10, maxWidth: '260px' })
            .setLngLat((feature.geometry as unknown as { coordinates: [number, number] }).coordinates)
            .setHTML(html)
            .addTo(instance!)
          // Client-side navigation instead of a full page load.
          popup.getElement().querySelector('a')?.addEventListener('click', (ev: MouseEvent) => {
            ev.preventDefault()
            void navigate({ to: '/cinemas/$cinemaId', params: { cinemaId: p.id } })
          })
        })
        for (const layer of ['clusters', 'cinema']) {
          instance!.on('mouseenter', layer, () => (instance!.getCanvas().style.cursor = 'pointer'))
          instance!.on('mouseleave', layer, () => (instance!.getCanvas().style.cursor = ''))
        }
      })
    })()
    return () => {
      cancelled = true
      instance?.remove()
      map.current = null
      me.current = null
    }
    // The cinema list is fixed for the page's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Follow the visitor: a "você" marker and a city-level zoom.
  useEffect(() => {
    if (!position) return
    let cancelled = false
    void (async () => {
      const maplibregl = await import('maplibre-gl')
      // Wait for the map created by the first effect.
      while (!map.current && !cancelled) await new Promise((r) => setTimeout(r, 50))
      if (cancelled || !map.current) return
      if (!me.current) {
        const dot = document.createElement('div')
        dot.className = 'map-me'
        dot.title = 'Você'
        me.current = new maplibregl.Marker({ element: dot })
      }
      me.current!.setLngLat([position.lng, position.lat]).addTo(map.current)
      map.current.flyTo({ center: [position.lng, position.lat], zoom: 11, speed: 1.6 })
    })()
    return () => {
      cancelled = true
    }
  }, [position])

  // Highlight the cinema hovered in the list.
  useEffect(() => {
    const m = map.current
    if (!m?.getSource('cinemas')) return
    if (lastHighlight.current) m.setFeatureState({ source: 'cinemas', id: lastHighlight.current }, { highlight: false })
    if (highlighted) m.setFeatureState({ source: 'cinemas', id: highlighted }, { highlight: true })
    lastHighlight.current = highlighted
  }, [highlighted])

  return <div ref={container} className="cinema-map" role="region" aria-label="Mapa dos cinemas" />
}
