import { apiFetch } from '@/lib/api/client'

export type DeviceProfileDto = {
  device_id: string
  username: string
  karma: number
  trust_score?: number
  /** Signed token for Authorization: Bearer (preferred over raw device id). */
  access_token?: string
}

export type CaptchaPayload = {
  recaptchaToken?: string
  recaptchaManualToken?: string
}

export type SpotNoteRowDto = {
  text: string
  created_at: string
}

export type SpotRowDto = {
  id: string
  name: string | null
  latitude: number
  longitude: number
  open_votes: number
  not_sure_votes: number
  weighted_score: number
  activity_score: number
  last_confirmed_at: string | null
  is_own_spot: boolean
  tags: string[]
  notes: SpotNoteRowDto[]
  usual_open_until?: string | null
  timing_confidence?: number
  timing_label?: string | null
  is_likely_open_now?: boolean
  is_likely_open?: boolean
}

export type SpotTimingAggregateDto = {
  usual_open_until: string | null
  timing_confidence: number
  timing_label: string | null
  is_likely_open_now: boolean
  /** When false, server kept your previous timing (rate limit on changing value). */
  timing_update_accepted?: boolean
  detail?: string
}

export type SpotListResponseDto = {
  area_signal: 'HOT' | 'ACTIVE' | 'DEAD'
  results: SpotRowDto[]
}

export function identifyDevice(
  deviceId: string,
  username: string,
): Promise<DeviceProfileDto> {
  return apiFetch<DeviceProfileDto>('/device/identify', {
    method: 'POST',
    omitDeviceId: true,
    body: JSON.stringify({
      device_id: deviceId,
      username,
    }),
  })
}

export function getDevice(deviceId: string): Promise<DeviceProfileDto> {
  return apiFetch<DeviceProfileDto>('/auth/device', {
    method: 'GET',
    deviceId,
  })
}

export type ListSpotsParams = {
  deviceId: string
  /** Omit lat, lng, and radiusM together to list all spots (worldwide). */
  lat?: number
  lng?: number
  radiusM?: number
}

function toQuery(p: ListSpotsParams): string {
  const q = new URLSearchParams()
  if (p.lat !== undefined) q.set('lat', String(p.lat))
  if (p.lng !== undefined) q.set('lng', String(p.lng))
  if (p.radiusM !== undefined) q.set('radiusM', String(p.radiusM))
  q.set('includeMine', 'true')
  const s = q.toString()
  return s ? `?${s}` : ''
}

export function listSpots(p: ListSpotsParams): Promise<SpotListResponseDto> {
  return apiFetch<SpotListResponseDto>(`/spots${toQuery(p)}`, {
    method: 'GET',
    deviceId: p.deviceId,
  })
}

export function createSpot(
  deviceId: string,
  body: {
    name?: string
    latitude: number
    longitude: number
    tags: string[]
  },
  captcha?: CaptchaPayload,
): Promise<SpotRowDto> {
  return apiFetch<SpotRowDto>('/spots', {
    method: 'POST',
    deviceId,
    body: JSON.stringify({
      ...body,
      recaptcha_token: captcha?.recaptchaToken ?? '',
      recaptcha_manual_token: captcha?.recaptchaManualToken ?? '',
    }),
  })
}

export function voteOpen(
  deviceId: string,
  spotId: string,
  captcha?: CaptchaPayload,
): Promise<SpotRowDto> {
  return apiFetch<SpotRowDto>(`/spots/${spotId}/vote/open`, {
    method: 'POST',
    deviceId,
    body: JSON.stringify({
      recaptcha_token: captcha?.recaptchaToken ?? '',
      recaptcha_manual_token: captcha?.recaptchaManualToken ?? '',
    }),
  })
}

export function voteNotSure(
  deviceId: string,
  spotId: string,
  captcha?: CaptchaPayload,
): Promise<SpotRowDto> {
  return apiFetch<SpotRowDto>(`/spots/${spotId}/vote/not-sure`, {
    method: 'POST',
    deviceId,
    body: JSON.stringify({
      recaptcha_token: captcha?.recaptchaToken ?? '',
      recaptcha_manual_token: captcha?.recaptchaManualToken ?? '',
    }),
  })
}

export function addNote(
  deviceId: string,
  spotId: string,
  text: string,
  captcha?: CaptchaPayload,
): Promise<{ status: string }> {
  return apiFetch<{ status: string }>(`/spots/${spotId}/notes`, {
    method: 'POST',
    deviceId,
    body: JSON.stringify({
      text,
      recaptcha_token: captcha?.recaptchaToken ?? '',
      recaptcha_manual_token: captcha?.recaptchaManualToken ?? '',
    }),
  })
}

export function appendSpotTag(
  deviceId: string,
  spotId: string,
  tag: string,
  captcha?: CaptchaPayload,
): Promise<SpotRowDto> {
  return apiFetch<SpotRowDto>(`/spots/${spotId}/tags`, {
    method: 'POST',
    deviceId,
    body: JSON.stringify({
      tag,
      recaptcha_token: captcha?.recaptchaToken ?? '',
      recaptcha_manual_token: captcha?.recaptchaManualToken ?? '',
    }),
  })
}

export function submitSpotTiming(
  deviceId: string,
  spotId: string,
  usualOpenUntil: string,
  captcha?: CaptchaPayload,
): Promise<SpotTimingAggregateDto> {
  return apiFetch<SpotTimingAggregateDto>(`/spots/${spotId}/timing`, {
    method: 'POST',
    deviceId,
    body: JSON.stringify({
      usual_open_until: usualOpenUntil,
      recaptcha_token: captcha?.recaptchaToken ?? '',
      recaptcha_manual_token: captcha?.recaptchaManualToken ?? '',
    }),
  })
}

export function postEngagement(
  deviceId: string,
  type: string,
  metadata: Record<string, unknown>,
  captcha?: CaptchaPayload,
): Promise<{ eligible_for_notification: boolean }> {
  return apiFetch<{ eligible_for_notification: boolean }>(
    '/events/engagement',
    {
      method: 'POST',
      deviceId,
      body: JSON.stringify({
        type,
        metadata,
        recaptcha_token: captcha?.recaptchaToken ?? '',
        recaptcha_manual_token: captcha?.recaptchaManualToken ?? '',
      }),
    },
  )
}
