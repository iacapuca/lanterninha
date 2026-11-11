import { useEffect, useMemo, useRef, useState } from 'react'
import { z } from 'zod'
import { Link, createFileRoute, redirect, useNavigate, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { removeSeatPhoto } from '~/functions/photos.functions'
import { createReview, getOwnReview, trackReviewDraftStarted, updateReview } from '~/functions/reviews.functions'
import { getRoom } from '~/functions/rooms.functions'
import { toast } from 'sonner'
import {
  CRITERIA,
  CRITERION_IDS,
  photoUrl,
  SEAT_POSITIONS,
  SEAT_POSITION_IDS,
  TAGS,
  type Criterion,
  type SeatPhoto,
  type SeatPosition,
  type Tag,
} from '~/lib/domain'
import { shrinkPhoto, uploadPhoto, type ShrunkPhoto } from '~/lib/photo-resize'
import { newReviewSchema } from '~/lib/schemas'
import { FilmInput } from '~/components/film-input'
import { LanternPicker } from '~/components/lanterns'
import { Button } from '~/components/ui/button'

// SSR: 'data-only'. `beforeLoad` and the loader run on the server (auth
// redirect and room lookup happen before any HTML is sent), but the form
// renders only on the client: it restores an unsent draft from localStorage,
// which would otherwise cause a hydration mismatch.
export const Route = createFileRoute('/rooms/$roomId/review')({
  ssr: 'data-only',
  // ?edit=<review id> edits one of the viewer's own reviews instead of writing a new one.
  validateSearch: z.object({ edit: z.string().min(1).max(80).optional().catch(undefined) }),
  loaderDeps: ({ search }) => ({ edit: search.edit }),
  beforeLoad: ({ context, location }) => {
    // UX guard only; `createReview` enforces the session itself.
    if (!context.viewer) {
      throw redirect({ to: '/sign-in', search: { redirect: location.href } })
    }
    return { viewer: context.viewer }
  },
  loader: async ({ params, deps }) => {
    const [room, editing] = await Promise.all([
      getRoom({ data: { id: params.roomId } }),
      deps.edit ? getOwnReview({ data: { id: deps.edit } }) : null,
    ])
    return { room, editing }
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.editing ? 'Editar avaliação' : 'Avaliar'} ${loaderData.room.name} · Lanterninha`
          : 'Avaliar · Lanterninha',
      },
    ],
  }),
  pendingComponent: () => <div className="panel skeleton" style={{ height: 480 }} />,
  component: ReviewPage,
})

type Draft = {
  rating: number
  criteria: Record<Criterion, number>
  row: string
  seatPosition: SeatPosition | ''
  film: string
  filmTmdbId: number | null
  body: string
  tags: Tag[]
}

const EMPTY_DRAFT: Draft = {
  rating: 0,
  criteria: { picture: 0, sound: 0, comfort: 0, cleanliness: 0 },
  row: '',
  seatPosition: '',
  film: '',
  filmTmdbId: null,
  body: '',
  tags: [],
}

function readDraft(key: string): Draft {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...EMPTY_DRAFT, ...JSON.parse(raw) } : EMPTY_DRAFT
  } catch {
    return EMPTY_DRAFT
  }
}

function ReviewPage() {
  const { room, editing } = Route.useLoaderData()
  const { viewer } = Route.useRouteContext()
  const router = useRouter()
  const navigate = useNavigate()
  const createReviewFn = useServerFn(createReview)
  const updateReviewFn = useServerFn(updateReview)

  const draftKey = `lanterninha:draft:${room.id}`
  const [draft, setDraft] = useState<Draft>(() =>
    editing
      ? { ...editing, row: editing.row ?? '', seatPosition: editing.seatPosition ?? '', film: editing.film ?? '' }
      : readDraft(draftKey),
  )
  // Photos aren't part of the localStorage draft: a file can't be stored there.
  const [photo, setPhoto] = useState<PhotoChoice>(editing?.photo ? { kind: 'saved', photo: editing.photo } : null)
  const removePhoto = useServerFn(removeSeatPhoto)
  const [errors, setErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    // Edits aren't drafts: leaving the page just keeps the published version.
    if (editing) return
    try {
      localStorage.setItem(draftKey, JSON.stringify(draft))
    } catch {
      // Storage may be unavailable (private mode); the draft just won't persist.
    }
  }, [draftKey, draft, editing])

  // Analytics: the first touch on a new review, so drafts can be compared with published reviews.
  const trackDraftStarted = useServerFn(trackReviewDraftStarted)
  const draftTracked = useRef(false)
  const update = (patch: Partial<Draft>) => {
    if (!editing && !draftTracked.current) {
      draftTracked.current = true
      trackDraftStarted({ data: { roomId: room.id } }).catch(() => {})
    }
    setDraft((d) => ({ ...d, ...patch }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    // Same schema the server enforces — validate locally for instant feedback.
    const parsed = newReviewSchema.safeParse({ roomId: room.id, ...draft })
    if (!parsed.success) {
      setErrors([...new Set(parsed.error.issues.map((i) => i.message))])
      return
    }
    if (photo && !parsed.data.row) {
      setErrors(['Diga a fileira para adicionar a vista da poltrona.'])
      return
    }
    setErrors([])
    setSubmitting(true)
    try {
      let reviewId: string
      if (editing) {
        reviewId = (await updateReviewFn({ data: { ...parsed.data, id: editing.id } })).id
      } else {
        reviewId = (await createReviewFn({ data: parsed.data })).id
        try {
          localStorage.removeItem(draftKey)
        } catch {}
      }
      // The review is saved either way; a failed photo only gets a warning.
      try {
        if (photo?.kind === 'new') await uploadPhoto(reviewId, photo.shrunk)
        else if (!photo && editing?.photo) await removePhoto({ data: { reviewId } })
      } catch (err) {
        toast.error('A avaliação foi salva, mas a foto não.', {
          description: err instanceof Error ? err.message : undefined,
        })
      }
      await router.invalidate()
      await navigate({ to: '/rooms/$roomId', params: { roomId: room.id }, search: { reviews: 'recent' } })
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Não foi possível publicar.'])
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="review-form panel" onSubmit={submit} noValidate>
      <p className="eyebrow">
        <Link to="/rooms/$roomId" params={{ roomId: room.id }}>
          ← {room.name} · {room.cinema.name}
        </Link>
      </p>
      <h1>{editing ? 'Editar sua avaliação' : `Como foi a sessão, @${viewer.username}?`}</h1>

      <section>
        <h2>Nota geral</h2>
        <LanternPicker name="rating" value={draft.rating} onChange={(rating) => update({ rating })} />
      </section>

      <section className="criteria-inputs">
        <h2>Por critério</h2>
        {CRITERION_IDS.map((c) => (
          <fieldset key={c} className="segmented">
            <legend>{CRITERIA[c]}</legend>
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className={draft.criteria[c] === n ? 'active' : undefined}>
                <input
                  type="radio"
                  name={`criteria.${c}`}
                  value={n}
                  checked={draft.criteria[c] === n}
                  onChange={() => update({ criteria: { ...draft.criteria, [c]: n } })}
                  className="sr-only"
                />
                {n}
              </label>
            ))}
          </fieldset>
        ))}
      </section>

      <div className="form-row">
        <label className="field">
          <span>Fileira em que você sentou</span>
          <input
            value={draft.row}
            onChange={(e) => update({ row: e.target.value.toUpperCase().slice(0, 2) })}
            placeholder="G"
            maxLength={2}
          />
        </label>
        {/* oxlint-disable-next-line jsx-a11y/label-has-associated-control -- wraps FilmInput's <input> */}
        <label className="field field-grow">
          <span>Filme que você viu</span>
          <FilmInput
            value={draft.film}
            onChange={(film, filmTmdbId) => update({ film, filmTmdbId })}
            placeholder="Ainda Estou Aqui"
          />
        </label>
      </div>

      <section className="seat-view-input">
        <h2>
          Vista da poltrona <span className="muted">(opcional)</span>
        </h2>
        <fieldset className="segmented">
          <legend>Onde na fileira</legend>
          {SEAT_POSITION_IDS.map((p) => (
            <label key={p} className={draft.seatPosition === p ? 'active' : undefined}>
              <input
                type="radio"
                name="seatPosition"
                value={p}
                checked={draft.seatPosition === p}
                onChange={() => update({ seatPosition: p })}
                className="sr-only"
              />
              {SEAT_POSITIONS[p]}
            </label>
          ))}
        </fieldset>
        <PhotoPicker value={photo} onChange={setPhoto} />
      </section>

      <label className="field">
        <span>Sua avaliação</span>
        <textarea
          value={draft.body}
          onChange={(e) => update({ body: e.target.value })}
          rows={6}
          maxLength={2000}
          placeholder="A tela, o som, a poltrona, o ar-condicionado, o público…"
        />
      </label>

      <fieldset>
        <legend>Etiquetas (até 5)</legend>
        <ul className="tags tags-toggle">
          {TAGS.map((tag) => {
            const on = draft.tags.includes(tag)
            return (
              <li key={tag}>
                <button
                  type="button"
                  aria-pressed={on}
                  disabled={!on && draft.tags.length >= 5}
                  onClick={() => update({ tags: on ? draft.tags.filter((t) => t !== tag) : [...draft.tags, tag] })}
                >
                  {tag}
                </button>
              </li>
            )
          })}
        </ul>
      </fieldset>

      {errors.length > 0 && (
        <ul className="form-errors" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div className="form-actions">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Salvando…' : editing ? 'Salvar alterações' : 'Publicar avaliação'}
        </Button>
        <span className="muted">
          {editing ? 'A data da avaliação continua a mesma.' : 'Rascunho salvo neste navegador.'}
        </span>
      </div>
    </form>
  )
}

type PhotoChoice = { kind: 'saved'; photo: SeatPhoto } | { kind: 'new'; shrunk: ShrunkPhoto } | null

/** Pick, preview, swap or remove the seat photo; it's shrunk right away so the preview is what gets sent. */
function PhotoPicker({ value, onChange }: { value: PhotoChoice; onChange: (next: PhotoChoice) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const preview = useMemo(
    () => (value?.kind === 'new' ? URL.createObjectURL(value.shrunk.blob) : value ? photoUrl(value.photo.id) : null),
    [value],
  )
  useEffect(() => () => void (preview?.startsWith('blob:') && URL.revokeObjectURL(preview)), [preview])

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      onChange({ kind: 'new', shrunk: await shrinkPhoto(file) })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não deu para usar essa foto.')
    } finally {
      setBusy(false)
    }
  }

  const input = <input type="file" accept="image/*" onChange={pick} className="sr-only" disabled={busy} />
  return (
    <div className="photo-picker">
      {preview ? (
        <figure>
          <img src={preview} alt="Prévia da vista da sua poltrona" />
          <figcaption>
            <label className="link-button">
              {input}
              Trocar foto
            </label>
            <button type="button" className="link-button" onClick={() => onChange(null)}>
              Remover
            </button>
          </figcaption>
        </figure>
      ) : (
        <label className="photo-drop">
          {input}
          {busy ? 'Preparando a foto…' : '+ Foto da tela vista do seu lugar'}
        </label>
      )}
      {error && (
        <p className="form-errors" role="alert">
          {error}
        </p>
      )}
      <p className="muted">
        A tela como você a viu, sem pessoas em destaque. A localização e outros dados da foto são removidos antes do
        envio.
      </p>
    </div>
  )
}
