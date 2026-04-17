import { useEffect, useState } from 'react'

import { DEFAULT_CENTER } from '@/data/spots'

export interface UserLocationState {
  lat: number
  lng: number
  status: 'pending' | 'ok' | 'fallback'
}

export function useUserLocation(): UserLocationState {
  const [state, setState] = useState<UserLocationState>({
    lat: DEFAULT_CENTER[0],
    lng: DEFAULT_CENTER[1],
    status: 'pending',
  })

  useEffect(() => {
    if (!navigator.geolocation) {
      queueMicrotask(() => {
        setState({
          lat: DEFAULT_CENTER[0],
          lng: DEFAULT_CENTER[1],
          status: 'fallback',
        })
      })
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        queueMicrotask(() => {
          setState({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            status: 'ok',
          })
        })
      },
      () => {
        queueMicrotask(() => {
          setState({
            lat: DEFAULT_CENTER[0],
            lng: DEFAULT_CENTER[1],
            status: 'fallback',
          })
        })
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    )
  }, [])

  return state
}
