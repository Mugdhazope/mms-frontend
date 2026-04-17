import { createContext } from 'react'

import type { Spot, SpotFilters, SpotTag } from '@/types/spot'

export type FeedbackToast = {
  id: string
  message: string
}

/** Pass no geo fields to load all spots; or lat+lng+radiusM for a regional query. */
export type RefreshSpotsArgs = {
  lat?: number
  lng?: number
  radiusM?: number
}

export interface AppStateValue {
  spots: Spot[]
  filters: SpotFilters
  deviceId: string
  username: string | null
  areaSignal: 'Hot area' | 'Dead zone' | 'Recently active'
  feedbackToast: FeedbackToast | null
  spotsLoading: boolean
  spotsError: string | null
  setFilters: (f: SpotFilters) => void
  /** Short-lived toast (e.g. filter apply). */
  postFeedback: (message: string) => void
  filteredSpots: Spot[]
  /** Load spots (worldwide if args empty); filters apply client-side only. */
  refreshSpots: (args?: RefreshSpotsArgs) => Promise<void>
  addSpot: (input: {
    name?: string
    tags: SpotTag[]
    lat: number
    lng: number
  }) => void
  bumpOpenVotes: (id: string, delta: 1 | -1) => void
  bumpNotSure: (id: string) => void
  addNote: (id: string, text: string) => void
  /** Crowd tag; server whitelists values (see `uiTagsToApi`). */
  addSpotTag: (id: string, tag: SpotTag) => void
  /** Usual closing time (HH:MM), evening–early morning only (server-validated). */
  submitUsualTiming: (id: string, usualOpenUntil: string) => void
  distanceTo: (spot: Spot, userLat: number, userLng: number) => number
  isOwnSpot: (spot: Spot) => boolean
}

export const AppStateContext = createContext<AppStateValue | null>(null)
