import { useState } from 'react'
import { Link, useLocation, useRouteContext, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { toast } from 'sonner'
import { voteRoomFact } from '~/functions/reviews.functions'
import { BADGES, badgeImage, ROOM_FACTS, ROOM_FACT_FIELDS, type FactSource, type RoomFactField } from '~/lib/domain'
import { pluralize } from '~/lib/format'
import { roomFactVoteSchema } from '~/lib/schemas'
import { Button } from '~/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'

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
  return (
    <dl className="ticket-fields room-facts">
      {ROOM_FACT_FIELDS.map((field) => {
        const value = values[field]
        const total = votes[field].reduce((n, v) => n + v.votes, 0)
        return (
          <div key={field}>
            <dt>{ROOM_FACTS[field].label}</dt>
            <dd>
              {value && <>{label(field, value)} </>}
              <FactPopover roomId={roomId} field={field} current={mine[field] ?? null}>
                {value ? (
                  <button type="button" className="fact-source">
                    {sources[field] === 'community'
                      ? `segundo ${pluralize(total, 'pessoa', 'pessoas')}`
                      : sources[field] === 'ingresso'
                        ? 'via Ingresso.com'
                        : 'pelo nome na ANCINE'}{' '}
                    · corrigir
                  </button>
                ) : (
                  <button type="button" className="fact-cta">
                    + {ROOM_FACTS[field].cta}
                  </button>
                )}
              </FactPopover>
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

function FactPopover({
  roomId,
  field,
  current,
  children,
}: {
  roomId: string
  field: RoomFactField
  current: string | null
  children: React.ReactNode
}) {
  const { viewer } = useRouteContext({ from: '__root__' })
  const location = useLocation()
  const router = useRouter()
  const vote = useServerFn(voteRoomFact)
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(current ?? '')
  const [pending, setPending] = useState(false)

  async function save() {
    // Same schema the server enforces; it also narrows `value` to the field's options.
    const parsed = roomFactVoteSchema.safeParse({ roomId, field, value })
    if (!parsed.success) return toast.error('Escolha uma opção')
    setPending(true)
    try {
      const { newBadges } = await vote({ data: parsed.data })
      await router.invalidate()
      setOpen(false)
      toast.success('Obrigado! A ficha da sala foi atualizada.')
      for (const id of newBadges) {
        const badge = BADGES.find((b) => b.id === id)
        if (badge)
          toast(`Você ganhou ${badge.name}!`, {
            description: badge.hint,
            duration: 8000,
            icon: <img src={badgeImage(badge.id)} alt="" className="toast-stamp" width={40} height={40} />,
          })
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        {viewer ? (
          <div className="flex flex-col gap-3">
            <p className="font-heading text-base font-bold">{ROOM_FACTS[field].label}</p>
            <Select value={value} onValueChange={setValue}>
              <SelectTrigger className="w-full border-ink/20 bg-white/40 text-ink">
                <SelectValue placeholder="Escolha…" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROOM_FACTS[field].options).map(([id, text]) => (
                  <SelectItem key={id} value={id}>
                    {text}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ink" size="sm" onClick={save} disabled={pending || !value}>
              {pending ? 'Salvando…' : current ? 'Atualizar' : 'Salvar'}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 text-sm">
            <p>Entre para contribuir com a ficha técnica e ganhar badges.</p>
            <Button asChild variant="ink" size="sm">
              <Link to="/sign-in" search={{ mode: 'register', redirect: location.href }}>
                Criar conta
              </Link>
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
