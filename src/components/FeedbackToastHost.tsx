import { useAppState } from '@/hooks/useAppState'

export function FeedbackToastHost() {
  const { feedbackToast } = useAppState()

  if (!feedbackToast) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(5.75rem,calc(env(safe-area-inset-bottom)+4.5rem))] z-[12000] flex justify-center px-4">
      <div className="rounded-full border border-border/60 bg-surface-800/90 px-4 py-2 text-xs text-foreground/90 backdrop-blur-md">
        {feedbackToast.message}
      </div>
    </div>
  )
}
