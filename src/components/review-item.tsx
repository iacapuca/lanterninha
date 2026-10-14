import { Link } from '@tanstack/react-router'
import { CRITERIA, CRITERION_IDS, type Review, type ReviewWithRoom } from '~/lib/domain'
import { formatDate, formatRating } from '~/lib/format'
import { Lanterns } from './lanterns'
import { Ticket, ticketSerial } from './ticket'

/** A review is the stub you kept from the session: who, when, which row, how many 🔦. */
export function ReviewItem({ review }: { review: Review | ReviewWithRoom }) {
  const context = 'room' in review ? review : null
  return (
    <article>
      <Ticket
        className="review"
        stub={
          <div className="review-stub">
            <span className="ticket-score">{formatRating(review.rating)}</span>
            <Lanterns rating={review.rating} size={13} />
            <dl className="review-stub-fields">
              <div>
                <dt>Data</dt>
                <dd>
                  <time dateTime={review.createdAt}>{formatDate(review.createdAt)}</time>
                </dd>
              </div>
              <div>
                <dt>Fileira</dt>
                <dd>{review.row ?? '—'}</dd>
              </div>
            </dl>
            <span className="ticket-serial">{ticketSerial(review.id)}</span>
          </div>
        }
      >
        <header className="review-head">
          <Link to="/users/$username" params={{ username: review.username }} className="review-user">
            <span className="avatar" aria-hidden="true">
              {review.username.slice(0, 1).toUpperCase()}
            </span>
            @{review.username}
          </Link>
          {review.film && <span className="review-film">🎬 {review.film}</span>}
        </header>

        {context && (
          <p className="ticket-fine">
            <Link to="/rooms/$roomId" params={{ roomId: context.room.id }}>
              {context.room.name}
            </Link>{' '}
            · {context.cinema.name}, {context.cinema.city}/{context.cinema.state}
          </p>
        )}

        <p className="review-body">{review.body}</p>

        <p className="review-criteria">
          {CRITERION_IDS.map((c) => (
            <span key={c}>
              {CRITERIA[c]} <strong>{review.criteria[c]}</strong>
            </span>
          ))}
        </p>
        {review.tags.length > 0 && (
          <ul className="tags">
            {review.tags.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        )}
      </Ticket>
    </article>
  )
}

export function ReviewListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="stack" aria-busy="true" aria-label="Carregando avaliações">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="ticket ticket-horizontal skeleton" />
      ))}
    </div>
  )
}
