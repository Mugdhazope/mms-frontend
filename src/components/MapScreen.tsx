import { useCallback, useEffect, useMemo, useState } from 'react'

import suttaImg from '@/assets/sutta.png'

import { useAppState } from '@/hooks/useAppState'
import { useUserLocation } from '@/hooks/useUserLocation'
import { formatDistance, formatLastSeen, formatTipDateTime } from '@/lib/format'
import { minutesSinceOpenConfirmation } from '@/lib/spotRecency'
import {
  openGoogleMapsDirections,
  openGoogleMapsPin,
} from '@/lib/googleMaps'
import { searchPlaces } from '@/lib/photonGeocode'
import {
  isReasonableUsualTimeHHMM,
  normalizeTimeInputValue,
} from '@/lib/usualTiming'
import { isOpenNowOnlyView, spotFiltersEqual } from '@/state/filterSpots'
import { SPOT_TAG_COPY, SPOT_TAG_ORDER } from '@/lib/spotTagLabels'
import type { SpotFilters, SpotTag } from '@/types/spot'

import { BottomSheet } from './BottomSheet'
import { FilterSheet } from './FilterSheet'
import { DirectionsIcon, MapPinIcon } from './icons/MapActionIcons'
import { FilterSlidersIcon } from './icons/FilterSlidersIcon'
import { MyLocationIcon } from './icons/MyLocationIcon'
import { MapView } from './MapView'
import { SpotCard } from './SpotCard'
import { ThemeToggle } from './ThemeToggle'

/** Same max height for “Spots near you”; pin details taller for From people tab. */
const MAP_SHEET_PANEL_MAX = 'max-h-[40dvh]'
const DETAIL_SHEET_PANEL_MAX = 'max-h-[min(56dvh,580px)]'

type AddPlaceMode = 'current' | 'search' | 'map'

export function MapScreen() {
   const {
    lat: userLat,
    lng: userLng,
    status: locationStatus,
  } = useUserLocation()
  const {
    spots,
    filteredSpots,
    addSpot,
    bumpOpenVotes,
    bumpNotSure,
    addNote,
    addSpotTag,
    distanceTo,
    filters,
    setFilters,
    postFeedback,
    isOwnSpot,
    refreshSpots,
    submitUsualTiming,
    spotsError,
    spotsLoading,
    username,
  } = useAppState()

  const [nearbyOpen, setNearbyOpen] = useState(false)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [detailsSpotId, setDetailsSpotId] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<'details' | 'fromPeople'>('details')
  const [usualTimeDraft, setUsualTimeDraft] = useState('04:00')
  const [flyToSpot, setFlyToSpot] = useState<{ lat: number; lng: number } | null>(
    null,
  )

  const [addName, setAddName] = useState('')
  const [noteDraft, setNoteDraft] = useState('')

  const [addPlaceMode, setAddPlaceMode] = useState<AddPlaceMode>('current')
  const [addChosenCoords, setAddChosenCoords] = useState<{
    lat: number
    lng: number
    label: string
  } | null>(null)
  const [addSearchQuery, setAddSearchQuery] = useState('')
  const [addSearchResults, setAddSearchResults] = useState<
    Awaited<ReturnType<typeof searchPlaces>>
  >([])
  const [addSearchLoading, setAddSearchLoading] = useState(false)
  const [mapPickActive, setMapPickActive] = useState(false)
  const [locateRequestId, setLocateRequestId] = useState(0)
  const [identityFlipped, setIdentityFlipped] = useState(false)
  const [openVoteAnimSpotId, setOpenVoteAnimSpotId] = useState<string | null>(null)
  const [notSureAnimSpotId, setNotSureAnimSpotId] = useState<string | null>(null)

  useEffect(() => {
    if (!flyToSpot) return
    const t = window.setTimeout(() => setFlyToSpot(null), 900)
    return () => window.clearTimeout(t)
  }, [flyToSpot])

  useEffect(() => {
    if (!mapPickActive) return
    const html = document.documentElement
    html.classList.add('mms-map-pick-lock')
    return () => html.classList.remove('mms-map-pick-lock')
  }, [mapPickActive])

  useEffect(() => {
    if (import.meta.env.VITE_USE_SEED === 'true') return
    const t = window.setTimeout(() => {
      void refreshSpots()
    }, 400)
    return () => window.clearTimeout(t)
  }, [refreshSpots])

  useEffect(() => {
    if (detailsSpotId && !spots.some((s) => s.id === detailsSpotId)) {
      /* Drop stale selection only when spot is truly gone from server data. */
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync selection to available rows
      setDetailsSpotId(null)
      setNoteDraft('')
    }
  }, [spots, detailsSpotId])

  useEffect(() => {
    if (detailsSpotId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset tab when opening a different spot
      setDetailTab('details')
    }
  }, [detailsSpotId])

  const sortedNearby = useMemo(() => {
    const withDist = filteredSpots.map((s) => ({
      spot: s,
      d: distanceTo(s, userLat, userLng),
    }))
    withDist.sort((a, b) => a.d - b.d)
    return withDist.slice(0, 5)
  }, [filteredSpots, distanceTo, userLat, userLng])

  const mapSpots = useMemo(() => {
    const withDist = filteredSpots.map((s) => ({
      spot: s,
      d: distanceTo(s, userLat, userLng),
    }))
    withDist.sort((a, b) => a.d - b.d)
    return withDist.map((x) => x.spot)
  }, [filteredSpots, distanceTo, userLat, userLng])

  const detailsSpot = useMemo(
    () => spots.find((s) => s.id === detailsSpotId) ?? null,
    [spots, detailsSpotId],
  )

  useEffect(() => {
    if (!detailsSpot) return
    setUsualTimeDraft(detailsSpot.usualOpenUntil ?? '04:00')
  }, [detailsSpot])

  const canSubmitUsualTime = useMemo(() => {
    if (!detailsSpot) return false
    return isReasonableUsualTimeHHMM(normalizeTimeInputValue(usualTimeDraft))
  }, [detailsSpot, usualTimeDraft])

  const mapSelectedSpotId = detailsSpot ? detailsSpotId : null
  const chipName = useMemo(() => {
    const raw = (username ?? '').trim()
    if (!raw) return 'friend'
    return raw.charAt(0).toUpperCase() + raw.slice(1)
  }, [username])
  const identityChipWidthPx = useMemo(() => {
    if (identityFlipped) return 138
    const label = `MMS for ${chipName}`
    return Math.min(320, Math.max(112, label.length * 10 + 26))
  }, [chipName, identityFlipped])

  const onSelectSpot = useCallback((id: string) => {
    setDetailsSpotId(id)
  }, [])

  const resetAddSpotForm = useCallback(() => {
    setAddPlaceMode('current')
    setAddChosenCoords(null)
    setAddSearchQuery('')
    setAddSearchResults([])
    setAddSearchLoading(false)
    setMapPickActive(false)
  }, [])

  const openAddSheet = () => {
    resetAddSpotForm()
    setAddName('')
    setAddOpen(true)
  }

  const pinCoordsForAdd = useMemo(() => {
    if (addPlaceMode === 'current') {
      return { lat: userLat, lng: userLng, label: 'My location' as const }
    }
    if (addChosenCoords) {
      return addChosenCoords
    }
    return null
  }, [addPlaceMode, userLat, userLng, addChosenCoords])

  const canSubmitAdd = pinCoordsForAdd !== null

  useEffect(() => {
    if (addPlaceMode !== 'search' || !addOpen) return
    const q = addSearchQuery.trim()
    if (q.length < 2) {
      queueMicrotask(() => {
        setAddSearchResults([])
        setAddSearchLoading(false)
      })
      return
    }
    let cancelled = false
    const t = window.setTimeout(() => {
      setAddSearchLoading(true)
      void searchPlaces(q).then((results) => {
        if (!cancelled) {
          setAddSearchResults(results)
          setAddSearchLoading(false)
        }
      })
    }, 380)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [addSearchQuery, addPlaceMode, addOpen])

  const submitAddSpot = () => {
    if (!pinCoordsForAdd) return
    addSpot({
      name: addName,
      tags: [],
      lat: pinCoordsForAdd.lat,
      lng: pinCoordsForAdd.lng,
    })
    setAddName('')
    setAddOpen(false)
    resetAddSpotForm()
  }

  const handleMapPick = useCallback((lat: number, lng: number) => {
    setAddChosenCoords({
      lat,
      lng,
      label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    })
    setAddPlaceMode('map')
    setMapPickActive(false)
    setAddOpen(true)
  }, [])

  const cancelMapPick = () => {
    setMapPickActive(false)
    setAddOpen(true)
  }

  const closeDetails = () => {
    setDetailsSpotId(null)
    setNoteDraft('')
    setDetailTab('details')
  }

  const tagsMissingForSpot = useCallback((spotTags: SpotTag[]) => {
    const have = new Set(spotTags)
    return SPOT_TAG_ORDER.filter((t) => !have.has(t))
  }, [])

  const applyFiltersFromSheet = useCallback(
    (next: SpotFilters) => {
      if (spotFiltersEqual(next, filters)) return
      setFilters(next)
      postFeedback(
        isOpenNowOnlyView(next)
          ? "Showing what's open now"
          : 'Filters updated',
      )
    },
    [filters, setFilters, postFeedback],
  )

  useEffect(() => {
    const el = document.documentElement
    el.classList.add('mms-map-route')
    return () => el.classList.remove('mms-map-route')
  }, [])

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-[var(--mms-leaflet-bg)]">
      <header className="pointer-events-none absolute left-0 right-0 top-0 z-[5000] flex items-center justify-between gap-3 px-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] sm:px-4">
        <div className="pointer-events-auto [perspective:1200px]">
          <button
            type="button"
            onClick={() => setIdentityFlipped((v) => !v)}
            className="relative h-10 rounded-full transition-[width] duration-300 ease-out"
            style={{ width: `${identityChipWidthPx}px` }}
            aria-label="Toggle identity card"
          >
            <span
              className="absolute inset-0 flex items-center justify-center rounded-full border border-border/80 bg-surface-900/80 px-4 py-2 text-center text-sm font-bold tracking-wide text-foreground backdrop-blur-md [backface-visibility:hidden] transition-transform duration-300"
              style={{ transform: identityFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
            >
              <span className="text-yellow-300">MMS</span>
              <span>&nbsp;for {chipName}</span>
            </span>
            <span
              className="absolute inset-0 flex items-center justify-center gap-1.5 rounded-full border border-border/80 bg-surface-900/80 px-2 py-1.5 text-[11px] font-semibold text-foreground/95 backdrop-blur-md [backface-visibility:hidden] transition-transform duration-300"
              style={{ transform: identityFlipped ? 'rotateY(360deg)' : 'rotateY(180deg)' }}
            >
              <img
                src={suttaImg}
                alt=""
                width={56}
                height={28}
                className="h-6 w-auto max-w-[2.8rem] shrink-0 object-contain"
                decoding="async"
              />
              <span className="leading-none">MapMySutta</span>
            </span>
          </button>
        </div>
        <div className="pointer-events-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterSheetOpen(true)}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-border/80 bg-surface-900/82 px-3.5 py-2 text-xs font-medium text-foreground/95 backdrop-blur-md transition-transform active:scale-[0.98]"
            aria-haspopup="dialog"
            aria-expanded={filterSheetOpen}
          >
            <FilterSlidersIcon className="shrink-0 opacity-90" />
            Filter
          </button>
          <ThemeToggle size="sm" />
        </div>
      </header>

      <p
        className="pointer-events-none absolute left-1/2 top-[max(calc(4.25rem+env(safe-area-inset-top,0px)),calc(4rem+env(safe-area-inset-top,0px)))] z-[5000] -translate-x-1/2 rounded-full border border-border/50 bg-surface-900/72 px-3 py-1 text-[11px] text-muted backdrop-blur-md"
        aria-live="polite"
      >
        {spotsError
          ? 'Could not load spots (is the API running?)'
          : spotsLoading
            ? 'Loading spots…'
            : isOpenNowOnlyView(filters)
              ? 'Open now'
              : 'Filtered'}
      </p>

      <div className="mms-visual-viewport-layer z-0 min-h-0 bg-[var(--mms-leaflet-bg)]">
        <div className="absolute inset-0 min-h-0">
          <MapView
          spots={mapSpots}
            userLat={userLat}
            userLng={userLng}
            locationStatus={locationStatus}
            locateRequestId={locateRequestId}
            selectedSpotId={mapSelectedSpotId}
            onSelectSpot={onSelectSpot}
            showHeatLayer={filters.usuallyWorks}
            flyToSpot={flyToSpot}
            mapPickActive={mapPickActive}
            onMapPick={handleMapPick}
          />
        </div>
      </div>

      {mapPickActive ? (
        <div className="pointer-events-auto absolute bottom-[max(8.75rem,calc(env(safe-area-inset-bottom)+6.75rem))] left-1/2 z-[6000] w-[min(100%-2rem,360px)] -translate-x-1/2 rounded-2xl border border-border bg-surface-800/95 px-4 py-3 text-center shadow-[var(--mms-pick-banner-shadow)] backdrop-blur-md">
          <p className="text-sm text-foreground">Tap the map to place your pin</p>
          <button
            type="button"
            onClick={cancelMapPick}
            className="mt-3 min-h-[40px] w-full rounded-xl border border-border text-xs font-medium text-muted transition-colors hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setLocateRequestId((n) => n + 1)}
        className="pointer-events-auto absolute bottom-[max(7.25rem,calc(env(safe-area-inset-bottom)+5.85rem))] right-[max(0.75rem,env(safe-area-inset-right))] z-[5000] flex h-11 w-11 items-center justify-center rounded-full border border-border/80 bg-surface-900/88 text-foreground/95 backdrop-blur-md transition-transform active:scale-[0.96] sm:right-4"
        aria-label="My location"
        title="My location"
      >
        <MyLocationIcon className="h-[1.35rem] w-[1.35rem]" />
      </button>

      <button
        type="button"
        onClick={() => setNearbyOpen(true)}
        className="absolute left-1/2 top-[max(calc(6.35rem+env(safe-area-inset-top,0px)),calc(6rem+env(safe-area-inset-top,0px)))] z-[5000] -translate-x-1/2 rounded-full border border-border/80 bg-surface-900/82 px-4 py-2 text-xs font-medium text-foreground/95 backdrop-blur-md transition-transform active:scale-[0.98]"
      >
        Spots near you
      </button>

      <div className="absolute bottom-[max(3.35rem,calc(env(safe-area-inset-bottom)+2.4rem))] left-1/2 z-[5000] flex w-max max-w-[calc(100%-1.5rem)] -translate-x-1/2 justify-center">
        <button
          type="button"
          onClick={openAddSheet}
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-full border border-border/85 bg-surface-900/90 px-4 py-2 text-sm font-medium text-foreground/95 backdrop-blur-md transition-transform active:scale-[0.98]"
        >
          <span className="text-base leading-none text-accent">+</span>
          Drop a pin
        </button>
      </div>

      <FilterSheet
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        appliedFilters={filters}
        onApply={applyFiltersFromSheet}
      />

      <BottomSheet
        open={nearbyOpen}
        onClose={() => setNearbyOpen(false)}
        title="Spots near you"
        subtitle="Closest to you first. Tap for details."
        panelMaxClassName={MAP_SHEET_PANEL_MAX}
      >
        <div className="flex flex-col gap-2">
          {sortedNearby.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              No spots match these filters.
            </p>
          ) : (
            sortedNearby.map(({ spot, d }) => (
              <SpotCard
                key={spot.id}
                spot={spot}
                distanceMeters={d}
                isOwnSpot={isOwnSpot(spot)}
                onClick={() => {
                  setDetailsSpotId(spot.id)
                  setFlyToSpot({ lat: spot.lat, lng: spot.lng })
                  setNearbyOpen(false)
                }}
              />
            ))
          )}
        </div>
      </BottomSheet>

      <BottomSheet
        open={addOpen}
        onClose={() => {
          setAddOpen(false)
          resetAddSpotForm()
        }}
        title="Add a spot"
        subtitle="Pin it. Help someone out."
      >
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-xs font-medium text-muted">Where</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setAddPlaceMode('current')
                  setAddChosenCoords(null)
                }}
                className={`rounded-full border px-3 py-2 text-xs font-medium transition-colors ${
                  addPlaceMode === 'current'
                    ? 'border-accent/50 bg-accent/15 text-accent'
                    : 'border-border bg-surface-900/60 text-muted'
                }`}
              >
                My location
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddPlaceMode('search')
                  setAddChosenCoords(null)
                }}
                className={`rounded-full border px-3 py-2 text-xs font-medium transition-colors ${
                  addPlaceMode === 'search'
                    ? 'border-accent/50 bg-accent/15 text-accent'
                    : 'border-border bg-surface-900/60 text-muted'
                }`}
              >
                Search place
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddOpen(false)
                  setMapPickActive(true)
                }}
                className={`rounded-full border px-3 py-2 text-xs font-medium transition-colors ${
                  addPlaceMode === 'map'
                    ? 'border-accent/50 bg-accent/15 text-accent'
                    : 'border-border bg-surface-900/60 text-muted'
                }`}
              >
                Tap map
              </button>
            </div>
          </div>

          {addPlaceMode === 'search' ? (
            <div className="rounded-xl border border-border bg-surface-900/50 p-3">
              <label className="block">
                <span className="text-xs font-medium text-muted">Search</span>
                <input
                  value={addSearchQuery}
                  onChange={(e) => setAddSearchQuery(e.target.value)}
                  placeholder="Street, area, landmark…"
                  className="mt-2 w-full rounded-lg border border-border bg-surface-900/80 px-3 py-2.5 text-base text-foreground placeholder:text-muted/60 outline-none ring-accent/30 focus:ring-2"
                  autoComplete="off"
                />
              </label>
              {addSearchLoading ? (
                <p className="mt-2 text-xs text-muted">Searching…</p>
              ) : null}
              <ul className="mt-2 max-h-40 overflow-y-auto">
                {addSearchResults.map((r, i) => (
                  <li key={`${r.lat}-${r.lng}-${i}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setAddChosenCoords({
                          lat: r.lat,
                          lng: r.lng,
                          label: r.label,
                        })
                        if (!addName.trim()) {
                          const short =
                            r.label.split(',')[0]?.trim() ?? r.label
                          if (short.length <= 48) setAddName(short)
                        }
                      }}
                      className={`mb-1 w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                        addChosenCoords?.lat === r.lat &&
                        addChosenCoords?.lng === r.lng
                          ? 'bg-accent/15 text-accent'
                          : 'text-foreground hover:bg-foreground/5'
                      }`}
                    >
                      {r.label}
                    </button>
                  </li>
                ))}
              </ul>
              {addPlaceMode === 'search' &&
              addSearchQuery.trim().length >= 2 &&
              !addSearchLoading &&
              addSearchResults.length === 0 ? (
                <p className="mt-2 text-xs text-muted">No results. Try another query.</p>
              ) : null}
            </div>
          ) : null}

          {pinCoordsForAdd ? (
            <p className="text-xs text-muted">
              Pin at:{' '}
              <span className="text-foreground/90">{pinCoordsForAdd.label}</span>
            </p>
          ) : addPlaceMode === 'search' ? (
            <p className="text-xs text-muted">Pick a result to set the pin.</p>
          ) : null}

          <label className="block">
            <span className="text-xs font-medium text-muted">Name (optional)</span>
            <input
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder="e.g. Shiv Shakti Pan"
              className="mt-2 w-full rounded-xl border border-border bg-surface-900/80 px-4 py-3 text-base text-foreground placeholder:text-muted/60 outline-none ring-accent/30 focus:ring-2"
            />
          </label>
          <button
            type="button"
            disabled={!canSubmitAdd}
            onClick={submitAddSpot}
            className="min-h-[48px] w-full rounded-xl bg-accent font-medium text-on-accent shadow-[var(--mms-accent-glow)] transition-transform enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Pin this spot
          </button>
        </div>
      </BottomSheet>

      <BottomSheet
        open={Boolean(detailsSpot)}
        onClose={closeDetails}
        title={detailsSpot?.name ?? 'Unnamed spot'}
        panelMaxClassName={DETAIL_SHEET_PANEL_MAX}
        bodyClassName="pt-2 pb-4"
        customHeader={
          detailsSpot ? (
            <div className="border-b border-border-subtle px-5 pb-3 pt-0">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-medium leading-snug text-foreground">
                    {detailsSpot.name ?? 'Unnamed spot'}
                  </p>
                  {isOwnSpot(detailsSpot) ? (
                    <p className="mt-0.5 text-[11px] text-muted">You marked this</p>
                  ) : null}
                  <p className="mt-1 text-[11px] leading-snug text-muted">
                    {formatDistance(distanceTo(detailsSpot, userLat, userLng))} ·{' '}
                    <span className="text-foreground/90">{detailsSpot.openVotes}</span>{' '}
                    open ·{' '}
                    {formatLastSeen(minutesSinceOpenConfirmation(detailsSpot))}
                  </p>
                  {detailsSpot.usualOpenUntil || detailsSpot.isLikelyOpenNow ? (
                    <p className="mt-1 text-[11px] text-muted">
                      {detailsSpot.usualOpenUntil ? (
                        <>
                          ~{detailsSpot.usualOpenUntil} typical {detailsSpot.isLikelyOpenNow ? (
                            <span className="text-accent"> · probably open</span>
                          ) : null}
                        </>
                      ) : detailsSpot.isLikelyOpenNow ? (
                        <span className="text-accent">Probably open now</span>
                      ) : null}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-1 pt-0.5">
                  <button
                    type="button"
                    onClick={() =>
                      openGoogleMapsDirections(detailsSpot.lat, detailsSpot.lng)
                    }
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-on-accent shadow-[var(--mms-accent-glow)] transition-transform active:scale-95"
                    aria-label="Directions in Google Maps"
                    title="Directions"
                  >
                    <DirectionsIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      openGoogleMapsPin(detailsSpot.lat, detailsSpot.lng)
                    }
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-900/80 text-foreground transition-transform active:scale-95"
                    aria-label="View pinned location in Google Maps"
                    title="View on map"
                  >
                    <MapPinIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : null
        }
      >
        {detailsSpot ? (
          <div className="flex min-h-0 flex-col gap-2">
            <div
              className="flex shrink-0 gap-1 rounded-xl border border-border bg-surface-900/40 p-1"
              role="tablist"
              aria-label="Spot details sections"
            >
              <button
                type="button"
                role="tab"
                aria-selected={detailTab === 'details'}
                onClick={() => setDetailTab('details')}
                className={`min-h-[40px] flex-1 rounded-lg border px-2 text-xs font-medium transition-colors ${
                  detailTab === 'details'
                    ? 'border-border bg-foreground/10 text-foreground'
                    : 'border-transparent text-muted hover:text-foreground'
                }`}
              >
                Details
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={detailTab === 'fromPeople'}
                onClick={() => setDetailTab('fromPeople')}
                className={`min-h-[40px] flex-1 rounded-lg border px-2 text-xs font-medium transition-colors ${
                  detailTab === 'fromPeople'
                    ? 'border-border bg-foreground/10 text-foreground'
                    : 'border-transparent text-muted hover:text-foreground'
                }`}
              >
                From people
                {detailsSpot.tags.length + detailsSpot.notes.length > 0 ? (
                  <span className="ml-1 tabular-nums opacity-80">
                    ({detailsSpot.tags.length + detailsSpot.notes.length})
                  </span>
                ) : null}
              </button>
            </div>

            {detailTab === 'fromPeople' ? (
              <div className="flex min-h-0 flex-col gap-3">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted/70">
                    What people say
                  </p>
                  <p className="mt-1 text-[11px] leading-snug text-muted">
                    Tips from the crowd—add something short if you stopped by.
                  </p>
                  <div className="mt-2 h-[88px] overflow-hidden rounded-lg border border-border bg-surface-900/40">
                    <ul className="h-full overflow-y-auto overscroll-contain px-2 py-1.5 [scrollbar-gutter:stable]">
                      {detailsSpot.notes.length === 0 ? (
                        <li className="flex h-full items-center justify-center px-2 text-center text-[11px] text-muted">
                          No tips yet.
                        </li>
                      ) : (
                        detailsSpot.notes.map((n, i) => (
                          <li
                            key={`${n.createdAt}-${i}-${n.text.slice(0, 8)}`}
                            className="mb-1 last:mb-0 rounded-md border border-border/80 bg-surface-900/50 px-2 py-1 text-[11px] text-foreground/90"
                          >
                            <p className="whitespace-pre-wrap break-words">{n.text}</p>
                            <p className="mt-0.5 text-[10px] text-muted">
                              {formatTipDateTime(n.createdAt)}
                            </p>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                  <div className="mt-2 flex shrink-0 items-end gap-2">
                    <label className="min-w-0 flex-1">
                      <span className="sr-only">Add a quick tip</span>
                      <input
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        placeholder="Add a quick tip"
                        className="w-full rounded-lg border border-border bg-surface-900/80 px-3 py-2.5 text-sm text-foreground placeholder:text-muted/60 outline-none ring-accent/30 focus:ring-2"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            addNote(detailsSpot.id, noteDraft)
                            setNoteDraft('')
                          }
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        addNote(detailsSpot.id, noteDraft)
                        setNoteDraft('')
                      }}
                      className="min-h-[44px] shrink-0 rounded-lg border border-border bg-surface-800 px-3 text-xs font-medium text-foreground transition-transform active:scale-[0.98]"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted/70">
                    Quick labels
                  </p>
                  <p className="mt-1 text-[11px] text-muted">
                    Optional one-tap labels—only if they fit this spot.
                  </p>
                  {detailsSpot.tags.length === 0 ? (
                    <p className="mt-2 text-sm text-muted">
                      None yet. Add a label if it helps someone decide faster.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {detailsSpot.tags.map((t) => {
                        const copy = SPOT_TAG_COPY[t]
                        return (
                          <li
                            key={t}
                            className="rounded-xl border border-border bg-surface-900/45 px-3 py-2.5"
                          >
                            <p className="text-sm font-medium text-foreground">
                              {copy.label}
                            </p>
                            <p className="mt-0.5 text-[11px] leading-snug text-muted">
                              {copy.description}
                            </p>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
                {tagsMissingForSpot(detailsSpot.tags).length > 0 ? (
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted/70">
                      Add a label
                    </p>
                    <ul className="mt-2 space-y-2">
                      {tagsMissingForSpot(detailsSpot.tags).map((t) => {
                        const copy = SPOT_TAG_COPY[t]
                        return (
                          <li key={t}>
                            <button
                              type="button"
                              onClick={() => addSpotTag(detailsSpot.id, t)}
                              className="flex w-full min-h-[48px] flex-col items-stretch justify-center rounded-xl border border-border bg-surface-900/50 px-3 py-2 text-left transition-transform active:scale-[0.99]"
                            >
                              <span className="text-sm font-medium text-foreground">
                                + {copy.label}
                              </span>
                              <span className="mt-0.5 text-[11px] text-muted">
                                {copy.description}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted">
                    All label types are on this spot. Thanks for helping out.
                  </p>
                )}
              </div>
            ) : null}

            {detailTab === 'details' ? (
            <div className="flex min-h-0 flex-col gap-2">
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted/70">
                Confirm for others
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpenVoteAnimSpotId(detailsSpot.id)
                    window.setTimeout(() => setOpenVoteAnimSpotId(null), 280)
                    bumpOpenVotes(detailsSpot.id, 1)
                  }}
                  className={`inline-flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-xl bg-accent px-2 py-2 text-center text-xs font-semibold leading-tight text-on-accent shadow-[var(--mms-accent-glow)] transition-all active:scale-[0.98] ${openVoteAnimSpotId === detailsSpot.id ? 'scale-[1.02] brightness-110 shadow-[0_0_22px_rgba(255,174,0,0.55)]' : ''}`}
                >
                  <span
                    aria-hidden
                    className={`text-base leading-none transition-all ${openVoteAnimSpotId === detailsSpot.id ? 'drop-shadow-[0_0_8px_rgba(255,184,77,0.9)]' : ''}`}
                  >
                    {'\u{1F6AC}'}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    Cig lit
                    {openVoteAnimSpotId === detailsSpot.id ? (
                      <span aria-hidden className="text-[11px] animate-pulse">
                        {'\u{1F525}'}
                      </span>
                    ) : null}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNotSureAnimSpotId(detailsSpot.id)
                    window.setTimeout(() => setNotSureAnimSpotId(null), 280)
                    bumpNotSure(detailsSpot.id)
                  }}
                  className={`inline-flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-xl border border-border bg-surface-900/80 px-2 py-2 text-center text-xs font-medium leading-tight text-foreground transition-all active:scale-[0.98] ${notSureAnimSpotId === detailsSpot.id ? 'opacity-65 saturate-50' : ''}`}
                >
                  <span aria-hidden className="text-base leading-none">
                    {'\u{1F44E}'}
                  </span>
                  Scene doubtful
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface-900/45 px-3 py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[11px] font-medium text-muted">
                  Typical close
                </p>
                <p className="text-[9px] text-muted/80">6pm–6am · anonymous  · crowd-sourced</p>
              </div>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <label className="flex min-w-[120px] flex-1 flex-col gap-1">
                  <span className="text-[10px] text-muted">Time</span>
                  <input
                    type="time"
                    value={usualTimeDraft}
                    onChange={(e) => setUsualTimeDraft(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface-900/80 px-2 py-2 text-sm text-foreground outline-none ring-accent/30 focus:ring-2"
                  />
                </label>
                <button
                  type="button"
                  disabled={!canSubmitUsualTime}
                  onClick={() =>
                    submitUsualTiming(detailsSpot.id, usualTimeDraft)
                  }
                  className="min-h-[40px] shrink-0 rounded-lg bg-accent px-4 text-xs font-medium text-on-accent shadow-[var(--mms-accent-glow)] transition-transform enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Save
                </button>
              </div>
            </div>
            </div>
            ) : null}
          </div>
        ) : null}
      </BottomSheet>

    </div>
  )
}
