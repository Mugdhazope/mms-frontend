/**
 * Client-side limits aligned with backend
 * (`mapmysutta.core.limits`, `mapmysutta.core.api.serializers`).
 */
export const NOTE_TEXT_MAX_LENGTH = 1000
export const SPOT_NAME_MAX_LENGTH = 120

/** Same character class as backend `USERNAME_PATTERN` (length checked separately). */
export const USERNAME_PATTERN_RE = /^[a-z0-9_]{3,20}$/

export const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'support',
  'system',
  'root',
  'null',
  'undefined',
  'spam',
])

export function validateUsernameInput(raw: string): string | null {
  const normalized = raw.trim().toLowerCase()
  if (normalized.length < 3 || normalized.length > 20) {
    return 'Username must be between 3 and 20 characters.'
  }
  if (!USERNAME_PATTERN_RE.test(normalized)) {
    return 'Use lowercase letters, numbers, and underscore only.'
  }
  if (RESERVED_USERNAMES.has(normalized)) {
    return 'That username is not allowed.'
  }
  return null
}

export function isValidGeoCoords(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  )
}

export function validateSpotName(name: string | undefined): string | null {
  if (name === undefined || !name.trim()) return null
  const t = name.trim()
  if (t.length > SPOT_NAME_MAX_LENGTH) {
    return `Name must be at most ${SPOT_NAME_MAX_LENGTH} characters.`
  }
  if (/[\u0000-\u001f]/.test(t)) {
    return 'Name contains invalid characters.'
  }
  return null
}

export function validateNoteInput(text: string): string | null {
  const t = text.trim()
  if (!t) return 'Note cannot be empty.'
  if (t.length > NOTE_TEXT_MAX_LENGTH) {
    return `Notes can be at most ${NOTE_TEXT_MAX_LENGTH} characters.`
  }
  return null
}
