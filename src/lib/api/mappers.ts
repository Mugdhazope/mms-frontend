import type { SpotRowDto, SpotTimingAggregateDto } from '@/lib/api/mapmysutta'
import type { Spot, SpotTag, SpotTip, TimingBehaviorLabel } from '@/types/spot'

const TAG_API_TO_UI: Record<string, SpotTag> = {
  cash_only: 'cashOnly',
  show_paan: 'paanShop',
  cigarettes_only: 'cigarettesOnly',
  sometimes_closed: 'sometimesClosed',
  open_late: 'openLate',
}

const TAG_UI_TO_API: Record<SpotTag, string> = {
  cashOnly: 'cash_only',
  paanShop: 'show_paan',
  cigarettesOnly: 'cigarettes_only',
  sometimesClosed: 'sometimes_closed',
  openLate: 'open_late',
}

export function uiTagsToApi(tags: SpotTag[]): string[] {
  return tags.map((t) => TAG_UI_TO_API[t])
}

/** Map backend activity_score (unbounded) to ~0–1 for heatmap / filterSpots. */
export function normalizeActivityScore(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0.12
  return Math.min(1, raw / 6)
}

function minutesSince(iso: string | null): number {
  if (!iso) return 9999
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return 9999
  return Math.max(0, Math.round((Date.now() - t) / 60_000))
}

function parseTimingLabel(value: string | null | undefined): TimingBehaviorLabel | undefined {
  if (value === 'RUNS_LATE' || value === 'NORMAL' || value === 'UNPREDICTABLE') {
    return value
  }
  return undefined
}

export function timingAggregateToSpotPatch(
  agg: SpotTimingAggregateDto,
): Pick<
  Spot,
  'usualOpenUntil' | 'timingConfidence' | 'timingLabel' | 'isLikelyOpenNow'
> {
  return {
    usualOpenUntil: agg.usual_open_until ?? undefined,
    timingConfidence: agg.timing_confidence,
    timingLabel: parseTimingLabel(agg.timing_label),
    isLikelyOpenNow: agg.is_likely_open_now,
  }
}

function mapNotesFromApi(rows: SpotRowDto['notes']): SpotTip[] {
  const out: SpotTip[] = []
  for (const n of rows ?? []) {
    const text = typeof n.text === 'string' ? n.text.trim() : ''
    if (!text) continue
    const createdAt = Date.parse(n.created_at)
    out.push({
      text,
      createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
    })
  }
  return out
}

export function apiRowToSpot(row: SpotRowDto, deviceId: string): Spot {
  const tags: SpotTag[] = []
  for (const t of row.tags) {
    const mapped = TAG_API_TO_UI[t]
    if (mapped) tags.push(mapped)
  }

  const activityScore = normalizeActivityScore(row.activity_score)
  const lastActiveMinutesAgo = minutesSince(row.last_confirmed_at)

  const spot: Spot = {
    id: row.id,
    name: row.name ?? undefined,
    lat: row.latitude,
    lng: row.longitude,
    openVotes: row.open_votes,
    notSureVotes: row.not_sure_votes,
    lastActiveMinutesAgo,
    tags,
    notes: mapNotesFromApi(row.notes),
    activityScore,
    creatorDeviceId: row.is_own_spot ? deviceId : undefined,
    createdAt: row.last_confirmed_at
      ? Date.parse(row.last_confirmed_at)
      : Date.now(),
    lastConfirmedAt: row.last_confirmed_at
      ? Date.parse(row.last_confirmed_at)
      : undefined,
    recentConfirmations: undefined,
    weightedOpenScore: row.weighted_score,
    validationRewarded: false,
  }

  if (row.usual_open_until != null && row.usual_open_until !== '') {
    spot.usualOpenUntil = row.usual_open_until
  }
  if (row.timing_confidence != null && Number.isFinite(row.timing_confidence)) {
    spot.timingConfidence = row.timing_confidence
  }
  const tl = parseTimingLabel(row.timing_label)
  if (tl) spot.timingLabel = tl
  if (row.is_likely_open_now != null) {
    spot.isLikelyOpenNow = row.is_likely_open_now
  }
  if (row.is_likely_open != null) {
    spot.isLikelyOpen = row.is_likely_open
  }

  return spot
}

export function mapAreaSignal(
  signal: 'HOT' | 'ACTIVE' | 'DEAD',
): 'Hot area' | 'Recently active' | 'Dead zone' {
  if (signal === 'HOT') return 'Hot area'
  if (signal === 'ACTIVE') return 'Recently active'
  return 'Dead zone'
}
