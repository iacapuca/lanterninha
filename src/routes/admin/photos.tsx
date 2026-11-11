import { useState } from 'react'
import { Link, createFileRoute, notFound, redirect, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { toast } from 'sonner'
import { getIsAdmin, getReportedPhotos, moderatePhoto } from '~/functions/photos.functions'
import { photoUrl } from '~/lib/domain'
import { formatDate, pluralize } from '~/lib/format'
import { Button } from '~/components/ui/button'

// SSR: full. Moderators only: anyone else gets the 404 page, so the route doesn't
// advertise itself. The server functions check `is_admin` again.
export const Route = createFileRoute('/admin/photos')({
  beforeLoad: async ({ context, location }) => {
    if (!context.viewer) throw redirect({ to: '/sign-in', search: { redirect: location.href } })
    if (!(await getIsAdmin())) throw notFound()
  },
  loader: () => getReportedPhotos(),
  head: () => ({ meta: [{ title: 'Fotos denunciadas · Lanterninha' }, { name: 'robots', content: 'noindex' }] }),
  component: ReportedPhotosPage,
})

function ReportedPhotosPage() {
  const photos = Route.useLoaderData()
  return (
    <>
      <header className="page-head">
        <p className="eyebrow">Moderação</p>
        <h1>Fotos denunciadas</h1>
        <p className="muted">
          {photos.length === 0
            ? 'Nenhuma foto esperando. Tudo limpo.'
            : `${pluralize(photos.length, 'foto escondida', 'fotos escondidas')} até você decidir.`}
        </p>
      </header>
      <div className="moderation-list">
        {photos.map((p) => (
          <ReportedPhoto key={p.id} photo={p} />
        ))}
      </div>
    </>
  )
}

function ReportedPhoto({ photo }: { photo: Awaited<ReturnType<typeof getReportedPhotos>>[number] }) {
  const router = useRouter()
  const moderate = useServerFn(moderatePhoto)
  const [pending, setPending] = useState(false)

  async function act(action: 'restore' | 'delete') {
    setPending(true)
    try {
      await moderate({ data: { photoId: photo.id, action } })
      toast(action === 'restore' ? 'Foto de volta no ar.' : 'Foto apagada.')
      await router.invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível agora.')
    } finally {
      setPending(false)
    }
  }

  return (
    <article className="panel moderation-item">
      <a href={photoUrl(photo.id)} target="_blank" rel="noreferrer">
        <img src={photoUrl(photo.id)} width={photo.width} height={photo.height} alt="Foto denunciada" />
      </a>
      <div className="stack">
        <p>
          <strong>{pluralize(photo.reports, 'denúncia', 'denúncias')}</strong> · enviada em{' '}
          {formatDate(photo.createdAt)} por{' '}
          {photo.username ? (
            <Link to="/users/$username" params={{ username: photo.username }}>
              @{photo.username}
            </Link>
          ) : (
            'conta sem nome'
          )}
        </p>
        <p className="muted">
          <Link to="/rooms/$roomId" params={{ roomId: photo.roomId }}>
            {photo.roomName}
          </Link>{' '}
          · {photo.cinemaName}
          {photo.row && ` · Fileira ${photo.row}`}
        </p>
        <blockquote className="muted">{photo.reviewBody}</blockquote>
        <div className="form-actions">
          <Button type="button" variant="outline" disabled={pending} onClick={() => act('restore')}>
            Restaurar
          </Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={() => act('delete')}>
            Apagar foto
          </Button>
        </div>
      </div>
    </article>
  )
}
