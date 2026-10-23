import { useState } from 'react'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '~/components/ui/hover-card'

export type FilmCardData = {
  title: string
  posterUrl: string | null
  durationMinutes: number | null
  contentRating: string | null
  genres: string[]
  releaseYear: number | null
  tmdbId: number | null
  imdbId: string | null
  overview: string | null
  tagline: string | null
  director: string | null
  tmdbRating: number | null
  backdropPath: string | null
}

/** Letterboxd redirects /tmdb/<id> to the film; without a match, fall back to its search. */
export function letterboxdUrl(film: Pick<FilmCardData, 'title' | 'tmdbId' | 'imdbId'>) {
  if (film.tmdbId) return `https://letterboxd.com/tmdb/${film.tmdbId}/`
  if (film.imdbId) return `https://letterboxd.com/imdb/${film.imdbId}/`
  return `https://letterboxd.com/search/${encodeURIComponent(film.title)}/`
}

/**
 * A film title that opens a small card on hover (and on tap, since touch has no hover):
 * backdrop, synopsis, director, TMDB score and a link to Letterboxd.
 */
export function FilmTitle({ film }: { film: FilmCardData }) {
  const [open, setOpen] = useState(false)
  const meta = [film.releaseYear, film.durationMinutes && `${film.durationMinutes} min`, film.genres[0]].filter(Boolean)

  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={200} closeDelay={120}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="cursor-help text-left font-heading text-base leading-tight font-bold decoration-dotted underline-offset-4 hover:underline"
        >
          {film.title}
        </button>
      </HoverCardTrigger>
      <HoverCardContent side="top" className="w-80! overflow-hidden bg-paper p-0 text-ink">
        {film.backdropPath && (
          <img
            src={`https://image.tmdb.org/t/p/w500${film.backdropPath}`}
            alt=""
            loading="lazy"
            className="aspect-video w-full object-cover"
          />
        )}
        <div className="flex flex-col gap-2 p-3">
          <div>
            <p className="font-heading text-lg leading-tight font-bold">{film.title}</p>
            {film.tagline && <p className="text-xs text-ink/60 italic">{film.tagline}</p>}
          </div>
          <p className="text-xs text-ink/70">
            {meta.join(' · ')}
            {film.director && ` · Direção de ${film.director}`}
          </p>
          {film.overview && <p className="line-clamp-5 text-sm leading-snug">{film.overview}</p>}
          <div className="mt-1 flex items-center justify-between gap-2 text-xs">
            {film.tmdbRating ? (
              <span title="Nota média no TMDB">⭐ {film.tmdbRating.toFixed(1).replace('.', ',')}/10</span>
            ) : (
              <span />
            )}
            <a
              href={letterboxdUrl(film)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-ink px-3 py-1 font-semibold text-paper no-underline"
            >
              Ver no Letterboxd ↗
            </a>
          </div>
          {film.tmdbId && <p className="text-[0.65rem] text-ink/40">Dados: TMDB</p>}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
