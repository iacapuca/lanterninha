import { createFileRoute } from '@tanstack/react-router'
import { SiteCard } from '~/server/og/cards.server'
import { ogResponse } from '~/server/og/respond.server'

// Default share image for pages without their own.
export const Route = createFileRoute('/og/site')({
  server: { handlers: { GET: ({ request }) => ogResponse(request, async () => SiteCard()) } },
})
