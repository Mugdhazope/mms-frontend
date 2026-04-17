import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  ThemeStateContext,
  type ThemeMode,
} from '@/theme/ThemeStateContext'

const STORAGE_KEY = 'mms-theme'

function readStoredTheme(): ThemeMode | null {
  if (typeof window === 'undefined') return null
  const v = localStorage.getItem(STORAGE_KEY)
  if (v === 'light' || v === 'dark') return v
  return null
}

function systemPrefersLight(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: light)').matches
}

function getInitialResolved(): ThemeMode {
  if (typeof document !== 'undefined') {
    const d = document.documentElement.dataset.theme
    if (d === 'light' || d === 'dark') return d
  }
  const stored = readStoredTheme()
  if (stored) return stored
  return systemPrefersLight() ? 'light' : 'dark'
}

function applyDocumentTheme(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(getInitialResolved)

  useEffect(() => {
    applyDocumentTheme(theme)
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  )

  return (
    <ThemeStateContext.Provider value={value}>
      {children}
    </ThemeStateContext.Provider>
  )
}
