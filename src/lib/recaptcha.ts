const RECAPTCHA_SCRIPT_ID = 'mms-recaptcha-script'
const RECAPTCHA_SRC = 'https://www.google.com/recaptcha/api.js?render=explicit'

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void
      execute: (
        siteKeyOrWidgetId: string | number,
        options?: { action?: string },
      ) => Promise<string>
      render: (
        container: HTMLElement | string,
        options: {
          sitekey: string
          theme?: 'light' | 'dark'
          callback?: (token: string) => void
          'error-callback'?: () => void
          'expired-callback'?: () => void
        },
      ) => number
      reset: (widgetId?: number) => void
    }
  }
}

const v3SiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY?.trim() ?? ''
const manualSiteKey =
  import.meta.env.VITE_RECAPTCHA_MANUAL_SITE_KEY?.trim() || v3SiteKey

function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.grecaptcha) return Promise.resolve()
  const existing = document.getElementById(RECAPTCHA_SCRIPT_ID) as
    | HTMLScriptElement
    | null
  if (existing) {
    return new Promise((resolve) => {
      existing.addEventListener('load', () => resolve(), { once: true })
      if (window.grecaptcha) resolve()
    })
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.id = RECAPTCHA_SCRIPT_ID
    s.async = true
    s.defer = true
    s.src = RECAPTCHA_SRC
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Could not load reCAPTCHA script'))
    document.head.appendChild(s)
  })
}

export function isRecaptchaConfigured(): boolean {
  return Boolean(v3SiteKey)
}

export async function executeRecaptchaV3(action: string): Promise<string> {
  if (!v3SiteKey) return ''
  await loadScript()
  if (!window.grecaptcha) return ''
  return new Promise((resolve, reject) => {
    window.grecaptcha?.ready(() => {
      window.grecaptcha
        ?.execute(v3SiteKey, { action })
        .then((token) => resolve(token))
        .catch((e) => reject(e))
    })
  })
}

export async function ensureRecaptchaReady(): Promise<void> {
  await loadScript()
}

export function getManualSiteKey(): string {
  return manualSiteKey
}
