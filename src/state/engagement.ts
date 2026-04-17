const STORAGE_KEY = 'mms-engagement-v1'
const DAILY_NOTIFICATION_LIMIT = 3
const RECENT_ACTIVITY_WINDOW_MS = 1000 * 60 * 60 * 48
const USERNAME_RE = /^[a-z0-9_]{3,20}$/

type NotificationBudget = {
  dayKey: string
  used: number
}

type EngagementStore = {
  deviceId: string
  username: string | null
  karma: number
  lastActiveAt: number
  notificationBudget: NotificationBudget
}

export type EngagementEventType =
  | 'spot_added_nearby'
  | 'spot_confirmed_nearby'
  | 'area_activity_spike'

export type EngagementEvent = {
  type: EngagementEventType
  spotId?: string
  lat?: number
  lng?: number
  createdAt: number
  eligibleForNotification: boolean
}

type EngagementListener = (event: EngagementEvent) => void

type RemoteEngagementPoster = (
  type: EngagementEventType,
  metadata: Record<string, unknown>,
) => void

const listeners = new Set<EngagementListener>()

let remoteEngagementPoster: RemoteEngagementPoster | null = null

/** Drop noisy duplicate remote posts (e.g. double vote taps) while keeping local listeners. */
const recentRemoteSent = new Map<string, number>()
const REMOTE_DEDUPE_MS = 45_000

function shouldSendRemotePost(
  type: EngagementEventType,
  metadata: Record<string, unknown>,
): boolean {
  const spotId = metadata.spotId
  if (spotId === undefined || spotId === '') return true
  const key = `${type}:${String(spotId)}`
  const now = Date.now()
  const last = recentRemoteSent.get(key) ?? 0
  if (now - last < REMOTE_DEDUPE_MS) return false
  recentRemoteSent.set(key, now)
  if (recentRemoteSent.size > 200) {
    for (const [k, t] of recentRemoteSent) {
      if (now - t > REMOTE_DEDUPE_MS * 3) recentRemoteSent.delete(k)
    }
  }
  return true
}

export function setRemoteEngagementPoster(fn: RemoteEngagementPoster | null): void {
  remoteEngagementPoster = fn
}

function dayKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`
}

function generateDeviceId(): string {
  const rand = Math.random().toString(36).slice(2, 10)
  return `mms-${Date.now().toString(36)}-${rand}`
}

function normalizeDeviceId(value: unknown): string {
  if (typeof value !== 'string') return generateDeviceId()
  const trimmed = value.trim()
  if (!trimmed) return generateDeviceId()
  if (trimmed.length > 255) return generateDeviceId()
  return trimmed
}

function normalizeUsernameValue(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (!USERNAME_RE.test(normalized)) return null
  return normalized
}

function readStore(): EngagementStore {
  if (typeof window === 'undefined') {
    const now = Date.now()
    return {
      deviceId: generateDeviceId(),
      username: null,
      karma: 0,
      lastActiveAt: now,
      notificationBudget: { dayKey: dayKey(now), used: 0 },
    }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) throw new Error('missing store')
    const parsed = JSON.parse(raw) as Partial<EngagementStore>
    const now = Date.now()
    return {
      deviceId: normalizeDeviceId(parsed.deviceId),
      username: normalizeUsernameValue(parsed.username),
      karma: typeof parsed.karma === 'number' ? parsed.karma : 0,
      lastActiveAt:
        typeof parsed.lastActiveAt === 'number' ? parsed.lastActiveAt : now,
      notificationBudget:
        parsed.notificationBudget &&
        typeof parsed.notificationBudget.dayKey === 'string' &&
        typeof parsed.notificationBudget.used === 'number'
          ? parsed.notificationBudget
          : { dayKey: dayKey(now), used: 0 },
    }
  } catch {
    const now = Date.now()
    return {
      deviceId: generateDeviceId(),
      username: null,
      karma: 0,
      lastActiveAt: now,
      notificationBudget: { dayKey: dayKey(now), used: 0 },
    }
  }
}

function writeStore(store: EngagementStore) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

function resetBudgetIfNewDay(store: EngagementStore, now: number): EngagementStore {
  const key = dayKey(now)
  if (store.notificationBudget.dayKey === key) return store
  return {
    ...store,
    notificationBudget: {
      dayKey: key,
      used: 0,
    },
  }
}

let storeCache: EngagementStore | null = null

function getStore(): EngagementStore {
  if (!storeCache) {
    storeCache = readStore()
    writeStore(storeCache)
  }
  return storeCache
}

function updateStore(updater: (prev: EngagementStore) => EngagementStore): EngagementStore {
  const next = updater(getStore())
  storeCache = next
  writeStore(next)
  return next
}

export function getDeviceId(): string {
  return getStore().deviceId
}

export function resetDeviceId(): string {
  const nextId = generateDeviceId()
  updateStore((prev) => ({
    ...prev,
    deviceId: nextId,
    username: null,
    lastActiveAt: Date.now(),
  }))
  return nextId
}

export function getUsername(): string | null {
  return normalizeUsernameValue(getStore().username)
}

export function setUsername(username: string): void {
  const normalized = normalizeUsernameValue(username)
  if (!normalized) return
  updateStore((prev) => ({
    ...prev,
    username: normalized,
    lastActiveAt: Date.now(),
  }))
}

export function getKarma(): number {
  return getStore().karma
}

export function recordActivity(now = Date.now()): void {
  updateStore((prev) => ({ ...prev, lastActiveAt: now }))
}

export function addKarma(delta: number): number {
  const next = updateStore((prev) => ({
    ...prev,
    karma: Math.max(0, prev.karma + delta),
    lastActiveAt: Date.now(),
  }))
  return next.karma
}

/** Overwrite local karma from Django after register / sync. */
export function syncDeviceFromServer(karma: number, username?: string): void {
  const normalized = username === undefined ? undefined : normalizeUsernameValue(username)
  updateStore((prev) => ({
    ...prev,
    username: normalized ?? prev.username,
    karma: Math.max(0, Math.round(karma)),
    lastActiveAt: Date.now(),
  }))
}

export function getOpenVoteWeight(karma = getKarma()): number {
  if (karma >= 180) return 3
  if (karma >= 70) return 2
  return 1
}

export function getNotSureWeight(karma = getKarma()): number {
  return karma >= 220 ? 2 : 1
}

export function getCreatorTrustBoost(karma = getKarma()): number {
  if (karma >= 220) return 0.2
  if (karma >= 80) return 0.1
  return 0.04
}

export function emitEngagementEvent(
  input: Omit<EngagementEvent, 'createdAt' | 'eligibleForNotification'>,
): EngagementEvent {
  const now = Date.now()
  let eligible = false
  updateStore((prev) => {
    const withBudget = resetBudgetIfNewDay(prev, now)
    const activeRecently =
      now - withBudget.lastActiveAt <= RECENT_ACTIVITY_WINDOW_MS
    eligible =
      activeRecently && withBudget.notificationBudget.used < DAILY_NOTIFICATION_LIMIT
    return {
      ...withBudget,
      lastActiveAt: now,
      notificationBudget: eligible
        ? {
            ...withBudget.notificationBudget,
            used: withBudget.notificationBudget.used + 1,
          }
        : withBudget.notificationBudget,
    }
  })

  const event: EngagementEvent = {
    ...input,
    createdAt: now,
    eligibleForNotification: eligible,
  }
  listeners.forEach((fn) => fn(event))

  if (remoteEngagementPoster) {
    const meta: Record<string, unknown> = {}
    if (input.spotId !== undefined) meta.spotId = input.spotId
    if (input.lat !== undefined) meta.lat = input.lat
    if (input.lng !== undefined) meta.lng = input.lng
    if (!shouldSendRemotePost(input.type, meta)) {
      return event
    }
    try {
      remoteEngagementPoster(input.type, meta)
    } catch {
      /* non-fatal */
    }
  }

  return event
}

export function subscribeEngagementEvents(listener: EngagementListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
