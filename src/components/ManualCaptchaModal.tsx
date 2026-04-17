import { useEffect, useRef, useState } from 'react'

import { ensureRecaptchaReady, getManualSiteKey } from '@/lib/recaptcha'

type ManualCaptchaModalProps = {
  open: boolean
  onSolved: (token: string) => void
  onClose: () => void
}

export function ManualCaptchaModal({
  open,
  onSolved,
  onClose,
}: ManualCaptchaModalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const siteKey = getManualSiteKey()

  useEffect(() => {
    if (!open || !siteKey) return
    let cancelled = false
    void ensureRecaptchaReady()
      .then(() => {
        if (!cancelled) setReady(true)
      })
      .catch(() => {
        if (!cancelled) setError('Could not load verification challenge.')
      })
    return () => {
      cancelled = true
    }
  }, [open, siteKey])

  useEffect(() => {
    if (!open || !ready || !containerRef.current || !window.grecaptcha || !siteKey) return
    containerRef.current.innerHTML = ''
    window.grecaptcha.render(containerRef.current, {
      sitekey: siteKey,
      callback: (token: string) => onSolved(token),
      'error-callback': () => setError('Challenge failed. Please retry.'),
      'expired-callback': () => setError('Challenge expired. Please retry.'),
    })
  }, [open, ready, onSolved, siteKey])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[12050] flex items-center justify-center bg-black/65 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface-800 p-4 shadow-xl">
        <p className="text-sm font-semibold text-foreground">Human verification required</p>
        <p className="mt-1 text-xs text-muted">
          Complete this challenge to continue your request.
        </p>
        {siteKey ? (
          <div ref={containerRef} className="mt-3 min-h-20" />
        ) : (
          <p className="mt-3 text-xs text-red-400">
            Missing manual reCAPTCHA site key in frontend env.
          </p>
        )}
        {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg border border-border px-3 py-2 text-xs text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
