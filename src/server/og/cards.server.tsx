// The share cards: a paper cinema ticket on the site's dark curtain, like the
// room and review cards. Inline styles only (satori's CSS subset).
const C = {
  bg: '#120d0a',
  paper: '#f3e7d0',
  shade: '#e6d5b5',
  ink: '#2b1a10',
  inkSoft: '#6e5644',
  red: '#a8231b',
  amber: '#ffb547',
}

/** Five lanterns as dots: filled, half, or empty. */
function LanternDots({ rating }: { rating: number | null }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = rating == null ? 0 : Math.max(0, Math.min(1, rating - (n - 1)))
        return (
          <div
            key={n}
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              border: `3px solid ${C.amber}`,
              background:
                fill >= 1 ? C.amber : fill > 0 ? `linear-gradient(90deg, ${C.amber} 50%, transparent 50%)` : 'transparent',
            }}
          />
        )
      })}
    </div>
  )
}

type Ticket = {
  kicker: string
  title: string
  subtitle: string
  chips: string[]
  rating: number | null
  reviewCount: number
}

const formatRating = (n: number) => n.toFixed(1).replace('.', ',')
const plural = (n: number, one: string, many: string) => `${n.toLocaleString('pt-BR')} ${n === 1 ? one : many}`

export function TicketCard({ kicker, title, subtitle, chips, rating, reviewCount }: Ticket) {
  const notch = { position: 'absolute' as const, left: 812, width: 36, height: 36, borderRadius: 18, background: C.bg }
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '0 70px',
        background: `radial-gradient(circle at 70% 20%, #3a1d0e 0%, ${C.bg} 60%)`,
        fontFamily: 'Figtree',
      }}
    >
      <div style={{ display: 'flex', position: 'relative', height: 430, borderRadius: 18, overflow: 'hidden' }}>
        {/* Main part of the ticket */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: 830,
            padding: '44px 48px',
            background: C.paper,
          }}
        >
          <div style={{ display: 'flex', color: C.red, fontSize: 22, fontWeight: 600, letterSpacing: 4, textTransform: 'uppercase' }}>
            {kicker}
          </div>
          <div
            style={{
              display: 'block',
              marginTop: 18,
              fontFamily: 'Fraunces',
              fontSize: title.length > 34 ? 60 : 74,
              lineHeight: 1.05,
              color: C.ink,
              lineClamp: 2,
            }}
          >
            {title}
          </div>
          <div style={{ display: 'flex', marginTop: 16, fontSize: 30, color: C.inkSoft }}>{subtitle}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 'auto' }}>
            {chips.map((chip) => (
              <div
                key={chip}
                style={{
                  display: 'flex',
                  padding: '6px 18px',
                  borderRadius: 999,
                  border: `2px solid ${C.ink}33`,
                  color: C.ink,
                  fontSize: 24,
                  fontWeight: 600,
                }}
              >
                {chip}
              </div>
            ))}
          </div>
        </div>
        {/* Stub, past the perforation */}
        <div
          style={{
            display: 'flex',
            flex: 1,
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            background: C.shade,
            borderLeft: `4px dashed ${C.ink}40`,
          }}
        >
          <div style={{ display: 'flex', fontFamily: 'Fraunces', fontSize: 120, lineHeight: 1, color: C.red }}>
            {rating == null ? '—' : formatRating(rating)}
          </div>
          <LanternDots rating={rating} />
          <div style={{ display: 'flex', fontSize: 24, color: C.inkSoft, fontWeight: 600 }}>
            {reviewCount > 0 ? plural(reviewCount, 'avaliação', 'avaliações') : 'Avalie primeiro!'}
          </div>
        </div>
        <div style={{ ...notch, top: -18 }} />
        <div style={{ ...notch, bottom: -18 }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 34, color: C.paper, fontSize: 28 }}>
        <div style={{ display: 'flex', fontFamily: 'Fraunces', fontSize: 34 }}>lanterninha</div>
        <div style={{ display: 'flex', color: '#a8968a' }}>· avaliações de salas de cinema · lanterninha.review</div>
      </div>
    </div>
  )
}

export function SiteCard() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '0 90px',
        background: `radial-gradient(circle at 75% 25%, #4a2410 0%, ${C.bg} 62%)`,
        fontFamily: 'Figtree',
        color: C.paper,
      }}
    >
      <div style={{ display: 'flex', color: C.amber, fontSize: 26, fontWeight: 600, letterSpacing: 5, textTransform: 'uppercase' }}>
        Avaliações colaborativas de salas de cinema
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 26, fontFamily: 'Fraunces', fontSize: 92, lineHeight: 1.02 }}>
        <span>O filme você já escolheu.</span>
        <span style={{ color: C.amber }}>Agora escolha a sala.</span>
      </div>
      <div style={{ display: 'flex', marginTop: 40, fontSize: 32, color: '#a8968a' }}>
        Tela, som, poltrona e limpeza avaliados por quem estava lá · lanterninha.review
      </div>
    </div>
  )
}

export { plural }
