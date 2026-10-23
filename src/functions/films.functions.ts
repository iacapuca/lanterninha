import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { FilmCardData } from '~/components/film-card'
import { isKnownTmdbId } from '~/server/store.server'
import { getMovieDetails, searchMovies } from '~/server/tmdb.server'
import { requireSession } from './auth.middleware'

/** Autocomplete for the review form's "film you saw" field. Signed-in users only: it spends our TMDB quota. */
export const searchFilms = createServerFn({ method: 'GET' })
  .middleware([requireSession])
  .validator(z.object({ q: z.string().trim().min(2).max(80) }))
  .handler(async ({ data }) => {
    try {
      return await searchMovies(data.q)
    } catch (error) {
      // Autocomplete is a nicety: the field still accepts free text when TMDB is down.
      console.error('searchFilms failed', error)
      return []
    }
  })

/** Hover-card data for a film a review points at. Public like the reviews themselves, but only for ids we hold. */
export const getFilmCard = createServerFn({ method: 'GET' })
  .validator(z.object({ tmdbId: z.number().int().positive() }))
  .handler(async ({ data }) => {
    if (!(await isKnownTmdbId(data.tmdbId))) return null
    try {
      const d = await getMovieDetails(data.tmdbId)
      return {
        title: d.title,
        posterUrl: d.posterPath ? `https://image.tmdb.org/t/p/w342${d.posterPath}` : null,
        durationMinutes: d.runtime,
        contentRating: null,
        genres: d.genres,
        releaseYear: d.year,
        tmdbId: d.tmdbId,
        imdbId: d.imdbId,
        overview: d.overview,
        tagline: d.tagline,
        director: d.director,
        tmdbRating: d.voteAverage,
        backdropPath: d.backdropPath,
      } satisfies FilmCardData
    } catch (error) {
      console.error('getFilmCard failed', error)
      return null
    }
  })
