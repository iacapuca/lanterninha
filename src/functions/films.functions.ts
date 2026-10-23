import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { searchMovies } from '~/server/tmdb.server'
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
