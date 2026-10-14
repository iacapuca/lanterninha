import { Link, useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import { Button } from '~/components/ui/button'

export function DefaultNotFound() {
  return (
    <section className="empty-state">
      <p className="eyebrow">404</p>
      <h1>Essa sala está com as luzes apagadas</h1>
      <p className="muted">Não encontramos o que você procurava.</p>
      <Button asChild className="mt-3">
        <Link to="/rooms">Explorar salas</Link>
      </Button>
    </section>
  )
}

export function DefaultError({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  return (
    <section className="empty-state">
      <p className="eyebrow">Falha na projeção</p>
      <h1>Algo deu errado</h1>
      <p className="muted">{error instanceof Error ? error.message : 'Erro desconhecido'}</p>
      <Button
        type="button"
        className="mt-3"
        onClick={() => {
          reset()
          void router.invalidate()
        }}
      >
        Tentar de novo
      </Button>
    </section>
  )
}
