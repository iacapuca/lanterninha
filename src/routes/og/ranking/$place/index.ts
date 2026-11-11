import { createFileRoute } from '@tanstack/react-router'
import { rankingCard } from '~/server/og/ranking.server'
import { ogResponse } from '~/server/og/respond.server'

export const Route = createFileRoute('/og/ranking/$place/')({
  server: {
    handlers: {
      GET: ({ request, params }) => ogResponse(request, () => rankingCard(params.place)),
    },
  },
})
