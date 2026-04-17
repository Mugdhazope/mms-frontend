export type GeocodeResult = {
  lat: number
  lng: number
  label: string
}

type PhotonResponse = {
  features?: Array<{
    geometry: { coordinates: [number, number] }
    properties: {
      name?: string
      street?: string
      city?: string
      country?: string
      type?: string
    }
  }>
}

/**
 * Client-side place search via Photon (Komoot) — no API key, CORS-friendly.
 */
export async function searchPlaces(query: string): Promise<GeocodeResult[]> {
  const q = query.trim()
  if (q.length < 2) return []

  const url = new URL('https://photon.komoot.io/api/')
  url.searchParams.set('q', q)
  url.searchParams.set('limit', '8')

  const res = await fetch(url.toString())
  if (!res.ok) return []
  const data = (await res.json()) as PhotonResponse
  const features = data.features ?? []

  return features.map((f) => {
    const [lng, lat] = f.geometry.coordinates
    const p = f.properties
    const parts = [p.name, p.street, p.city, p.country].filter(Boolean)
    const label = parts.length > 0 ? parts.join(', ') : `${lat.toFixed(4)}, ${lng.toFixed(4)}`
    return { lat, lng, label }
  })
}
