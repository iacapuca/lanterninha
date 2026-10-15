import { createFileRoute, redirect } from '@tanstack/react-router'
import { exploreSearchSchema } from '~/lib/schemas'

// Explorar lists cinemas now; old /rooms links (and bookmarks) keep their filters.
export const Route = createFileRoute('/rooms/')({
  validateSearch: exploreSearchSchema,
  beforeLoad: ({ search }) => {
    throw redirect({ to: '/cinemas', search, statusCode: 301 })
  },
})
