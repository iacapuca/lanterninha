// Debug tool for the Velox Tickets client (src/server/programme/velox/api.server.ts):
// prints what each client method extracts from the live portal, so upstream
// template changes surface quickly. Run with:
//   node --experimental-strip-types scripts/velox-smoke.ts
import { velox } from '../src/server/programme/velox/api.server.ts'

const movies = await velox.movies('Recife')
const nowShowing = movies.filter((m) => !m.eventComingSoon)
console.log(`movies: ${movies.length} total, ${nowShowing.length} now showing`)
console.log('first:', JSON.stringify(nowShowing[0], null, 1).slice(0, 400))

const places = await velox.places('Recife')
console.log(
  'places:',
  places.map((p) => `${p.placeCod}=${p.placeName} @ ${p.placeUrl}`),
)

// One venue-day page carries the venue's whole programme.
const [moviemax] = places.filter((p) => p.placeCod === 'RSV')
if (moviemax) {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Recife' }).format(new Date())
  const { place, movies: playing } = await velox.venueDay(moviemax.placeUrl, day)
  console.log(`venueDay ${day} @ ${place.placeName} (${place.addr}): ${playing.length} movies`)
  for (const { event, rooms } of playing) {
    for (const r of rooms) {
      const times = r.schedules.map((s) => `${s.startTime}${s.isSoldOut ? '(sold out)' : ''}`).join(' ')
      console.log(`  ${event.eventTitle} | ${r.roomName} [${r.filters.map((f) => f.fCod).join('/')}] ${times}`)
    }
  }
}

const carros = nowShowing.find((m) => m.eventTitle.includes('Carros'))!
const path = carros.moviePage.split('/')
const slug = path.at(-2)!
const id = path.at(-1)!
const { detail, dates, places: moviePlaces } = await velox.movie('Recife', slug, id)
console.log(
  `movie ${detail.eventTitle}: duration=${detail.duration}min, genre=${detail.genre}, rating=${detail.typeRating}`,
)
console.log('  dates:', dates.map((d) => d.date).join(', '))
console.log('  places:', moviePlaces.map((p) => `${p.placeCod}=${p.placeName}`).join(', '))

const day = dates[0]?.date ?? new Date().toISOString().slice(0, 10)
const sessions = await velox.sessions('Recife', slug, id, day)
for (const p of sessions) {
  console.log(`  ${day} @ ${p.place.placeName}:`)
  for (const r of p.rooms) {
    const times = r.schedules.map((s) => `${s.startTime}${s.isSoldOut ? '(sold out)' : ''}`).join(' ')
    console.log(`    ${r.roomName} [${r.filters.map((f) => f.fCod).join('/')}] ${times}`)
  }
}

const cities = await velox.cities()
console.log('states on Velox:', cities.map((c) => c.stateCod).join(', '))
console.log(
  'PE cities:',
  cities
    .find((c) => c.stateCod === 'PE')
    ?.cities.map((c) => c.cityName)
    .join(', '),
)
