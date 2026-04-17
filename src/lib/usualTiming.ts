import type { Spot } from '@/types/spot'

/** Match backend: evening through early morning (18:00–06:00 inclusive). */
export function isReasonableUsualTimeHHMM(hhmm: string): boolean {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return false
  const h = Number(m[1])
  const min = Number(m[2])
  if (!Number.isFinite(h) || !Number.isFinite(min)) return false
  if (h < 0 || h > 23 || min < 0 || min > 59) return false
  const minutes = h * 60 + min
  return minutes >= 18 * 60 || minutes <= 6 * 60
}

export function normalizeTimeInputValue(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return hhmm.trim()
  const h = String(Number(m[1])).padStart(2, '0')
  const min = String(Number(m[2])).padStart(2, '0')
  return `${h}:${min}`
}

export function timingLabelDisplay(
  label: Spot['timingLabel'] | undefined,
): string | null {
  if (!label) return null
  switch (label) {
    case 'RUNS_LATE':
      return 'Runs late'
    case 'UNPREDICTABLE':
      return 'Mixed timings'
    case 'NORMAL':
      return 'Typical hours'
    default:
      return null
  }
}
