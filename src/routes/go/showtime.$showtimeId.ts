import { createFileRoute } from '@tanstack/react-router'
import { track } from '~/server/analytics.server'
import { getShowtimeCheckout } from '~/server/store.server'

// Server route: a session's "buy" link goes through here, so the click is
// counted on the server (ad blockers can't drop it) before the 302 to the
// provider's checkout. Sessions are cleaned up a few hours after they start;
// a stale link lands on the cinema page, or the home page.
export const Route = createFileRoute('/go/showtime/$showtimeId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const found = await getShowtimeCheckout(params.showtimeId)
        if (!found?.checkoutUrl) {
          const fallback = found ? `/cinemas/${found.cinemaId}` : '/'
          return Response.redirect(new URL(fallback, request.url).toString(), 302)
        }
        track('checkout_click', { ...found, roomId: found.roomId ?? '' })
        return new Response(null, {
          status: 302,
          headers: { Location: found.checkoutUrl, 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
        })
      },
    },
  },
})
