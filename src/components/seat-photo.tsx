import { useState } from 'react'
import { Link, useLocation, useRouteContext, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Flag } from 'lucide-react'
import { toast } from 'sonner'
import { reportPhoto } from '~/functions/photos.functions'
import { photoUrl, rowOrder, SEAT_POSITIONS, type Review } from '~/lib/domain'

/** "Fileira H · centro" */
export function seatLabel(review: Pick<Review, 'row' | 'seatPosition'>) {
  if (!review.row) return null
  return review.seatPosition
    ? `Fileira ${review.row} · ${SEAT_POSITIONS[review.seatPosition]}`
    : `Fileira ${review.row}`
}

/** One "vista da poltrona", opening full size in a new tab, with a report link for other readers. */
export function SeatPhotoFigure({ review, caption }: { review: Review; caption?: React.ReactNode }) {
  if (!review.photo) return null
  const { id, width, height } = review.photo
  const seat = seatLabel(review)
  return (
    <figure className="seat-photo">
      <a href={photoUrl(id)} target="_blank" rel="noreferrer">
        <img
          src={photoUrl(id)}
          width={width}
          height={height}
          loading="lazy"
          decoding="async"
          alt={seat ? `Vista da tela da ${seat.toLowerCase()}` : 'Vista da tela'}
        />
      </a>
      <figcaption>
        <span>{caption ?? seat}</span>
        <ReportPhotoButton photoId={id} author={review.username} />
      </figcaption>
    </figure>
  )
}

/** Reporting hides the photo at once (see store.reportPhoto); authors and visitors don't get the button. */
function ReportPhotoButton({ photoId, author }: { photoId: string; author: string }) {
  const { viewer } = useRouteContext({ from: '__root__' })
  const location = useLocation()
  const router = useRouter()
  const report = useServerFn(reportPhoto)
  const [pending, setPending] = useState(false)
  if (viewer?.username === author) return null
  if (!viewer) {
    return (
      <Link to="/sign-in" search={{ redirect: location.href }} className="seat-photo-report" title="Denunciar foto">
        <Flag size={12} aria-hidden="true" /> Denunciar
      </Link>
    )
  }
  return (
    <button
      type="button"
      className="seat-photo-report"
      disabled={pending}
      title="Denunciar foto"
      onClick={async () => {
        // A native confirm() would block; a report is cheap to undo for a moderator anyway.
        setPending(true)
        try {
          await report({ data: { photoId } })
          toast('Obrigado. A foto foi escondida até alguém da equipe olhar.')
          await router.invalidate()
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Não foi possível denunciar agora.')
        } finally {
          setPending(false)
        }
      }}
    >
      <Flag size={12} aria-hidden="true" /> Denunciar
    </button>
  )
}

/** The room's "Vista da poltrona" strip: every review photo, front rows first. */
export function SeatViewGallery({ reviews }: { reviews: Review[] }) {
  const withPhotos = reviews
    .filter((r) => r.photo)
    .sort((a, b) => rowOrder(a.row) - rowOrder(b.row) || a.createdAt.localeCompare(b.createdAt))
  if (withPhotos.length === 0) return null
  return (
    <section className="section">
      <div className="section-head">
        <h2>Vista da poltrona</h2>
        <span className="muted">Da frente para o fundo da sala</span>
      </div>
      <div className="seat-gallery">
        {withPhotos.map((r) => (
          <SeatPhotoFigure
            key={r.id}
            review={r}
            caption={
              <>
                <strong>{seatLabel(r)}</strong> · @{r.username}
              </>
            }
          />
        ))}
      </div>
    </section>
  )
}
