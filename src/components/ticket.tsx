// Visual identity: everything worth keeping is printed on a cinema ticket.
import type { ReactNode } from 'react'

/** Deterministic serial number for a ticket, derived from an id (stable across SSR/hydration). */
export function ticketSerial(id: string) {
  let hash = 2166136261
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619)
  return `Nº ${String((hash >>> 0) % 1_000_000).padStart(6, '0')}`
}

/**
 * A ticket with a torn-off stub separated by a perforated line.
 * `orientation="vertical"` puts the stub at the bottom (cards in a grid);
 * `horizontal` puts it on the right and falls back to vertical on narrow screens.
 */
export function Ticket({
  stub,
  children,
  orientation = 'horizontal',
  className,
}: {
  stub: ReactNode
  children: ReactNode
  orientation?: 'horizontal' | 'vertical'
  className?: string
}) {
  return (
    <div className={['ticket', `ticket-${orientation}`, className].filter(Boolean).join(' ')}>
      <div className="ticket-main">{children}</div>
      <div className="ticket-stub">{stub}</div>
    </div>
  )
}
