/**
 * Axios API client (src/lib/api.ts)
 *
 * Central HTTP client for all API calls.
 *
 * SECURITY — what this file handles:
 *   1. Attaches the access token (from Zustand memory store) as Bearer header
 *   2. Attaches the CSRF token (from cookie) as X-CSRF-Token header on mutations
 *   3. Sends cookies automatically (credentials: 'include') for the refresh token
 *   4. On 401 from any request → attempts one silent token refresh
 *   5. If refresh also fails → clears auth state and redirects to /auth/login
 *
 * ENV VARIABLES:
 *   NEXT_PUBLIC_API_URL — the backend URL exposed to the browser.
 *   "NEXT_PUBLIC_" prefix is required by Next.js to include env vars in
 *   the client bundle. It is NOT a secret — it's just the API URL.
 */

import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import Cookies from 'js-cookie'
import { useAuthStore } from '../store/auth.store'
import type { User } from '../types'

const API_URL = process.env.NEXT_PUBLIC_API_URL

if (!API_URL) {
  throw new Error('NEXT_PUBLIC_API_URL is not defined. Check your .env.local file.')
}

// ─── Create Axios Instance ─────────────────────────────────────────────────────

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  withCredentials: true, // sends HttpOnly refresh_token cookie automatically
  headers: { 'Content-Type': 'application/json' },
})

// ─── Request Interceptor ──────────────────────────────────────────────────────
// Attaches auth + CSRF tokens to every outgoing request automatically.

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Read access token directly from the Zustand store (not useState — no re-render)
  const accessToken = useAuthStore.getState().accessToken
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }

  // Attach CSRF token for state-changing requests
  const method = config.method?.toUpperCase()
  if (method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrfToken = Cookies.get('csrf_token')
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken
    }
  }

  return config
})

// ─── Response Interceptor ─────────────────────────────────────────────────────
// Silently refreshes the access token on 401 and retries the original request.

let isRefreshing = false
let failedQueue: Array<{
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
}> = []

const processQueue = (error: AxiosError | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error)
    else prom.resolve(token)
  })
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,

  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error)
    }

    // Don't refresh if the failing request IS the refresh endpoint
    if (originalRequest.url?.includes('/auth/refresh')) {
      useAuthStore.getState().clearAuth()
      if (typeof window !== 'undefined') window.location.href = '/auth/login'
      return Promise.reject(error)
    }

    // Queue concurrent requests while refresh is in progress
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return api(originalRequest)
        })
        .catch((err) => Promise.reject(err))
    }

    originalRequest._retry = true
    isRefreshing = true

    try {
      const csrfToken = Cookies.get('csrf_token')
      const response = await api.post<{ data: { accessToken: string; user: User } }>(
        '/auth/refresh',
        {},
        { headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {} }
      )

      const { accessToken, user } = response.data.data
      useAuthStore.getState().setAuth(accessToken, user)

      processQueue(null, accessToken)
      originalRequest.headers.Authorization = `Bearer ${accessToken}`
      return api(originalRequest)
    } catch (refreshError) {
      processQueue(refreshError as AxiosError, null)
      useAuthStore.getState().clearAuth()
      if (typeof window !== 'undefined') window.location.href = '/auth/login'
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  }
)
