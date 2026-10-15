import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { authClient } from '~/lib/auth-client'
import { Button } from '~/components/ui/button'

// Better Auth checks the emailed link and redirects here with ?token=… (or ?error=INVALID_TOKEN).
export const Route = createFileRoute('/reset-password')({
  validateSearch: z.object({
    token: z.string().optional().catch(undefined),
    error: z.string().optional().catch(undefined),
  }),
  head: () => ({ meta: [{ title: 'Nova senha · Lanterninha' }, { name: 'robots', content: 'noindex' }] }),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const { token, error: linkError } = Route.useSearch()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (!token || linkError) {
    return (
      <section className="auth panel">
        <h1>Esse link não vale mais</h1>
        <p className="muted">Links de redefinição valem por 1 hora e só podem ser usados uma vez.</p>
        <Button asChild>
          <Link to="/forgot-password">Pedir um link novo</Link>
        </Button>
      </section>
    )
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const password = String(form.get('password') ?? '')
    if (password.length < 8) return setError('A senha precisa de pelo menos 8 caracteres.')
    if (password !== form.get('confirm')) return setError('As senhas não conferem.')
    setError(null)
    setPending(true)
    const result = await authClient.resetPassword({ newPassword: password, token })
    setPending(false)
    if (result.error) return setError('Esse link expirou. Peça um novo.')
    await navigate({ to: '/sign-in', search: { mode: 'login', reset: true } })
  }

  return (
    <section className="auth panel">
      <h1>Crie uma senha nova</h1>
      <p className="muted">Por segurança, você vai sair de todos os aparelhos e entrar de novo com a senha nova.</p>
      <form onSubmit={submit} noValidate>
        <label className="field">
          <span>Nova senha</span>
          <input name="password" type="password" autoComplete="new-password" minLength={8} autoFocus required />
        </label>
        <label className="field">
          <span>Repita a senha</span>
          <input name="confirm" type="password" autoComplete="new-password" minLength={8} required />
        </label>
        {error && (
          <p className="form-errors" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? 'Salvando…' : 'Salvar senha'}
        </Button>
      </form>
    </section>
  )
}
