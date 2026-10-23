// Fills in TMDB details (synopsis, director, score, Letterboxd/IMDb ids) for films the
// providers list. Runs on the half-hourly cron after the syncs, a few films per run so a
// big programme never exhausts the Worker's subrequest budget.
import { and, eq, isNull, lt, or } from 'drizzle-orm'
import { db } from '../db/client.server'
import { film } from '../db/schema.server'
import { getMovieDetails, matchMovie } from '../tmdb.server'

const BATCH = 15
const RETRY_MISSES_AFTER_MS = 3 * 24 * 60 * 60 * 1000

export async function enrichFilms() {
  const pending = await db
    .select()
    .from(film)
    .where(
      or(
        isNull(film.enrichedAt),
        and(isNull(film.tmdbId), lt(film.enrichedAt, new Date(Date.now() - RETRY_MISSES_AFTER_MS))),
      ),
    )
    .limit(BATCH)
  let matched = 0
  for (const row of pending) {
    try {
      const tmdbId = row.tmdbId ?? (await matchMovie(row))
      const details = tmdbId ? await getMovieDetails(tmdbId) : null
      await db
        .update(film)
        .set({
          tmdbId,
          imdbId: details?.imdbId ?? null,
          overview: details?.overview ?? null,
          tagline: details?.tagline ?? null,
          director: details?.director ?? null,
          tmdbRating: details?.voteAverage ?? null,
          backdropPath: details?.backdropPath ?? null,
          // Providers without a poster borrow TMDB's.
          posterUrl:
            row.posterUrl ?? (details?.posterPath ? `https://image.tmdb.org/t/p/w342${details.posterPath}` : null),
          enrichedAt: new Date(),
        })
        .where(eq(film.id, row.id))
      if (tmdbId) matched++
    } catch (error) {
      // Leave enrichedAt alone: a failed call (rate limit, outage) is retried next run.
      console.error(`tmdb: enriching film ${row.id} failed`, error)
    }
  }
  const summary = { checked: pending.length, matched }
  console.log('tmdb enrich', JSON.stringify(summary))
  return summary
}
