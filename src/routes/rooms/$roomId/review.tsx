import { useEffect, useState } from 'react'
import { Link, createFileRoute, redirect, useNavigate, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { createReview } from '~/functions/reviews.functions'
import { getRoom } from '~/functions/rooms.functions'
import { CRITERIA, CRITERION_IDS, TAGS, type Criterion, type Tag } from '~/lib/domain'
import { newReviewSchema } from '~/lib/schemas'
import { LanternPicker } from '~/components/lanterns'
import { Button } from '~/components/ui/button'

// SSR: 'data-only'. `beforeLoad` and the loader run on the server (auth
// redirect and room lookup happen before any HTML is sent), but the form
// renders only on the client: it restores an unsent draft from localStorage,
// which would otherwise cause a hydration mismatch.
export const Route = createFileRoute('/rooms/$roomId/review')({
  ssr: 'data-only',
  beforeLoad: ({ context, location }) => {
    // UX guard only; `createReview` enforces the session itself.
    if (!context.viewer) {
      throw redirect({ to: '/sign-in', search: { redirect: location.href } })
    }
    return { viewer: context.viewer }
  },
  loader: ({ params }) => getRoom({ data: { id: params.roomId } }),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `Avaliar ${loaderData.name} · Lanterninha` : 'Avaliar · Lanterninha' }],
  }),
  pendingComponent: () => <div className="panel skeleton" style={{ height: 480 }} />,
  component: ReviewPage,
})

type Draft = {
  rating: number
  criteria: Record<Criterion, number>
  row: string
  film: string
  body: string
  tags: Tag[]
}

const EMPTY_DRAFT: Draft = {
  rating: 0,
  criteria: { picture: 0, sound: 0, comfort: 0, cleanliness: 0 },
  row: '',
  film: '',
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
  const room = Route.useLoaderData()
  const { viewer } = Route.useRouteContext()
  const router = useRouter()
  const navigate = useNavigate()
  const createReviewFn = useServerFn(createReview)

  const draftKey = `lanterninha:draft:${room.id}`
  const [draft, setDraft] = useState(() => readDraft(draftKey))
  const [errors, setErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(draft))
    } catch {
      // Storage may be unavailable (private mode); the draft just won't persist.
    }
  }, [draftKey, draft])

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    // Same schema the server enforces — validate locally for instant feedback.
    const parsed = newReviewSchema.safeParse({ roomId: room.id, ...draft })
    if (!parsed.success) {
      setErrors([...new Set(parsed.error.issues.map((i) => i.message))])
      return
    }
    setErrors([])
    setSubmitting(true)
    try {
      await createReviewFn({ data: parsed.data })
      try {
        localStorage.removeItem(draftKey)
      } catch {}
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
      <h1>Como foi a sessão, @{viewer.username}?</h1>

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
        <label className="field field-grow">
          <span>Filme que você viu</span>
          <input
            value={draft.film}
            onChange={(e) => update({ film: e.target.value })}
            placeholder="Ainda Estou Aqui"
            maxLength={120}
          />
        </label>
      </div>

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
                  onClick={() =>
                    update({ tags: on ? draft.tags.filter((t) => t !== tag) : [...draft.tags, tag] })
                  }
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
          {submitting ? 'Publicando…' : 'Publicar avaliação'}
        </Button>
        <span className="muted">Rascunho salvo neste navegador.</span>
      </div>
    </form>
  )
}
