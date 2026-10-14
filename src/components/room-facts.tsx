import { useState } from 'react'
import { Link, useLocation, useRouteContext, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { voteRoomFact } from '~/functions/reviews.functions'
import { BADGES, ROOM_FACTS, ROOM_FACT_FIELDS, type FactSource, type RoomFactField } from '~/lib/domain'
import { pluralize } from '~/lib/format'
import { roomFactVoteSchema } from '~/lib/schemas'

type Props = {
  roomId: string
  values: Record<RoomFactField, string | null>
  sources: Record<RoomFactField, FactSource | null>
  votes: Record<RoomFactField, Array<{ value: string; votes: number }>>
  mine: Partial<Record<RoomFactField, string>>
}

const label = (field: RoomFactField, value: string) =>
  (ROOM_FACTS[field].options as Record<string, string>)[value] ?? value

/** The room's spec sheet. Unknown details invite the community to fill them in. */
export function RoomFacts({ roomId, values, sources, votes, mine }: Props) {
  const [editing, setEditing] = useState<RoomFactField | null>(null)
  const [unlocked, setUnlocked] = useState<string[]>([])

  return (
    <div className="room-facts">
      <dl className="ticket-fields">
        {ROOM_FACT_FIELDS.map((field) => {
          const value = values[field]
          const total = votes[field].reduce((n, v) => n + v.votes, 0)
          return (
            <div key={field}>
              <dt>{ROOM_FACTS[field].label}</dt>
              <dd>
                {value ? (
                  <>
                    {label(field, value)}{' '}
                    <button type="button" className="fact-source" onClick={() => setEditing(field)}>
                      {sources[field] === 'community'
                        ? `segundo ${pluralize(total, 'pessoa', 'pessoas')}`
                        : 'pelo nome na ANCINE'}{' '}
                      · corrigir
                    </button>
                  </>
                ) : (
                  <button type="button" className="fact-cta" onClick={() => setEditing(field)}>
                    + {ROOM_FACTS[field].cta}
                  </button>
                )}
              </dd>
            </div>
          )
        })}
      </dl>

      {editing && (
        <FactForm
          roomId={roomId}
          field={editing}
          current={mine[editing] ?? null}
          onDone={(badges) => {
            setEditing(null)
            setUnlocked(badges)
          }}
          onCancel={() => setEditing(null)}
        />
      )}

      {unlocked.length > 0 && (
        <div className="badge-toast" role="status">
          {unlocked.map((id) => {
            const badge = BADGES.find((b) => b.id === id)!
            return (
              <p key={id}>
                <span aria-hidden="true">{badge.emoji}</span> Você ganhou <strong>{badge.name}</strong>!
              </p>
            )
          })}
          <button type="button" className="link-button" onClick={() => setUnlocked([])}>
            Fechar
          </button>
        </div>
      )}
    </div>
  )
}

function FactForm({
  roomId,
  field,
  current,
  onDone,
  onCancel,
}: {
  roomId: string
  field: RoomFactField
  current: string | null
  onDone: (newBadges: string[]) => void
  onCancel: () => void
}) {
  const { viewer } = useRouteContext({ from: '__root__' })
  const location = useLocation()
  const router = useRouter()
  const vote = useServerFn(voteRoomFact)
  const [value, setValue] = useState(current ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (!viewer) {
    return (
      <div className="fact-form">
        <p>Entre para contribuir com a ficha técnica e ganhar badges.</p>
        <Link to="/sign-in" search={{ mode: 'register', redirect: location.href }} className="button button-small">
          Criar conta
        </Link>{' '}
        <button type="button" className="link-button" onClick={onCancel}>
          Agora não
        </button>
      </div>
    )
  }

  return (
    <form
      className="fact-form"
      onSubmit={async (e) => {
        e.preventDefault()
        // Same schema the server enforces; it also narrows `value` to the field's options.
        const parsed = roomFactVoteSchema.safeParse({ roomId, field, value })
        if (!parsed.success) return setError('Escolha uma opção')
        setPending(true)
        try {
          const { newBadges } = await vote({ data: parsed.data })
          await router.invalidate()
          onDone(newBadges)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Não foi possível salvar.')
        } finally {
          setPending(false)
        }
      }}
    >
      <label className="field">
        <span>{ROOM_FACTS[field].label}</span>
        <select value={value} onChange={(e) => setValue(e.target.value)} autoFocus>
          <option value="">Escolha…</option>
          {Object.entries(ROOM_FACTS[field].options).map(([id, text]) => (
            <option key={id} value={id}>
              {text}
            </option>
          ))}
        </select>
      </label>
      {error && <p className="form-errors">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="button button-small" disabled={pending}>
          {pending ? 'Salvando…' : current ? 'Atualizar' : 'Salvar'}
        </button>
        <button type="button" className="link-button" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
