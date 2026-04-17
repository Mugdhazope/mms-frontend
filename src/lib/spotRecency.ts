import type { Spot } from '@/types/spot'

/**
 * Minutes since the last OPEN vote (server `last_confirmed_at`).
 * Uses live `Date.now()` when `lastConfirmedAt` is present so UI stays accurate between refreshes.
 */
export function minutesSinceOpenConfirmation(spot: Spot): number {
  if (spot.lastConfirmedAt !== undefined && Number.isFinite(spot.lastConfirmedAt)) {
    return Math.max(0, Math.round((Date.now() - spot.lastConfirmedAt) / 60_000))
  }
  return spot.lastActiveMinutesAgo
}
