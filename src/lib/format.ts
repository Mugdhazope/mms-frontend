export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`
  }
  return `${(meters / 1000).toFixed(1)}km`
}

/** Local calendar date + time for a crowd tip timestamp. */
export function formatTipDateTime(epochMs: number): string {
  if (!Number.isFinite(epochMs)) return ''
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(epochMs)
}

export function formatLastSeen(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes >= 9000) return 'No open check-in yet'
  if (minutes <= 1) return 'just now'
  if (minutes < 60) return `${minutes} mins ago`
  const h = Math.floor(minutes / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}
