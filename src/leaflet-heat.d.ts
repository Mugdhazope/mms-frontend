import type * as L from 'leaflet'

declare module 'leaflet' {
  function heatLayer(
    latlngs: [number, number, number?][],
    options?: {
      minOpacity?: number
      maxZoom?: number
      radius?: number
      blur?: number
      max?: number
      gradient?: Record<number, string>
    },
  ): L.Layer
}
