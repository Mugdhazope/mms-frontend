/**
 * Opens Google Maps with turn-by-turn directions to the destination.
 * Omitting origin lets the Maps app use the user's current location when available.
 */
export function openGoogleMapsDirections(destLat: number, destLng: number): void {
  const dest = `${destLat},${destLng}`
  const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

/** Opens Google Maps with a dropped pin at the coordinates (no route). */
export function openGoogleMapsPin(destLat: number, destLng: number): void {
  const q = `${destLat},${destLng}`
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
  window.open(url, '_blank', 'noopener,noreferrer')
}
