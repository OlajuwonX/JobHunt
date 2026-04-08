/**
 * Auth Store (src/store/auth.store.ts)
 *
 * Zustand store that holds all authentication state in memory.
 *
 * WHY ZUSTAND?
 *   Global state that multiple components need to read: is the user logged in?
 *   What's their name? Zustand gives any component access to this without
 *   prop drilling (passing data through many layers of components).
 *
 * SECURITY — where tokens live:
 *   accessToken → in this store (memory only, gone on page refresh)
 *   refreshToken → HttpOnly cookie (set by backend, JS can't read it)
 *   csrfToken    → readable cookie (set by backend, JS reads via js-cookie)
 *
 *   The access token is intentionally lost on page refresh.
 *   The refresh interceptor in api.ts will silently fetch a new one
 *   using the HttpOnly refresh token cookie.
 *
 * USAGE:
 *   const { user, isAuthenticated, accessToken } = useAuthStore()
 *   const { setAuth, clearAuth } = useAuthStore()
 */

import { create } from 'zustand'
import type { User } from '../types'

interface AuthState {
  // ── State ──────────────────────────────────────────────────────────────────
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean

  // ── Actions ────────────────────────────────────────────────────────────────
  /**
   * Called after successful login or token refresh.
   * Stores the access token and user data in memory.
   */
  setAuth: (accessToken: string, user: User) => void

  /**
   * Called on logout or when refresh fails.
   * Clears all in-memory auth state.
   * (Cookies are cleared by the backend — the logout endpoint does that)
   */
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  // ── Initial State ──────────────────────────────────────────────────────────
  user: null,
  accessToken: null,
  isAuthenticated: false,

  // ── Actions ────────────────────────────────────────────────────────────────
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
