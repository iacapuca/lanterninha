import { useState } from 'react'
import { Link, createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { getAccount } from '~/functions/account.functions'
import { authClient } from '~/lib/auth-client'
import { formatDate } from '~/lib/format'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'

// Better Auth's verification link lands here with ?verified=1.
export const Route = createFileRoute('/account')({
  validateSearch: z.object({ verified: z.coerce.boolean().optional().catch(undefined) }),
  beforeLoad: ({ context, location }) => {
    if (!context.viewer) throw redirect({ to: '/sign-in', search: { redirect: location.href } })
  },
  loader: async () => {
    const account = await getAccount()
    if (!account) throw redirect({ to: '/sign-in' })
    return account
  },
  head: () => ({ meta: [{ title: 'Conta · Lanterninha' }, { name: 'robots', content: 'noindex' }] }),
  component: AccountPage,
})

function AccountPage() {
  const account = Route.useLoaderData()
  const { verified } = Route.useSearch()

  return (
    <div className="account">
      <header className="page-head">
        <p className="eyebrow">Conta</p>
        <h1>@{account.username}</h1>
        <p className="muted">
          Membro desde {formatDate(account.createdAt)} ·{' '}
          <Link to="/users/$username" params={{ username: account.username }}>
            Ver meu diário
          </Link>
        </p>
      </header>

      {verified && account.emailVerified && <p className="notice">E-mail confirmado. Obrigado!</p>}

      <section className="panel account-section">
        <h2>E-mail</h2>
        <p>
          {account.email}{' '}
          {account.emailVerified ? (
            <span className="badge badge-verified">Confirmado</span>
          ) : (
            <span className="badge">Não confirmado</span>
          )}
        </p>
        {!account.emailVerified && <ResendVerification email={account.email} />}
      </section>

      <section className="panel account-section">
        <h2>Senha</h2>
        <ChangePassword />
      </section>

      <section className="panel account-section account-danger">
        <h2>Excluir conta</h2>
        <p className="muted">Apaga sua conta, suas avaliações e suas respostas sobre as salas. Não dá para desfazer.</p>
        <DeleteAccount />
      </section>

      <p className="muted account-legal">
        <Link to="/privacy">Política de privacidade</Link> · <Link to="/terms">Termos de uso</Link>
      </p>
    </div>
  )
}

function ResendVerification({ email }: { email: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  return (
    <>
      <p className="muted">Confirme seu e-mail para conseguir recuperar a conta se esquecer a senha.</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={state !== 'idle'}
        onClick={async () => {
          setState('sending')
          const { error } = await authClient.sendVerificationEmail({ email, callbackURL: '/account?verified=1' })
          if (error) {
            setState('idle')
            return toast.error('Não foi possível enviar agora. Tente de novo em alguns minutos.')
          }
          setState('sent')
          toast.success('Link de confirmação enviado.')
        }}
      >
        {state === 'sent' ? 'Enviado — confira seu e-mail' : state === 'sending' ? 'Enviando…' : 'Reenviar confirmação'}
      </Button>
    </>
  )
}

function ChangePassword() {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formEl = e.currentTarget
    const form = new FormData(formEl)
    const currentPassword = String(form.get('current') ?? '')
    const newPassword = String(form.get('password') ?? '')
    if (newPassword.length < 8) return setError('A nova senha precisa de pelo menos 8 caracteres.')
    if (newPassword !== form.get('confirm')) return setError('As senhas não conferem.')
    setError(null)
    setPending(true)
    const result = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true })
    setPending(false)
    if (result.error) return setError('A senha atual não confere.')
    formEl.reset()
    toast.success('Senha alterada. Outros aparelhos foram desconectados.')
  }

  return (
    <form onSubmit={submit} noValidate className="account-form">
      <label className="field">
        <span>Senha atual</span>
        <input name="current" type="password" autoComplete="current-password" required />
      </label>
      <label className="field">
        <span>Nova senha</span>
        <input name="password" type="password" autoComplete="new-password" minLength={8} required />
      </label>
      <label className="field">
        <span>Repita a nova senha</span>
        <input name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </label>
      {error && (
        <p className="form-errors" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? 'Salvando…' : 'Alterar senha'}
      </Button>
    </form>
  )
}

function DeleteAccount() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const password = String(new FormData(e.currentTarget).get('password') ?? '')
    if (!password) return setError('Informe sua senha para confirmar.')
    setError(null)
    setPending(true)
    const result = await authClient.deleteUser({ password })
    setPending(false)
    if (result.error) return setError('Senha incorreta.')
    await router.invalidate()
    toast('Sua conta foi excluída. Até a próxima sessão!')
    await router.navigate({ to: '/' })
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="destructive">
          Excluir minha conta
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir sua conta?</DialogTitle>
          <DialogDescription>
            Suas avaliações, respostas e badges serão apagadas para sempre. Digite sua senha para confirmar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="account-form">
          <label className="field">
            <span>Senha</span>
            <input name="password" type="password" autoComplete="current-password" autoFocus required />
          </label>
          {error && (
            <p className="form-errors" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? 'Excluindo…' : 'Excluir para sempre'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
