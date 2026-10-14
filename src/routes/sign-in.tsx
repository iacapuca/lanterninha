import { useState } from 'react'
import { Link, createFileRoute, redirect, stripSearchParams, useRouter } from '@tanstack/react-router'
import { z } from 'zod'
import { authClient } from '~/lib/auth-client'
import { signInSchema, signUpSchema } from '~/lib/schemas'

const signInSearchSchema = z.object({
  mode: z.enum(['login', 'register']).default('login').catch('login'),
  // Only same-origin relative paths are accepted as a post-login destination.
  redirect: z
    .string()
    .regex(/^\/(?!\/)/)
    .optional()
    .catch(undefined),
})

// SSR: full. Already signed-in visitors are redirected on the server.
export const Route = createFileRoute('/sign-in')({
  validateSearch: signInSearchSchema,
  search: { middlewares: [stripSearchParams({ mode: 'login' })] },
  beforeLoad: ({ context, search }) => {
    if (context.viewer) throw redirect({ href: search.redirect ?? '/' })
  },
  head: () => ({ meta: [{ title: 'Entrar · Lanterninha' }] }),
  component: SignInPage,
})

/** Maps Better Auth error codes to pt-BR copy; falls back to its message. */
const AUTH_ERRORS: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'E-mail ou senha incorretos.',
  INVALID_USERNAME_OR_PASSWORD: 'Usuário ou senha incorretos.',
  USER_ALREADY_EXISTS: 'Já existe uma conta com esse e-mail.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'Já existe uma conta com esse e-mail.',
  USERNAME_IS_ALREADY_TAKEN: 'Esse nome de usuário já está em uso.',
  USERNAME_IS_ALREADY_TAKEN_PLEASE_TRY_ANOTHER: 'Esse nome de usuário já está em uso.',
  PASSWORD_TOO_SHORT: 'A senha precisa de pelo menos 8 caracteres.',
}

function SignInPage() {
  const { mode, redirect: redirectTo } = Route.useSearch()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const isRegister = mode === 'register'

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = Object.fromEntries(new FormData(e.currentTarget))
    setError(null)

    let result: { error: { code?: string; message?: string } | null }
    if (isRegister) {
      const parsed = signUpSchema.safeParse(form)
      if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      setPending(true)
      const { username, email, password } = parsed.data
      result = await authClient.signUp.email({ name: username, username, email, password })
    } else {
      const parsed = signInSchema.safeParse(form)
      if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      setPending(true)
      const { login, password } = parsed.data
      result = login.includes('@')
        ? await authClient.signIn.email({ email: login, password })
        : await authClient.signIn.username({ username: login, password })
    }
    setPending(false)

    if (result.error) {
      return setError(
        (result.error.code && AUTH_ERRORS[result.error.code]) ||
          result.error.message ||
          'Não foi possível entrar.',
      )
    }
    // The session cookie is set; re-run beforeLoad/loaders so the viewer updates everywhere.
    await router.invalidate()
    await router.navigate({ href: redirectTo ?? '/' })
  }

  return (
    <section className="auth panel">
      <nav className="tabs auth-tabs" aria-label="Entrar ou criar conta">
        <Link
          from={Route.fullPath}
          search={(prev) => ({ ...prev, mode: 'login' as const })}
          replace
          className={!isRegister ? 'active' : undefined}
        >
          Entrar
        </Link>
        <Link
          from={Route.fullPath}
          search={(prev) => ({ ...prev, mode: 'register' as const })}
          replace
          className={isRegister ? 'active' : undefined}
        >
          Criar conta
        </Link>
      </nav>

      <h1>{isRegister ? 'Pegue sua lanterna' : 'Que bom te ver de novo'}</h1>
      <p className="muted">
        {isRegister
          ? 'Seu @usuário assina suas avaliações e aparece no seu diário de sessões.'
          : 'Entre com seu @usuário ou e-mail.'}
      </p>

      {/* `key` resets the fields when switching between modes. */}
      <form key={mode} onSubmit={submit} noValidate>
        {isRegister ? (
          <>
            <label className="field">
              <span>Usuário</span>
              <input name="username" placeholder="pipoqueira" autoComplete="username" autoFocus required />
            </label>
            <label className="field">
              <span>E-mail</span>
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label className="field">
              <span>Senha</span>
              <input name="password" type="password" autoComplete="new-password" minLength={8} required />
            </label>
          </>
        ) : (
          <>
            <label className="field">
              <span>Usuário ou e-mail</span>
              <input name="login" autoComplete="username" autoFocus required />
            </label>
            <label className="field">
              <span>Senha</span>
              <input name="password" type="password" autoComplete="current-password" required />
            </label>
          </>
        )}
        {error && (
          <p className="form-errors" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="button" disabled={pending}>
          {pending ? 'Um instante…' : isRegister ? 'Criar conta' : 'Entrar'}
        </button>
      </form>
    </section>
  )
}
