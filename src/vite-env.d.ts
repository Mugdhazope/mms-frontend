/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Demo seed data; must not be "true" in production. */
  readonly VITE_USE_SEED?: string
  readonly VITE_RECAPTCHA_SITE_KEY?: string
  readonly VITE_RECAPTCHA_MANUAL_SITE_KEY?: string
  /**
   * Optional absolute API origin (no trailing slash), e.g. https://api.example.com.
   * When unset, requests use same-origin `/api/v1` (typical behind nginx).
   */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
