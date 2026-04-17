import { useEffect } from 'react'
import L from 'leaflet'
import { useMap } from 'react-leaflet'
import 'leaflet.heat'

import type { MapTheme } from '@/lib/spotPinHtml'

type HeatmapLayerProps = {
  points: [number, number, number][]
  visible: boolean
  mapTheme: MapTheme
}

export function HeatmapLayer({ points, visible, mapTheme }: HeatmapLayerProps) {
  const map = useMap()

  useEffect(() => {
    if (!visible || points.length === 0) return

    const isLight = mapTheme === 'light'
    const layer = L.heatLayer(points, {
      radius: isLight ? 28 : 32,
      blur: isLight ? 22 : 26,
      max: isLight ? 0.45 : 0.55,
      maxZoom: 18,
      minOpacity: isLight ? 0.05 : 0.08,
      gradient: isLight
        ? {
            0.0: 'rgba(235,232,226,0)',
            0.45: 'rgba(201,160,61,0.1)',
            0.75: 'rgba(201,160,61,0.18)',
            1.0: 'rgba(168,130,40,0.24)',
          }
        : {
            0.0: 'rgba(15,15,15,0)',
            0.4: 'rgba(245,199,107,0.12)',
            0.7: 'rgba(245,199,107,0.22)',
            1.0: 'rgba(201,160,86,0.3)',
          },
    })
    layer.addTo(map)
    return () => {
      map.removeLayer(layer)
    }
  }, [map, points, visible, mapTheme])

  return null
}
