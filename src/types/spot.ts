export type SpotTag =
  | 'cashOnly'
  | 'paanShop'
  | 'cigarettesOnly'
  | 'sometimesClosed'
  | 'openLate'

export type TimingBehaviorLabel = 'RUNS_LATE' | 'NORMAL' | 'UNPREDICTABLE'

/** Crowd tip on a spot (server: SpotNote). */
export interface SpotTip {
  text: string
  /** When the tip was posted (epoch ms, local display via `formatTipDateTime`). */
  createdAt: number
}

export interface Spot {
  id: string
  name?: string
  lat: number
  lng: number
  openVotes: number
  notSureVotes: number
  lastActiveMinutesAgo: number
  tags: SpotTag[]
  notes: SpotTip[]
  /** 0–1, used for heatmap intensity */
  activityScore: number
  creatorDeviceId?: string
  createdAt?: number
  lastConfirmedAt?: number
  recentConfirmations?: number
  weightedOpenScore?: number
  validationRewarded?: boolean
  /** Aggregated usual closing time (HH:MM,24h). */
  usualOpenUntil?: string
  /** 0–1 aggregate confidence from crowd timings. */
  timingConfidence?: number
  timingLabel?: TimingBehaviorLabel
  /** Heuristic: usual hours or recent open confirmation. */
  isLikelyOpenNow?: boolean
  /** Crowd model: open_probability above threshold. */
  isLikelyOpen?: boolean
}

export interface SpotFilters {
  openRightNow: boolean
  justConfirmed: boolean
  /** Chip label: "Open late" — closes2am–6am usual time. */
  openLateFilter: boolean
  usuallyWorks: boolean
}
