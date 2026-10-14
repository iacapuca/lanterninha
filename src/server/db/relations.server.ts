// Drizzle 1.0 relations (RQB v2), powering `db.query.*` for nested reads.
// `optional: false` mirrors NOT NULL foreign keys so `one()` results aren't nullable.
import { defineRelations } from 'drizzle-orm'
import * as schema from './schema.server'

export const relations = defineRelations(schema, (r) => ({
  user: {
    reviews: r.many.review(),
    sessions: r.many.session(),
    accounts: r.many.account(),
    roomFacts: r.many.roomFact(),
  },
  session: {
    user: r.one.user({ from: r.session.userId, to: r.user.id, optional: false }),
  },
  account: {
    user: r.one.user({ from: r.account.userId, to: r.user.id, optional: false }),
  },
  cinema: {
    rooms: r.many.room(),
  },
  room: {
    cinema: r.one.cinema({ from: r.room.cinemaId, to: r.cinema.id, optional: false }),
    reviews: r.many.review(),
    facts: r.many.roomFact(),
  },
  roomFact: {
    room: r.one.room({ from: r.roomFact.roomId, to: r.room.id, optional: false }),
    user: r.one.user({ from: r.roomFact.userId, to: r.user.id, optional: false }),
  },
  review: {
    room: r.one.room({ from: r.review.roomId, to: r.room.id, optional: false }),
    user: r.one.user({ from: r.review.userId, to: r.user.id, optional: false }),
  },
}))
