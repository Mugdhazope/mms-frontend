import { useState } from 'react'

import suttaImg from '@/assets/sutta.png'
import { ApiError } from '@/lib/api/client'
import { identifyDevice } from '@/lib/api/mapmysutta'
import { getDeviceId, setUsername, syncDeviceFromServer } from '@/state/engagement'

import { ThemeToggle } from './ThemeToggle'

type UsernameOnboardingScreenProps = {
  onIdentified: (username: string) => void
}

export function UsernameOnboardingScreen({ onIdentified }: UsernameOnboardingScreenProps) {
  const [usernameDraft, setUsernameDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    const normalized = usernameDraft.trim().toLowerCase()
    if (!normalized) {
      setError('Please choose a username.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const profile = await identifyDevice(getDeviceId(), normalized)
      setUsername(profile.username)
      syncDeviceFromServer(profile.karma, profile.username)
      onIdentified(profile.username)
    } catch (e) {
      if (e instanceof ApiError && typeof e.body === 'object' && e.body !== null) {
        const code = 'code' in e.body ? String((e.body as { code: unknown }).code) : ''
        if (code === 'username_taken') {
          setError('That username is taken. Try another one.')
        } else if (code === 'too_many_attempts') {
          setError('Too many attempts. Please wait a bit.')
        } else {
          setError(e.message || 'Could not save username.')
        }
      } else {
        setError('Could not save username.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative isolate mms-viewport-fill flex h-full min-h-0 w-full flex-col items-center justify-center px-6 pt-[max(2rem,env(safe-area-inset-top,0px))] pb-[max(2rem,env(safe-area-inset-bottom,0px))]">
      <div
        aria-hidden
        className="pointer-events-none mms-visual-viewport-layer -z-10 bg-gradient-to-b from-surface-900 to-surface-800"
      />
      <div className="absolute right-[max(1rem,env(safe-area-inset-right,0px))] top-[max(0.75rem,env(safe-area-inset-top,0px))]">
        <ThemeToggle />
      </div>
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <img src={suttaImg} alt="" className="mb-8 h-24 w-auto object-contain" />
        <h1 className="font-logo text-3xl tracking-wide text-foreground">MapMySutta</h1>
        <p className="mt-2 text-sm text-muted">Cravings can hit anytime.</p>
        <p className="mt-1 text-xs leading-relaxed text-muted/90">
          Morning, afternoon, evening, or late night - smokers helping smokers find open spots, faster.
        </p>
        <p className="mt-4 text-sm text-muted">What should we call you?</p>
        <input
          value={usernameDraft}
          onChange={(e) => setUsernameDraft(e.target.value)}
          placeholder="mugdha"
          autoCapitalize="none"
          autoCorrect="off"
          className="mt-5 w-full rounded-xl border border-border bg-surface-900/80 px-4 py-3 text-base text-foreground placeholder:text-muted/60 outline-none ring-accent/30 focus:ring-2"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit()
          }}
        />
        {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
        <button
          type="button"
          disabled={submitting}
          onClick={() => void submit()}
          className="mt-5 min-h-[48px] w-full rounded-xl bg-accent px-6 font-medium text-on-accent shadow-[var(--mms-accent-glow-strong)] transition-transform enabled:active:scale-[0.98] disabled:opacity-50"
        >
          {submitting ? 'Saving...' : 'Continue'}
        </button>
      </div>
    </div>
  )
}
