import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { Viewer } from '~/lib/domain'
import { usernameSchema } from '~/lib/schemas'
import { endSession, readSession, startSession } from '~/server/session.server'

export const getViewer = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Viewer> => readSession(),
)

export const signIn = createServerFn({ method: 'POST' })
  .validator(z.object({ username: usernameSchema }))
  .handler(async ({ data }) => {
    await startSession(data.username)
    return { username: data.username }
  })

export const signOut = createServerFn({ method: 'POST' }).handler(() => {
  endSession()
  return null
})
