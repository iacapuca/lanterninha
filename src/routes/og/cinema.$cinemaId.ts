import { createFileRoute } from '@tanstack/react-router'
import { FORMATS } from '~/lib/domain'
import { TicketCard, plural } from '~/server/og/cards.server'
import { ogResponse } from '~/server/og/respond.server'
import { cinemaShareSummary } from '~/server/store.server'

export const Route = createFileRoute('/og/cinema/$cinemaId')({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        ogResponse(request, async () => {
          const c = await cinemaShareSummary(params.cinemaId)
          if (!c) return null
          return TicketCard({
            kicker: c.chain && c.chain !== 'Independente' ? c.chain : 'Cinema',
            title: c.name,
            subtitle: `${c.neighborhood ? `${c.neighborhood} · ` : ''}${c.city}/${c.state}`,
            chips: [
              plural(c.roomCount, 'sala', 'salas'),
              plural(c.seats, 'lugar', 'lugares'),
              ...c.formats.map((f) => FORMATS[f]),
            ].slice(0, 5),
            rating: c.average,
            reviewCount: c.reviewCount,
          })
        }),
    },
  },
})
