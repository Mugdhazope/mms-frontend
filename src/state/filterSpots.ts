import { minutesSinceOpenConfirmation } from '@/lib/spotRecency'
import type { Spot, SpotFilters } from '@/types/spot'

/** Default map filters: open-now only (immersive first paint). */
export const defaultSpotFilters: SpotFilters = {
  openRightNow: true,
  justConfirmed: false,
  openLateFilter: false,
  usuallyWorks: false,
}

/** True when the only active constraint is “open right now” (baseline UX). */
export function isOpenNowOnlyView(filters: SpotFilters): boolean {
  return (
    filters.openRightNow &&
    !filters.justConfirmed &&
    !filters.openLateFilter &&
    !filters.usuallyWorks
  )
}

export function spotFiltersEqual(a: SpotFilters, b: SpotFilters): boolean {
  return (
    a.openRightNow === b.openRightNow &&
    a.justConfirmed === b.justConfirmed &&
    a.openLateFilter === b.openLateFilter &&
    a.usuallyWorks === b.usuallyWorks
  )
}

const JUST_CONFIRMED_MINS = 30
const USUALLY_WORKS_CONFIDENCE = 0.45
const USUALLY_WORKS_ACTIVITY = 0.55

/** Max expected search radius (m) for normalizing distance in sort score. */
const SORT_RADIUS_M = 6500

/** Weights: distance, timing confidence, recency (sum = 1). */
const W_DISTANCE = 0.4
const W_CONFIDENCE = 0.35
const W_RECENCY = 0.25

function anyFilterActive(filters: SpotFilters): boolean {
  return (
    filters.openRightNow ||
    filters.justConfirmed ||
    filters.openLateFilter ||
    filters.usuallyWorks
  )
}

/** “Open now” = server signals the spot might be open (not merely recent activity). */
function matchesOpenRightNow(s: Spot): boolean {
  return s.isLikelyOpenNow === true || s.isLikelyOpen === true
}

function matchesJustConfirmed(s: Spot): boolean {
  return minutesSinceOpenConfirmation(s) <= JUST_CONFIRMED_MINS
}

/**
 * “Open late” = usual closing time is 2:00–6:59 (early morning close).
 * Missing or invalid usualOpenUntil fails.
 */
function matchesOpenLateFilter(s: Spot): boolean {
  const raw = s.usualOpenUntil?.trim()
  if (!raw) return false
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw)
  if (!m) return false
  const h = Number(m[1])
  const min = Number(m[2])
  if (!Number.isFinite(h) || !Number.isFinite(min)) return false
  if (h < 0 || h > 23 || min < 0 || min > 59) return false
  return h >= 2 && h <= 6
}

function matchesUsuallyWorks(s: Spot): boolean {
  const conf = s.timingConfidence ?? 0
  return conf >= USUALLY_WORKS_CONFIDENCE || s.activityScore >= USUALLY_WORKS_ACTIVITY
}

function spotPassesActiveFilters(s: Spot, filters: SpotFilters): boolean {
  if (filters.openRightNow && !matchesOpenRightNow(s)) return false
  if (filters.justConfirmed && !matchesJustConfirmed(s)) return false
  if (filters.openLateFilter && !matchesOpenLateFilter(s)) return false
  if (filters.usuallyWorks && !matchesUsuallyWorks(s)) return false
  return true
}

export function filterSpots(spots: Spot[], filters: SpotFilters): Spot[] {
  if (!anyFilterActive(filters)) return spots
  return spots.filter((s) => spotPassesActiveFilters(s, filters))
}

/**
 * Higher = sort earlier. Combines proximity, crowd timing confidence, and confirm recency.
 */
export function decisionSortScore(spot: Spot, distanceMeters: number): number {
  const distNorm = Math.max(0, 1 - Math.min(1, distanceMeters / SORT_RADIUS_M))
  const conf = Math.max(0, Math.min(1, spot.timingConfidence ?? 0))
  const recency = Math.max(
    0,
    Math.min(1, 1 - minutesSinceOpenConfirmation(spot) / 120),
  )
  return W_DISTANCE * distNorm + W_CONFIDENCE * conf + W_RECENCY * recency
}
