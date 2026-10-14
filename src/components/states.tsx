import { Link, useRouter, type ErrorComponentProps } from '@tanstack/react-router'

export function DefaultNotFound() {
  return (
    <section className="empty-state">
      <p className="eyebrow">404</p>
      <h1>Essa sala está com as luzes apagadas</h1>
      <p className="muted">Não encontramos o que você procurava.</p>
      <Link to="/rooms" className="button">
        Explorar salas
      </Link>
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
      <button
        type="button"
        className="button"
        onClick={() => {
          reset()
          void router.invalidate()
        }}
      >
        Tentar de novo
      </button>
    </section>
  )
}
