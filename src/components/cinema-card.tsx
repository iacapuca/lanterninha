import { Link } from '@tanstack/react-router'
import type { CinemaSummary } from '~/lib/domain'
import { formatRating, pluralize } from '~/lib/format'
import { Lanterns } from './lanterns'
import { FormatBadge } from './room-card'
import { Ticket, ticketSerial } from './ticket'

export function CinemaCard({ cinema }: { cinema: CinemaSummary }) {
  return (
    <Link to="/cinemas/$cinemaId" params={{ cinemaId: cinema.id }} className="room-card">
      <Ticket
        orientation="vertical"
        stub={
          <div className="room-card-stub">
            <span className="ticket-score">{formatRating(cinema.average)}</span>
            <span className="room-card-stub-meta">
              <Lanterns rating={cinema.average} size={17} />
              <span>{pluralize(cinema.reviewCount, 'avaliação', 'avaliações')}</span>
            </span>
          </div>
        }
      >
        <p className="ticket-kicker">
          <span>
            {pluralize(cinema.roomCount, 'sala', 'salas')} · {cinema.seats} lugares
          </span>
          <span>{ticketSerial(cinema.id)}</span>
        </p>
        {(cinema.showing || cinema.formats.length > 0) && (
          <p className="mt-2 flex flex-wrap gap-1.5">
            {cinema.showing && <span className="badge badge-showing">Em cartaz</span>}
            {cinema.formats.map((f) => (
              <FormatBadge key={f} format={f} />
            ))}
          </p>
        )}
        <h3>{cinema.name}</h3>
        <p className="ticket-fine">
          {cinema.neighborhood ? `${cinema.neighborhood} · ` : ''}
          {cinema.city}/{cinema.state}
        </p>
      </Ticket>
    </Link>
  )
}
