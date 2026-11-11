import { Link, createFileRoute } from '@tanstack/react-router'
import { getRankingHub } from '~/functions/rankings.functions'
import { FORMATS, NATIONAL_SLUG } from '~/lib/domain'
import { pluralize } from '~/lib/format'
import { SITE_URL, shareMeta } from '~/lib/site'
import { RankedRooms } from '~/components/ranking'

const TITLE = 'As melhores salas de cinema do Brasil · Lanterninha'
const DESCRIPTION =
  'Rankings de salas de cinema por cidade e por formato (IMAX, 4DX, VIP…), com as notas da comunidade.'

// SSR: full. The rankings hub: the national top 10, then every city and format with a ranking.
export const Route = createFileRoute('/melhores-salas/')({
  loader: () => getRankingHub(),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      ...shareMeta({
        title: TITLE,
        description: DESCRIPTION,
        path: '/melhores-salas',
        image: `/og/ranking/${NATIONAL_SLUG}`,
      }),
    ],
    links: [{ rel: 'canonical', href: `${SITE_URL}/melhores-salas` }],
  }),
  component: RankingHub,
})

function RankingHub() {
  const { top, places, formats } = Route.useLoaderData()
  return (
    <>
      <header className="page-head">
        <p className="eyebrow">Melhores salas</p>
        <h1>As melhores salas de cinema do Brasil</h1>
        <p className="muted">Pelas notas de quem estava lá. Escolha uma cidade ou um formato.</p>
      </header>

      {formats.length > 0 && (
        <section className="section">
          <h2>Por formato</h2>
          <ul className="chip-list">
            {formats.map((f) => (
              <li key={f}>
                <Link to="/melhores-salas/$place/$format" params={{ place: NATIONAL_SLUG, format: f }} className="chip">
                  {FORMATS[f]}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2>Top 10 do Brasil</h2>
          <Link to="/melhores-salas/$place" params={{ place: NATIONAL_SLUG }}>
            Ver o ranking completo →
          </Link>
        </div>
        {top.length === 0 ? (
          <p className="muted">
            Nenhuma sala avaliada ainda. <Link to="/cinemas">Encontre a sua e seja a primeira pessoa a avaliar →</Link>
          </p>
        ) : (
          <RankedRooms rooms={top} />
        )}
      </section>

      {places.length > 0 && (
        <section className="section">
          <h2>Por cidade</h2>
          <ul className="chip-list">
            {places.map((p) => (
              <li key={p.slug}>
                <Link
                  to="/melhores-salas/$place"
                  params={{ place: p.slug }}
                  className="chip"
                  title={pluralize(p.reviews, 'avaliação', 'avaliações')}
                >
                  {p.city}/{p.state}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
