import { Link } from '@tanstack/react-router'
import { FORMATS, type RoomSummary } from '~/lib/domain'
import { formatRating, pluralize } from '~/lib/format'
import { Lanterns } from './lanterns'
import { Ticket, ticketSerial } from './ticket'

export function FormatBadge({ format }: { format: RoomSummary['format'] }) {
  return <span className={`badge badge-${format}`}>{FORMATS[format]}</span>
}

export function RoomCard({ room, showCinema = true }: { room: RoomSummary; showCinema?: boolean }) {
  return (
    <Link to="/rooms/$roomId" params={{ roomId: room.id }} className="room-card">
      <Ticket
        orientation="vertical"
        stub={
          <div className="room-card-stub">
            <span className="ticket-score">{formatRating(room.average)}</span>
            <span className="room-card-stub-meta">
              <Lanterns rating={room.average} size={17} />
              <span>{pluralize(room.reviewCount, 'avaliação', 'avaliações')}</span>
            </span>
          </div>
        }
      >
        <p className="ticket-kicker">
          <span>{room.seats} lugares</span>
          <span>{ticketSerial(room.id)}</span>
        </p>
        <FormatBadge format={room.format} />
        <h3>{room.name}</h3>
        {showCinema && (
          <p className="ticket-fine">
            {room.cinema.name} · {room.cinema.city}/{room.cinema.state}
          </p>
        )}
      </Ticket>
    </Link>
  )
}
