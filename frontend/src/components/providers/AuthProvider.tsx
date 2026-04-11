'use client'

import { useEffect } from 'react'
import { useInitCsrf, useCurrentUser } from '../../features/auth/hooks/useAuth'
import { useAuthStore } from '../../store/auth.store'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setAuth } = useAuthStore()

  useInitCsrf()

  // try to restore auth state (uses refresh token cookie silently)
  const { data: user } = useCurrentUser()

  useEffect(() => {
    // if we got user data back, the silent refresh worked The api interceptor already set the access token in Zustand, but we set the user here too to make sure it's in sync
    if (user) {
      const accessToken = useAuthStore.getState().accessToken
      if (accessToken) {
        setAuth(accessToken, user)
      }
    }
  }, [user, setAuth])

  return <>{children}</>
}

// Initializes authentication state on every page load.
// WHAT IT DOES ON MOUNT:
// 1. Fetches a CSRF token (sets the csrf_token readable cookie)
// 2. Silently calls /auth/me — the api interceptor will:
//   a. See the request needs a Bearer token
//   b. Not have one (page just refreshed — access token was in memory)
//   c. Get a 401 response
//   d. Automatically call /auth/refresh using the HttpOnly cookie
//   e. Get a new access token and retry /auth/me
//   f. Set the user in Zustand
// This means: if the user has a valid refresh token cookie, they'll be re-authenticated transparently on every page load without needing to log in.
