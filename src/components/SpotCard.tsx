import { formatDistance } from '@/lib/format'
import type { Spot } from '@/types/spot'

type SpotCardProps = {
  spot: Spot
  distanceMeters: number
  isOwnSpot?: boolean
  onClick?: () => void
}

export function SpotCard({
  spot,
  distanceMeters,
  isOwnSpot = false,
  onClick,
}: SpotCardProps) {
  const title = spot.name ?? 'Unnamed spot'

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full min-h-[44px] items-center justify-between gap-3 rounded-xl border border-border bg-surface-900/80 px-4 py-3 text-left transition-colors active:scale-[0.99] hover:border-border hover:bg-foreground/5"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{title}</p>
        {isOwnSpot ? (
          <p className="mt-0.5 text-[11px] text-muted">You marked this</p>
        ) : null}
        <p className="mt-0.5 text-xs text-muted">
          {spot.openVotes} say it&apos;s open · {formatDistance(distanceMeters)} away
        </p>
        {spot.usualOpenUntil ? (
          <p className="mt-0.5 text-[11px] text-muted">
            Usually till ~{spot.usualOpenUntil}
            {spot.isLikelyOpenNow ? (
              <span className="text-accent"> · Likely open</span>
            ) : null}
          </p>
        ) : null}
      </div>
      <span className="shrink-0 text-xs text-accent/90" aria-hidden>
        →
      </span>
    </button>
  )
}
