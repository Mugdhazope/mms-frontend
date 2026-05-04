import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { SEED_SPOTS } from '@/data/spots'
import { ApiError } from '@/lib/api/client'
import {
  type CaptchaPayload,
  addNote as apiAddNote,
  appendSpotTag as apiAppendSpotTag,
  createSpot as apiCreateSpot,
  getDevice,
  listSpots,
  postEngagement,
  submitSpotTiming as apiSubmitSpotTiming,
  voteNotSure as apiVoteNotSure,
  voteOpen as apiVoteOpen,
} from '@/lib/api/mapmysutta'
import {
  apiRowToSpot,
  mapAreaSignal,
  timingAggregateToSpotPatch,
  uiTagsToApi,
} from '@/lib/api/mappers'
import { executeRecaptchaV3, isRecaptchaConfigured } from '@/lib/recaptcha'
import {
  isValidGeoCoords,
  validateNoteInput,
  validateSpotName,
} from '@/lib/validation/inputLimits'
import { isReasonableUsualTimeHHMM, normalizeTimeInputValue } from '@/lib/usualTiming'
import type { Spot, SpotFilters, SpotTag } from '@/types/spot'
import { ManualCaptchaModal } from '@/components/ManualCaptchaModal'

import { AppStateContext, type RefreshSpotsArgs } from './appStateContext'
import {
  emitEngagementEvent,
  getDeviceId,
  getUsername,
  recordActivity,
  resetDeviceId,
  setRemoteEngagementPoster,
  syncDeviceFromServer,
} from './engagement'
import { minutesSinceOpenConfirmation } from '@/lib/spotRecency'

import { defaultSpotFilters, filterSpots } from './filterSpots'

const USE_DEMO_SEED = import.meta.env.VITE_USE_SEED === 'true'
const CAPTCHA_REQUIRED_STATUS = 403

type ManualChallengeState = {
  open: boolean
  resolver: ((token: string | null) => void) | null
}

function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

function seedToSpots(): Spot[] {
  return SEED_SPOTS.map((s) => ({
    ...s,
    createdAt: s.createdAt ?? Date.now() - s.lastActiveMinutesAgo * 60_000,
    recentConfirmations: s.recentConfirmations ?? 0,
    weightedOpenScore: s.weightedOpenScore ?? s.openVotes,
    lastConfirmedAt:
      s.lastConfirmedAt ?? Date.now() - s.lastActiveMinutesAgo * 60_000,
  }))
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [spots, setSpots] = useState<Spot[]>(() =>
    USE_DEMO_SEED ? seedToSpots() : [],
  )
  const [feedbackToast, setFeedbackToast] = useState<{
    id: string
    message: string
  } | null>(null)
  const [filters, setFilters] = useState<SpotFilters>(() => ({
    ...defaultSpotFilters,
  }))
  const [deviceId, setDeviceId] = useState(() => getDeviceId())
  const username = getUsername()
  const [areaSignal, setAreaSignal] = useState<
    'Hot area' | 'Dead zone' | 'Recently active'
  >('Dead zone')
  const [spotsLoading, setSpotsLoading] = useState(false)
  const [spotsError, setSpotsError] = useState<string | null>(null)

  const areaSignalPrevRef = useRef<'Hot area' | 'Dead zone' | 'Recently active'>(
    'Dead zone',
  )
  const loadGen = useRef(0)
  const lastQueryRef = useRef<RefreshSpotsArgs | null>(null)
  /** Avoid duplicate POST /timing (double-tap, Strict Mode, retries). */
  const timingSubmitFlightRef = useRef<Set<string>>(new Set())
  const [manualChallenge, setManualChallenge] = useState<ManualChallengeState>({
    open: false,
    resolver: null,
  })

  const postFeedback = useCallback((message: string) => {
    setFeedbackToast({ id: `${Date.now()}-${Math.random()}`, message })
  }, [])

  const isManualCaptchaRequired = useCallback((error: unknown): boolean => {
    if (!(error instanceof ApiError)) return false
    if (error.status !== CAPTCHA_REQUIRED_STATUS) return false
    const body = error.body
    return (
      typeof body === 'object' &&
      body !== null &&
      'captcha_required' in body &&
      (body as { captcha_required?: string }).captcha_required === 'manual'
    )
  }, [])

  const requestManualCaptchaToken = useCallback((): Promise<string | null> => {
    return new Promise((resolve) => {
      setManualChallenge({ open: true, resolver: resolve })
    })
  }, [])

  const withCaptcha = useCallback(
    async <T,>(
      action: string,
      fn: (captcha: CaptchaPayload) => Promise<T>,
    ): Promise<T> => {
      const captcha: CaptchaPayload = {}
      if (isRecaptchaConfigured()) {
        captcha.recaptchaToken = await executeRecaptchaV3(action)
      }
      try {
        return await fn(captcha)
      } catch (e) {
        if (!isManualCaptchaRequired(e)) throw e
        const manualToken = await requestManualCaptchaToken()
        if (!manualToken) throw e
        return fn({
          recaptchaToken: captcha.recaptchaToken,
          recaptchaManualToken: manualToken,
        })
      }
    },
    [isManualCaptchaRequired, requestManualCaptchaToken],
  )

  useEffect(() => {
    if (!feedbackToast) return
    const t = window.setTimeout(() => setFeedbackToast(null), 2400)
    return () => window.clearTimeout(t)
  }, [feedbackToast])

  useEffect(() => {
    if (USE_DEMO_SEED) return
    if (!username) return
    let ignore = false
    ;(async () => {
      try {
        let profile = await getDevice(deviceId)
        if (profile.device_id !== deviceId) {
          const normalized = profile.device_id?.trim() || resetDeviceId()
          if (!ignore) setDeviceId(normalized)
        }
        if (!ignore) {
          syncDeviceFromServer(profile.karma, profile.username, profile.access_token)
        }
      } catch (e) {
        if (e instanceof ApiError && e.status === 400) {
          try {
            const nextId = resetDeviceId()
            if (!ignore) {
              setDeviceId(nextId)
            }
            return
          } catch {
            /* fall through to user-facing message */
          }
        }
        if (!ignore) postFeedback('Could not sync identity with server.')
      }
    })()
    return () => {
      ignore = true
    }
  }, [deviceId, postFeedback, username])

  useEffect(() => {
    if (USE_DEMO_SEED) return
    setRemoteEngagementPoster((type, metadata) => {
      void withCaptcha('engagement_event', (captcha) =>
        postEngagement(deviceId, type, metadata, captcha),
      ).catch(() => {})
    })
    return () => setRemoteEngagementPoster(null)
  }, [deviceId, withCaptcha])

  const refreshSpots = useCallback(
    async (args: RefreshSpotsArgs = {}) => {
      if (USE_DEMO_SEED) return
      lastQueryRef.current = args
      const gen = ++loadGen.current
      setSpotsLoading(true)
      setSpotsError(null)
      try {
        const data = await listSpots({
          deviceId,
          ...args,
        })
        if (gen !== loadGen.current) return
        setSpots(data.results.map((r) => apiRowToSpot(r, deviceId)))
        setAreaSignal(mapAreaSignal(data.area_signal))
      } catch (e) {
        if (gen !== loadGen.current) return
        const msg =
          e instanceof ApiError ? e.message : 'Could not load spots.'
        setSpotsError(msg)
      } finally {
        if (gen === loadGen.current) setSpotsLoading(false)
      }
    },
    [deviceId],
  )

  const refetchSpots = useCallback(async () => {
    const q = lastQueryRef.current
    await refreshSpots(q ?? {})
  }, [refreshSpots])

  const syncKarma = useCallback(async () => {
    if (USE_DEMO_SEED) return
    try {
      const profile = await getDevice(deviceId)
      syncDeviceFromServer(profile.karma, profile.username, profile.access_token)
    } catch {
      /* ignore */
    }
  }, [deviceId])

  const filteredSpots = useMemo(
    () => filterSpots(spots, filters),
    [spots, filters],
  )

  const areaSignalDemo = useMemo<'Hot area' | 'Dead zone' | 'Recently active'>(() => {
    const recentSignals = spots.filter((s) => {
      const confirmedRecently = minutesSinceOpenConfirmation(s) <= 60
      return confirmedRecently || (s.recentConfirmations ?? 0) >= 2
    }).length
    const activeSpots = spots.filter((s) => s.activityScore >= 0.55).length
    if (recentSignals >= 5 || activeSpots >= 5) return 'Hot area'
    if (recentSignals >= 2 || activeSpots >= 3) return 'Recently active'
    return 'Dead zone'
  }, [spots])

  const effectiveAreaSignal = USE_DEMO_SEED ? areaSignalDemo : areaSignal

  useEffect(() => {
    const prev = areaSignalPrevRef.current
    if (effectiveAreaSignal === 'Hot area' && prev !== 'Hot area') {
      emitEngagementEvent({
        type: 'area_activity_spike',
      })
    }
    areaSignalPrevRef.current = effectiveAreaSignal
  }, [effectiveAreaSignal])

  const addSpot = useCallback(
    (input: {
      name?: string
      tags: SpotTag[]
      lat: number
      lng: number
    }) => {
      const nameErr = validateSpotName(input.name)
      if (nameErr) {
        postFeedback(nameErr)
        return
      }
      if (!isValidGeoCoords(input.lat, input.lng)) {
        postFeedback('Invalid map coordinates.')
        return
      }
      if (USE_DEMO_SEED) {
        const id = `u-${Date.now()}`
        const newSpot: Spot = {
          id,
          name: input.name?.trim() || undefined,
          lat: input.lat,
          lng: input.lng,
          openVotes: 1,
          notSureVotes: 0,
          lastActiveMinutesAgo: 0,
          tags: input.tags,
          notes: [],
          activityScore: 0.35,
          creatorDeviceId: deviceId,
          createdAt: Date.now(),
          lastConfirmedAt: Date.now(),
          recentConfirmations: 1,
          weightedOpenScore: 1,
        }
        setSpots((prev) => [...prev, newSpot])
        recordActivity()
        emitEngagementEvent({
          type: 'spot_added_nearby',
          spotId: id,
          lat: input.lat,
          lng: input.lng,
        })
        postFeedback('Nice. This helps.')
        return
      }

      ;(async () => {
        try {
          const body: {
            name?: string
            latitude: number
            longitude: number
            tags: string[]
          } = {
            latitude: input.lat,
            longitude: input.lng,
            tags: uiTagsToApi(input.tags),
          }
          const trimmed = input.name?.trim()
          if (trimmed) body.name = trimmed
          const row = await withCaptcha('spot_create', (captcha) =>
            apiCreateSpot(deviceId, body, captcha),
          )
          await syncKarma()
          setSpots((prev) => {
            const mapped = apiRowToSpot(row, deviceId)
            const rest = prev.filter((s) => s.id !== mapped.id)
            return [...rest, mapped]
          })
          recordActivity()
          emitEngagementEvent({
            type: 'spot_added_nearby',
            spotId: row.id,
            lat: input.lat,
            lng: input.lng,
          })
          postFeedback('Nice. This helps.')
        } catch (e) {
          const msg =
            e instanceof ApiError && e.status === 429
              ? 'Slow down—one spot per minute.'
              : 'Could not save spot.'
          postFeedback(msg)
        }
      })()
    },
    [deviceId, postFeedback, syncKarma],
  )

  const bumpOpenVotes = useCallback(
    (id: string, delta: 1 | -1) => {
      if (delta !== 1) return

      if (USE_DEMO_SEED) {
        const targetSpot = spots.find((s) => s.id === id)
        const targetCoords = targetSpot
          ? { lat: targetSpot.lat, lng: targetSpot.lng }
          : null
        setSpots((prev) =>
          prev.map((s) => {
            if (s.id !== id) return s
            return {
              ...s,
              openVotes: s.openVotes + 1,
              lastActiveMinutesAgo: 0,
              lastConfirmedAt: Date.now(),
              weightedOpenScore: (s.weightedOpenScore ?? s.openVotes) + 1,
            }
          }),
        )
        recordActivity()
        if (targetCoords) {
          emitEngagementEvent({
            type: 'spot_confirmed_nearby',
            spotId: id,
            lat: targetCoords.lat,
            lng: targetCoords.lng,
          })
        }
        postFeedback('Good call')
        return
      }

      ;(async () => {
        try {
          const row = await withCaptcha('vote_open', (captcha) =>
            apiVoteOpen(deviceId, id, captcha),
          )
          await syncKarma()
          setSpots((prev) =>
            prev.map((s) => (s.id === id ? apiRowToSpot(row, deviceId) : s)),
          )
          const targetCoords = { lat: row.latitude, lng: row.longitude }
          recordActivity()
          emitEngagementEvent({
            type: 'spot_confirmed_nearby',
            spotId: id,
            lat: targetCoords.lat,
            lng: targetCoords.lng,
          })
          postFeedback('Good call')
        } catch {
          postFeedback('Could not save vote.')
        }
      })()
    },
    [deviceId, postFeedback, spots, syncKarma],
  )

  const bumpNotSure = useCallback(
    (id: string) => {
      if (USE_DEMO_SEED) {
        const targetSpot = spots.find((s) => s.id === id)
        const targetCoords = targetSpot
          ? { lat: targetSpot.lat, lng: targetSpot.lng }
          : null
        setSpots((prev) =>
          prev.map((s) => {
            if (s.id !== id) return s
            return {
              ...s,
              notSureVotes: s.notSureVotes + 1,
              lastActiveMinutesAgo: Math.min(s.lastActiveMinutesAgo, 30),
              lastConfirmedAt: Date.now(),
            }
          }),
        )
        recordActivity()
        if (targetCoords) {
          emitEngagementEvent({
            type: 'spot_confirmed_nearby',
            spotId: id,
            lat: targetCoords.lat,
            lng: targetCoords.lng,
          })
        }
        postFeedback('Good call')
        return
      }

      ;(async () => {
        try {
          const row = await withCaptcha('vote_not_sure', (captcha) =>
            apiVoteNotSure(deviceId, id, captcha),
          )
          await syncKarma()
          setSpots((prev) =>
            prev.map((s) => (s.id === id ? apiRowToSpot(row, deviceId) : s)),
          )
          recordActivity()
          emitEngagementEvent({
            type: 'spot_confirmed_nearby',
            spotId: id,
            lat: row.latitude,
            lng: row.longitude,
          })
          postFeedback('Good call')
        } catch {
          postFeedback('Could not save vote.')
        }
      })()
    },
    [deviceId, postFeedback, spots, syncKarma],
  )

  const addNote = useCallback(
    (id: string, text: string) => {
      const noteErr = validateNoteInput(text)
      if (noteErr) {
        postFeedback(noteErr)
        return
      }
      const t = text.trim()

      if (USE_DEMO_SEED) {
        setSpots((prev) =>
          prev.map((s) => {
            if (s.id !== id) return s
            return {
              ...s,
              notes: [...s.notes, { text: t, createdAt: Date.now() }],
              lastActiveMinutesAgo: Math.min(s.lastActiveMinutesAgo, 20),
            }
          }),
        )
        recordActivity()
        if (t.length >= 8) postFeedback('You helped someone out')
        return
      }

      ;(async () => {
        try {
          await withCaptcha('spot_note', (captcha) =>
            apiAddNote(deviceId, id, t, captcha),
          )
          await syncKarma()
          await refetchSpots()
          recordActivity()
          if (t.length >= 8) postFeedback('You helped someone out')
        } catch {
          postFeedback('Could not save note.')
        }
      })()
    },
    [deviceId, postFeedback, refetchSpots, syncKarma],
  )

  const addSpotTag = useCallback(
    (id: string, tag: SpotTag) => {
      const apiTag = uiTagsToApi([tag])[0]
      if (!apiTag) return

      if (USE_DEMO_SEED) {
        setSpots((prev) =>
          prev.map((s) => {
            if (s.id !== id) return s
            if (s.tags.includes(tag)) return s
            return { ...s, tags: [...s.tags, tag] }
          }),
        )
        recordActivity()
        postFeedback('Tag added')
        return
      }

      ;(async () => {
        try {
          const row = await withCaptcha('spot_tag', (captcha) =>
            apiAppendSpotTag(deviceId, id, apiTag, captcha),
          )
          await syncKarma()
          setSpots((prev) =>
            prev.map((s) => (s.id === id ? apiRowToSpot(row, deviceId) : s)),
          )
          recordActivity()
          postFeedback('Tag added')
        } catch (e) {
          const msg =
            e instanceof ApiError && e.status === 429
              ? 'Too many tag updates—try again later.'
              : 'Could not add tag.'
          postFeedback(msg)
        }
      })()
    },
    [deviceId, postFeedback, syncKarma],
  )

  const submitUsualTiming = useCallback(
    (id: string, usualOpenUntil: string) => {
      const trimmed = usualOpenUntil.trim()
      if (!trimmed) return
      const normalized = normalizeTimeInputValue(trimmed)
      if (!isReasonableUsualTimeHHMM(normalized)) {
        postFeedback('Pick a time between 6pm and 6am.')
        return
      }

      if (timingSubmitFlightRef.current.has(id)) return
      timingSubmitFlightRef.current.add(id)

      if (USE_DEMO_SEED) {
        try {
          setSpots((prev) =>
            prev.map((s) => {
              if (s.id !== id) return s
              return {
                ...s,
                usualOpenUntil: normalized,
                timingConfidence: 0.55,
                timingLabel: 'NORMAL',
                isLikelyOpenNow: true,
              }
            }),
          )
          postFeedback('Saved usual hours')
        } finally {
          timingSubmitFlightRef.current.delete(id)
        }
        return
      }

      ;(async () => {
        try {
          const agg = await withCaptcha('spot_timing', (captcha) =>
            apiSubmitSpotTiming(deviceId, id, normalized, captcha),
          )
          await syncKarma()
          const patch = timingAggregateToSpotPatch(agg)
          setSpots((prev) =>
            prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
          )
          if (agg.timing_update_accepted === false) {
            postFeedback(
              agg.detail?.trim() ||
                'You already updated usual hours recently. Try again in a bit.',
            )
          } else {
            postFeedback('Thanks — usual hours updated')
          }
        } catch (e) {
          const msg =
            e instanceof ApiError && e.status === 400
              ? 'Pick a time between 6pm and 6am.'
              : 'Could not save usual hours.'
          postFeedback(msg)
        } finally {
          timingSubmitFlightRef.current.delete(id)
        }
      })()
    },
    [deviceId, postFeedback, syncKarma],
  )

  const distanceTo = useCallback(
    (spot: Spot, userLat: number, userLng: number) =>
      distanceMeters(
        { lat: userLat, lng: userLng },
        { lat: spot.lat, lng: spot.lng },
      ),
    [],
  )

  const isOwnSpot = useCallback(
    (spot: Spot) => Boolean(spot.creatorDeviceId && spot.creatorDeviceId === deviceId),
    [deviceId],
  )

  const closeManualChallenge = useCallback(() => {
    const resolver = manualChallenge.resolver
    setManualChallenge({ open: false, resolver: null })
    resolver?.(null)
  }, [manualChallenge])

  const solveManualChallenge = useCallback((token: string) => {
    const resolver = manualChallenge.resolver
    setManualChallenge({ open: false, resolver: null })
    resolver?.(token)
  }, [manualChallenge])

  const value = useMemo(
    () => ({
      spots,
      filters,
      deviceId,
      username,
      areaSignal: effectiveAreaSignal,
      feedbackToast,
      spotsLoading,
      spotsError,
      setFilters,
      postFeedback,
      filteredSpots,
      refreshSpots,
      addSpot,
      bumpOpenVotes,
      bumpNotSure,
      addNote,
      addSpotTag,
      submitUsualTiming,
      distanceTo,
      isOwnSpot,
    }),
    [
      spots,
      filters,
      deviceId,
      username,
      effectiveAreaSignal,
      feedbackToast,
      spotsLoading,
      spotsError,
      postFeedback,
      filteredSpots,
      refreshSpots,
      addSpot,
      bumpOpenVotes,
      bumpNotSure,
      addNote,
      addSpotTag,
      submitUsualTiming,
      distanceTo,
      isOwnSpot,
    ],
  )

  return (
    <AppStateContext.Provider value={value}>
      {children}
      <ManualCaptchaModal
        open={manualChallenge.open}
        onSolved={solveManualChallenge}
        onClose={closeManualChallenge}
      />
    </AppStateContext.Provider>
  )
}
