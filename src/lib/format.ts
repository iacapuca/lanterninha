// pt-BR formatting helpers. Pure and deterministic so SSR and hydration agree:
// dates are formatted in America/Sao_Paulo rather than the viewer's zone.

const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'America/Sao_Paulo',
})

export function formatDate(iso: string) {
  return dateFormat.format(new Date(iso)).replace(/\./g, '')
}

export function formatRating(rating: number | null) {
  if (rating == null) return '—'
  return rating.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

export function pluralize(n: number, one: string, many: string) {
  return `${n.toLocaleString('pt-BR')} ${n === 1 ? one : many}`
}
