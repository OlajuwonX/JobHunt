import { create } from 'zustand'
import type { User } from '../types'

interface AuthState {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean

  // Called after successful login or token refresh. Stores the access token and user data in memory.
  setAuth: (accessToken: string, user: User) => void

  // Called on logout or when refresh fails.  Clears all in-memory auth state.
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,

  setAuth: (accessToken, user) =>
    set({
      accessToken,
      user,
      isAuthenticated: true,
    }),

  clearAuth: () =>
    set({
      accessToken: null,
      user: null,
      isAuthenticated: false,
    }),
}))

// SECURITY — where tokens live:
// accessToken → in this store (memory only, gone on page refresh)
// refreshToken → HttpOnly cookie (set by backend, JS can't read it)
// csrfToken    → readable cookie (set by backend, JS reads via js-cookie)
// The access token is intentionally lost on page refresh.
// The refresh interceptor in api.ts will silently fetch a new one
// using the HttpOnly refresh token cookie.
