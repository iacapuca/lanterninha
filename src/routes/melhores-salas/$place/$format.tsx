import { createFileRoute } from '@tanstack/react-router'
import { getRanking } from '~/functions/rankings.functions'
import { RankingPage, rankingHead } from '~/components/ranking'

// SSR: full. One format in one place: /melhores-salas/sao-paulo-sp/imax, /melhores-salas/brasil/4dx.
export const Route = createFileRoute('/melhores-salas/$place/$format')({
  loader: ({ params }) => getRanking({ data: { place: params.place, format: params.format } }),
  head: ({ loaderData }) => rankingHead(loaderData),
  component: PlaceRanking,
})

function PlaceRanking() {
  return <RankingPage {...Route.useLoaderData()} />
}
