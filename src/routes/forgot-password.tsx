import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { authClient } from '~/lib/auth-client'
import { Button } from '~/components/ui/button'

export const Route = createFileRoute('/forgot-password')({
  head: () => ({ meta: [{ title: 'Esqueci minha senha · Lanterninha' }] }),
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const email = z.email().safeParse(
      String(new FormData(e.currentTarget).get('email') ?? '')
        .trim()
        .toLowerCase(),
    )
    if (!email.success) return setError('Informe um e-mail válido.')
    setError(null)
    setPending(true)
    // Same answer whether or not the account exists, so emails can't be probed.
    await authClient.requestPasswordReset({ email: email.data, redirectTo: '/reset-password' })
    setPending(false)
    setSent(true)
  }

  return (
    <section className="auth panel">
      <h1>Esqueci minha senha</h1>
      {sent ? (
        <>
          <p className="muted">
            Se existir uma conta com esse e-mail, enviamos um link para criar uma senha nova. Ele vale por 1 hora —
            confira também a caixa de spam.
          </p>
          <p>
            <Link to="/sign-in">Voltar para entrar</Link>
          </p>
        </>
      ) : (
        <>
          <p className="muted">Informe o e-mail da sua conta e enviamos um link para criar uma senha nova.</p>
          <form onSubmit={submit} noValidate>
            <label className="field">
              <span>E-mail</span>
              <input name="email" type="email" autoComplete="email" autoFocus required />
            </label>
            {error && (
              <p className="form-errors" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={pending}>
              {pending ? 'Enviando…' : 'Enviar link'}
            </Button>
          </form>
        </>
      )}
    </section>
  )
}
