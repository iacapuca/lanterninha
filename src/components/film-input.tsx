import { useEffect, useId, useRef, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { searchFilms } from '~/functions/films.functions'

type Suggestion = Awaited<ReturnType<typeof searchFilms>>[number]

type Props = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

/** Free-text film field with TMDB suggestions: picking one fills in the title, typing anything else still works. */
export function FilmInput({ value, onChange, placeholder }: Props) {
  const search = useServerFn(searchFilms)
  const listId = useId()
  const [options, setOptions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  // Set when the text came from picking a suggestion, so the pick doesn't search again.
  const picked = useRef<string | null>(null)

  useEffect(() => {
    const q = value.trim()
    if (q.length < 2 || picked.current === value) {
      setOptions([])
      return
    }
    let stale = false
    const timer = setTimeout(() => {
      search({ data: { q } })
        .then((results) => {
          if (stale) return
          setOptions(results)
          setActive(-1)
        })
        .catch(() => !stale && setOptions([]))
    }, 250)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [value, search])

  function pick(option: Suggestion) {
    // The Brazilian title, as people say it at the box office.
    picked.current = option.title
    onChange(option.title)
    setOpen(false)
  }

  const showList = open && options.length > 0

  return (
    <div className="film-input">
      <input
        value={value}
        onChange={(e) => {
          picked.current = null
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (!showList) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((i) => (i + 1) % options.length)
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((i) => (i <= 0 ? options.length - 1 : i - 1))
          } else if (e.key === 'Enter' && active >= 0) {
            e.preventDefault()
            pick(options[active]!)
          } else if (e.key === 'Escape') setOpen(false)
        }}
        placeholder={placeholder}
        maxLength={120}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
      />
      {showList && (
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role -- standard ARIA combobox listbox
        <ul id={listId} role="listbox" className="film-options">
          {options.map((o, i) => (
            // onMouseDown, not onClick: the input's blur would close the list first.
            <li
              key={o.tmdbId}
              id={`${listId}-${i}`}
              // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role -- ARIA option
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(o)
              }}
            >
              {o.posterPath ? (
                <img src={`https://image.tmdb.org/t/p/w92${o.posterPath}`} alt="" loading="lazy" />
              ) : (
                <span className="film-options-noposter" aria-hidden="true" />
              )}
              <span>
                <strong>{o.title}</strong>
                <small>{[o.year, o.originalTitle].filter(Boolean).join(' · ')}</small>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
