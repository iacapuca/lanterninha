import { useState } from 'react'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { signIn } from '~/functions/session.functions'
import { usernameSchema } from '~/lib/schemas'

// Only same-origin relative paths are accepted as a post-login destination.
const signInSearchSchema = z.object({
  redirect: z
    .string()
    .regex(/^\/(?!\/)/)
    .optional()
    .catch(undefined),
})

// SSR: full. Already signed-in visitors are redirected on the server.
export const Route = createFileRoute('/sign-in')({
  validateSearch: signInSearchSchema,
  beforeLoad: ({ context, search }) => {
    if (context.viewer) throw redirect({ href: search.redirect ?? '/' })
  },
  head: () => ({ meta: [{ title: 'Entrar · Lanterninha' }] }),
  component: SignInPage,
})

function SignInPage() {
  const search = Route.useSearch()
  const router = useRouter()
  const signInFn = useServerFn(signIn)
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  return (
    <section className="auth panel">
      <p className="eyebrow">Entrar</p>
      <h1>Pegue sua lanterna</h1>
      <p className="muted">
        Escolha um apelido para assinar suas avaliações. (Demonstração: sem senha, sem e-mail.)
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          const parsed = usernameSchema.safeParse(username)
          if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? 'Apelido inválido')
            return
          }
          setPending(true)
          try {
            await signInFn({ data: { username: parsed.data } })
            await router.invalidate()
            await router.navigate({ href: search.redirect ?? '/' })
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível entrar.')
          } finally {
            setPending(false)
          }
        }}
      >
        <label className="field">
          <span>Apelido</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="fileira_g"
            autoComplete="username"
            autoFocus
          />
        </label>
        {error && (
          <p className="form-errors" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="button" disabled={pending}>
          {pending ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </section>
  )
}
