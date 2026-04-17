import { useState } from 'react'

import { getUsername } from '@/state/engagement'
import { AppStateProvider } from '@/state/AppStateProvider'
import { ThemeProvider } from '@/theme/ThemeProvider'

import { MapScreen } from './components/MapScreen'
import { FeedbackToastHost } from './components/FeedbackToastHost'
import { UsernameOnboardingScreen } from './components/UsernameOnboardingScreen'

export default function App() {
  const [username, setUsername] = useState<string | null>(() => getUsername())

  if (!username) {
    return (
      <ThemeProvider>
        <div className="main-container mms-viewport-fill overflow-hidden">
          <UsernameOnboardingScreen onIdentified={setUsername} />
        </div>
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider>
      <AppStateProvider>
        <div className="main-container mms-viewport-fill overflow-hidden">
          <MapScreen />
          <FeedbackToastHost />
          <div
            className="mms-visual-viewport-layer mms-grit-overlay"
            aria-hidden
          />
        </div>
      </AppStateProvider>
    </ThemeProvider>
  )
}
