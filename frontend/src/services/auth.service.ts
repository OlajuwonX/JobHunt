/**
 * Auth Service (src/services/auth.service.ts)
 *
 * All API calls related to authentication.
 * These functions are used by TanStack Query hooks — never called directly
 * from components.
 *
 * SECURITY NOTE:
 *   No secrets or tokens are constructed here.
 *   The api client (src/lib/api.ts) handles token attachment automatically.
 *   The backend sets/clears HttpOnly cookies — we never touch them directly.
 */

import { api } from '../lib/api'
import type { LoginResponse, RefreshResponse, User } from '../types'

// ─── Register ─────────────────────────────────────────────────────────────────

export interface RegisterInput {
  email: string
  password: string
  confirmPassword: string
  website?: string // honeypot — always send as empty string ''
}

export const registerUser = async (input: RegisterInput): Promise<{ message: string }> => {
  const res = await api.post<{ data: { message: string } }>('/auth/register', {
    ...input,
    website: '', // honeypot always empty for real users
  })
  return res.data.data
}

// ─── Login ────────────────────────────────────────────────────────────────────

export interface LoginInput {
  email: string
  password: string
}

export const loginUser = async (input: LoginInput): Promise<LoginResponse> => {
  const res = await api.post<{ data: LoginResponse }>('/auth/login', {
    ...input,
    website: '', // honeypot always empty for real users
  })
  return res.data.data
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export const logoutUser = async (): Promise<void> => {
  await api.post('/auth/logout')
  // Backend clears the HttpOnly refresh_token cookie and csrf_token cookie
}

// ─── Refresh ──────────────────────────────────────────────────────────────────

export const refreshSession = async (): Promise<RefreshResponse> => {
  // The HttpOnly refresh_token cookie is sent automatically by the browser.
  // The api interceptor attaches the CSRF token from the csrf_token cookie.
  const res = await api.post<{ data: RefreshResponse }>('/auth/refresh')
  return res.data.data
}

// ─── Verify Email ─────────────────────────────────────────────────────────────

export const verifyEmail = async (token: string): Promise<{ message: string }> => {
  const res = await api.get<{ data: { message: string } }>(`/auth/verify/${token}`)
  return res.data.data
}

// ─── Get Current User ─────────────────────────────────────────────────────────

export const getMe = async (): Promise<User> => {
  const res = await api.get<{ data: { user: User } }>('/auth/me')
  return res.data.data.user
}

// ─── Get CSRF Token ───────────────────────────────────────────────────────────

export const initCsrf = async (): Promise<void> => {
  // Just calling this endpoint sets the csrf_token cookie on the browser.
  // We don't need to handle the response — the api interceptor reads the cookie.
  await api.get('/auth/csrf-token')
}
