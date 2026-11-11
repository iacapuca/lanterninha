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
    helpfulMarks: r.many.reviewHelpful(),
    following: r.many.follow({ from: r.user.id, to: r.follow.followerId, alias: 'follower' }),
    followers: r.many.follow({ from: r.user.id, to: r.follow.followingId, alias: 'following' }),
  },
  session: {
    user: r.one.user({ from: r.session.userId, to: r.user.id, optional: false }),
  },
  account: {
    user: r.one.user({ from: r.account.userId, to: r.user.id, optional: false }),
  },
  cinema: {
    rooms: r.many.room(),
    showtimes: r.many.showtime(),
  },
  film: {
    showtimes: r.many.showtime(),
  },
  showtime: {
    film: r.one.film({ from: r.showtime.filmId, to: r.film.id, optional: false }),
    room: r.one.room({ from: r.showtime.roomId, to: r.room.id }),
    cinema: r.one.cinema({ from: r.showtime.cinemaId, to: r.cinema.id, optional: false }),
  },
  room: {
    cinema: r.one.cinema({ from: r.room.cinemaId, to: r.cinema.id, optional: false }),
    reviews: r.many.review(),
    facts: r.many.roomFact(),
    showtimes: r.many.showtime(),
  },
  roomFact: {
    room: r.one.room({ from: r.roomFact.roomId, to: r.room.id, optional: false }),
    user: r.one.user({ from: r.roomFact.userId, to: r.user.id, optional: false }),
  },
  review: {
    room: r.one.room({ from: r.review.roomId, to: r.room.id, optional: false }),
    user: r.one.user({ from: r.review.userId, to: r.user.id, optional: false }),
    helpfulMarks: r.many.reviewHelpful(),
  },
  reviewHelpful: {
    review: r.one.review({ from: r.reviewHelpful.reviewId, to: r.review.id, optional: false }),
    user: r.one.user({ from: r.reviewHelpful.userId, to: r.user.id, optional: false }),
  },
  follow: {
    follower: r.one.user({ from: r.follow.followerId, to: r.user.id, optional: false, alias: 'follower' }),
    following: r.one.user({ from: r.follow.followingId, to: r.user.id, optional: false, alias: 'following' }),
  },
}))
