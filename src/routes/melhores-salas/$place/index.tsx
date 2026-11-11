import { createFileRoute } from '@tanstack/react-router'
import { getRanking } from '~/functions/rankings.functions'
import { RankingPage, rankingHead } from '~/components/ranking'

// SSR: full. Shareable, indexable rankings: /melhores-salas/sao-paulo-sp, /melhores-salas/brasil.
export const Route = createFileRoute('/melhores-salas/$place/')({
  loader: ({ params }) => getRanking({ data: { place: params.place } }),
  head: ({ loaderData }) => rankingHead(loaderData),
  component: PlaceRanking,
})

function PlaceRanking() {
  return <RankingPage {...Route.useLoaderData()} />
}
