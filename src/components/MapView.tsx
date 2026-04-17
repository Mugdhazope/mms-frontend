import { useEffect, useMemo, memo, useRef, useState } from 'react'
import L from 'leaflet'
import {
  CircleMarker,
  MapContainer,
  Marker,
  TileLayer,
  ZoomControl,
  useMap,
  useMapEvents,
} from 'react-leaflet'

import { DEFAULT_CENTER } from '@/data/spots'
import type { UserLocationState } from '@/hooks/useUserLocation'
import type { Spot } from '@/types/spot'

import { minutesSinceOpenConfirmation } from '@/lib/spotRecency'
import type { MapTheme } from '@/lib/spotPinHtml'
import { spotPinHtml } from '@/lib/spotPinHtml'
import { useTheme } from '@/hooks/useTheme'

import { HeatmapLayer } from './HeatmapLayer'

/**
 * Centers on the user once when geolocation resolves, then only moves when
 * `locateRequestId` changes (My location control).
 */
function MapCameraController({
  userLat,
  userLng,
  locationStatus,
  locateRequestId,
}: {
  userLat: number
  userLng: number
  locationStatus: UserLocationState['status']
  locateRequestId: number
}) {
  const map = useMap()
  const initialAfterLocationDone = useRef(false)
  const lastLocateId = useRef(0)

  useEffect(() => {
    if (locationStatus === 'pending') return
    if (initialAfterLocationDone.current) return
    initialAfterLocationDone.current = true
    map.setView([userLat, userLng], 15, { animate: true, duration: 0.4 })
  }, [locationStatus, userLat, userLng, map])

  useEffect(() => {
    if (locateRequestId === 0) return
    if (locateRequestId === lastLocateId.current) return
    lastLocateId.current = locateRequestId
    map.flyTo([userLat, userLng], Math.max(map.getZoom(), 14), {
      duration: 0.45,
    })
  }, [locateRequestId, userLat, userLng, map])

  return null
}

function FlyToSpot({
  target,
}: {
  target: { lat: number; lng: number } | null
}) {
  const map = useMap()
  useEffect(() => {
    if (!target) return
    map.flyTo([target.lat, target.lng], 17, { duration: 0.45 })
  }, [target, map])
  return null
}

function MapPickHandler({
  active,
  onPick,
}: {
  active: boolean
  onPick: (lat: number, lng: number) => void
}) {
  useMapEvents({
    click(e) {
      if (active) onPick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

/**
 * Web Mercator: at low zoom the world can be shorter in pixels than the map
 * container height (portrait phones and many desktop windows). That leaves
 * empty bands above/below. Clamp min zoom so N–S world span always fills height.
 */
const WORLD_BOUNDS = L.latLngBounds([-85, -180], [85, 180])

/** iOS keyboard / Safari chrome changes visual viewport; Leaflet must remeasure. */
function MapInvalidateOnViewportChange() {
  const map = useMap()
  useEffect(() => {
    const schedule = () => {
      requestAnimationFrame(() => {
        map.invalidateSize({ animate: false })
      })
    }
    const vv = window.visualViewport
    if (vv) {
      vv.addEventListener('resize', schedule)
      vv.addEventListener('scroll', schedule)
    }
    window.addEventListener('resize', schedule)
    schedule()
    return () => {
      if (vv) {
        vv.removeEventListener('resize', schedule)
        vv.removeEventListener('scroll', schedule)
      }
      window.removeEventListener('resize', schedule)
    }
  }, [map])
  return null
}

function ViewportMinZoomClamp() {
  const map = useMap()

  useEffect(() => {
    const el = map.getContainer()
    let resizeT: number | undefined

    const apply = () => {
      const h = el.clientHeight
      const w = el.clientWidth
      if (h < 48 || w < 48) return

      const center = map.getCenter()
      const currentZoom = map.getZoom()
      const lng = center.lng

      let minZ = 0
      let satisfied = false
      for (let z = 0; z <= 14; z++) {
        map.setView(center, z, { animate: false })
        const pn = map.latLngToContainerPoint(
          L.latLng(WORLD_BOUNDS.getNorth(), lng),
        )
        const ps = map.latLngToContainerPoint(
          L.latLng(WORLD_BOUNDS.getSouth(), lng),
        )
        const worldPixelH = Math.abs(ps.y - pn.y)
        if (worldPixelH >= h * 0.992) {
          minZ = z
          satisfied = true
          break
        }
      }
      if (!satisfied) minZ = 14

      map.setMinZoom(minZ)
      const nextZoom = Math.max(currentZoom, minZ)
      map.setView(center, nextZoom, { animate: false })
      map.invalidateSize({ animate: false })
    }

    const scheduleApply = () => {
      window.clearTimeout(resizeT)
      resizeT = window.setTimeout(() => requestAnimationFrame(apply), 60)
    }

    map.whenReady(() => requestAnimationFrame(apply))
    const ro = new ResizeObserver(scheduleApply)
    ro.observe(el)
    return () => {
      ro.disconnect()
      window.clearTimeout(resizeT)
    }
  }, [map])

  return null
}

type MapViewProps = {
  spots: Spot[]
  userLat: number
  userLng: number
  locationStatus: UserLocationState['status']
  locateRequestId: number
  selectedSpotId: string | null
  onSelectSpot: (id: string) => void
  showHeatLayer: boolean
  flyToSpot: { lat: number; lng: number } | null
  mapPickActive?: boolean
  onMapPick?: (lat: number, lng: number) => void
}

const SpotMarkerItem = memo(function SpotMarkerItem({
  spot,
  selectedSpotId,
  onSelectSpot,
  interactive,
  mapTheme,
  recencyTick,
}: {
  spot: Spot
  selectedSpotId: string | null
  onSelectSpot: (id: string) => void
  interactive: boolean
  mapTheme: MapTheme
  recencyTick: number
}) {
  const isActive =
    selectedSpotId === spot.id ||
    minutesSinceOpenConfirmation(spot) < 30
  const icon = useMemo(
    () =>
      L.divIcon({
        className: 'mms-leaflet-marker',
        html: spotPinHtml(isActive, mapTheme, spot.openVotes),
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      }),
    [isActive, mapTheme, spot.openVotes, recencyTick],
  )
  return (
    <Marker
      position={[spot.lat, spot.lng]}
      icon={icon}
      interactive={interactive}
      eventHandlers={{
        click: () => onSelectSpot(spot.id),
      }}
    />
  )
})

function SpotMarkers({
  spots,
  selectedSpotId,
  onSelectSpot,
  markersInteractive,
  mapTheme,
  recencyTick,
}: Pick<MapViewProps, 'spots' | 'selectedSpotId' | 'onSelectSpot'> & {
  markersInteractive: boolean
  mapTheme: MapTheme
  recencyTick: number
}) {
  return (
    <>
      {spots.map((spot) => (
        <SpotMarkerItem
          key={spot.id}
          spot={spot}
          selectedSpotId={selectedSpotId}
          onSelectSpot={onSelectSpot}
          interactive={markersInteractive}
          mapTheme={mapTheme}
          recencyTick={recencyTick}
        />
      ))}
    </>
  )
}

export function MapView({
  spots,
  userLat,
  userLng,
  locationStatus,
  locateRequestId,
  selectedSpotId,
  onSelectSpot,
  showHeatLayer,
  flyToSpot,
  mapPickActive = false,
  onMapPick,
}: MapViewProps) {
  const { theme } = useTheme()
  const mapTheme: MapTheme = theme
  const center: [number, number] = [userLat, userLng]
  const [recencyTick, setRecencyTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setRecencyTick((n) => n + 1), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const tileUrl =
    mapTheme === 'light'
      ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'

  const heatPoints = useMemo(
    () =>
      spots.map(
        (s) =>
          [s.lat, s.lng, Math.max(0.15, s.activityScore)] as [
            number,
            number,
            number,
          ],
      ),
    [spots],
  )

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={15}
      className={`z-0 m-0 h-full w-full min-h-0 min-w-0 rounded-none p-0 ${mapPickActive ? 'cursor-crosshair' : ''}`}
      style={{ minHeight: '100%', height: '100%', width: '100%', margin: 0, padding: 0 }}
      zoomControl={false}
      attributionControl={false}
      worldCopyJump
      maxBounds={WORLD_BOUNDS}
      maxBoundsViscosity={1}
    >
      <ZoomControl position="bottomleft" />
      <ViewportMinZoomClamp />
      <MapInvalidateOnViewportChange />
      {mapPickActive && onMapPick ? (
        <MapPickHandler active={mapPickActive} onPick={onMapPick} />
      ) : null}
      <TileLayer key={tileUrl} attribution="" url={tileUrl} />
      <MapCameraController
        userLat={center[0]}
        userLng={center[1]}
        locationStatus={locationStatus}
        locateRequestId={locateRequestId}
      />
      <FlyToSpot target={flyToSpot} />
      <HeatmapLayer
        points={heatPoints}
        visible={showHeatLayer}
        mapTheme={mapTheme}
      />
      <CircleMarker
        center={center}
        radius={9}
        pathOptions={{
          color: '#93c5fd',
          weight: 2,
          fillColor: '#3b82f6',
          fillOpacity: 0.85,
        }}
      />
      <SpotMarkers
        spots={spots}
        selectedSpotId={selectedSpotId}
        onSelectSpot={onSelectSpot}
        markersInteractive={!mapPickActive}
        mapTheme={mapTheme}
        recencyTick={recencyTick}
      />
    </MapContainer>
  )
}
