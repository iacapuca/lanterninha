import { createFileRoute } from '@tanstack/react-router'
import { FORMATS } from '~/lib/domain'
import { TicketCard, plural } from '~/server/og/cards.server'
import { ogResponse } from '~/server/og/respond.server'
import { getRoom } from '~/server/store.server'

export const Route = createFileRoute('/og/room/$roomId')({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        ogResponse(request, async () => {
          const room = await getRoom(params.roomId)
          if (!room) return null
          return TicketCard({
            kicker: room.cinema.name,
            title: room.name,
            subtitle: `${room.cinema.city}/${room.cinema.state}`,
            chips: [
              plural(room.seats, 'lugar', 'lugares'),
              ...(room.format && room.format !== 'standard' ? [FORMATS[room.format]] : []),
            ],
            rating: room.average,
            reviewCount: room.reviewCount,
          })
        }),
    },
  },
})
