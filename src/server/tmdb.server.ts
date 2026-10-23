// TMDB (themoviedb.org) client: film search for the review form's autocomplete and
// details for the film hover card. Needs TMDB_TOKEN (the v4 "API Read Access Token",
// a Worker secret). This product uses the TMDB API but is not endorsed or certified by TMDB.
import { env } from 'cloudflare:workers'

const API = 'https://api.themoviedb.org/3'
export const TMDB_IMAGES = 'https://image.tmdb.org/t/p'

export type TmdbSuggestion = {
  tmdbId: number
  title: string
  originalTitle: string | null
  year: number | null
  posterPath: string | null
}

export type TmdbDetails = {
  tmdbId: number
  title: string
  year: number | null
  runtime: number | null
  genres: string[]
  imdbId: string | null
  overview: string | null
  tagline: string | null
  director: string | null
  voteAverage: number | null
  backdropPath: string | null
  posterPath: string | null
}

async function tmdb<T>(path: string, params: Record<string, string>): Promise<T> {
  const token = env.TMDB_TOKEN
  if (!token) throw new Error('TMDB_TOKEN is not set')
  const url = `${API}${path}?${new URLSearchParams({ language: 'pt-BR', ...params })}`
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    // Search results and film details barely change: let Cloudflare's edge keep them.
    cf: { cacheTtl: 86_400, cacheEverything: true },
  })
  if (!response.ok) throw new Error(`TMDB ${path} answered ${response.status}`)
  return response.json() as Promise<T>
}

function yearOf(date: string | undefined | null) {
  const year = Number.parseInt(date?.slice(0, 4) ?? '', 10)
  return Number.isFinite(year) ? year : null
}

type SearchResponse = {
  results: Array<{
    id: number
    title: string
    original_title?: string
    release_date?: string
    poster_path?: string | null
    popularity?: number
  }>
}

export async function searchMovies(query: string, year?: number | null): Promise<TmdbSuggestion[]> {
  const data = await tmdb<SearchResponse>('/search/movie', {
    query,
    include_adult: 'false',
    ...(year ? { year: String(year) } : {}),
  })
  // Best-known first (TMDB's own order puts obscure namesakes on top), and one row per title and year.
  const seen = new Set<string>()
  const ranked = [...data.results]
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .filter((r) => {
      const key = `${r.title.toLowerCase()}|${yearOf(r.release_date)}`
      return !seen.has(key) && seen.add(key)
    })
  return ranked.slice(0, 6).map((r) => ({
    tmdbId: r.id,
    title: r.title,
    originalTitle: r.original_title && r.original_title !== r.title ? r.original_title : null,
    year: yearOf(r.release_date),
    posterPath: r.poster_path ?? null,
  }))
}

type DetailsResponse = {
  id: number
  title: string
  release_date?: string
  runtime?: number | null
  genres?: Array<{ name: string }>
  overview?: string
  tagline?: string
  vote_average?: number
  vote_count?: number
  backdrop_path?: string | null
  poster_path?: string | null
  external_ids?: { imdb_id?: string | null }
  credits?: { crew?: Array<{ job: string; name: string }> }
}

export async function getMovieDetails(tmdbId: number): Promise<TmdbDetails> {
  const d = await tmdb<DetailsResponse>(`/movie/${tmdbId}`, { append_to_response: 'credits,external_ids' })
  return {
    tmdbId: d.id,
    title: d.title,
    year: yearOf(d.release_date),
    runtime: d.runtime || null,
    genres: d.genres?.map((g) => g.name) ?? [],
    imdbId: d.external_ids?.imdb_id || null,
    overview: d.overview || null,
    tagline: d.tagline || null,
    director: d.credits?.crew?.find((c) => c.job === 'Director')?.name ?? null,
    // A handful of votes says nothing; hide the score until it means something.
    voteAverage: d.vote_average && (d.vote_count ?? 0) >= 20 ? Math.round(d.vote_average * 10) / 10 : null,
    backdropPath: d.backdrop_path ?? null,
    posterPath: d.poster_path ?? null,
  }
}

/**
 * Best TMDB match for a film a ticket provider lists: original title first, then the
 * Brazilian one, accepted only when the year agrees (when we know it).
 */
export async function matchMovie(film: {
  title: string
  originalTitle: string | null
  releaseYear: number | null
}): Promise<number | null> {
  for (const query of [film.originalTitle, film.title]) {
    if (!query) continue
    const results = await searchMovies(query, film.releaseYear)
    const same = (a: string | null) => a?.trim().toLowerCase() === query.trim().toLowerCase()
    // Without a year to check against, only an exact title will do.
    const hit = results.find((r) =>
      film.releaseYear ? r.year === film.releaseYear : same(r.title) || same(r.originalTitle),
    )
    if (hit) return hit.tmdbId
  }
  return null
}
