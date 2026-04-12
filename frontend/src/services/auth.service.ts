import { api } from '../lib/api'
import type { LoginResponse, RefreshResponse, User } from '../types'

export interface RegisterInput {
  email: string
  password: string
  confirmPassword: string
  website?: string
}

export const registerUser = async (input: RegisterInput): Promise<{ message: string }> => {
  const res = await api.post<{ data: { message: string } }>('/auth/register', {
    ...input,
    website: '',
  })
  return res.data.data
}

export interface LoginInput {
  email: string
  password: string
}

export const loginUser = async (input: LoginInput): Promise<LoginResponse> => {
  const res = await api.post<{ data: LoginResponse }>('/auth/login', {
    ...input,
    website: '',
  })
  return res.data.data
}

export const logoutUser = async (): Promise<void> => {
  await api.post('/auth/logout')
}

export const refreshSession = async (): Promise<RefreshResponse> => {
  const res = await api.post<{ data: RefreshResponse }>('/auth/refresh')
  return res.data.data
}

export const verifyEmail = async (token: string): Promise<{ message: string }> => {
  const res = await api.get<{ data: { message: string } }>(`/auth/verify/${token}`)
  return res.data.data
}

export const getMe = async (): Promise<User> => {
  const res = await api.get<{ data: { user: User } }>('/auth/me')
  return res.data.data.user
}

export const initCsrf = async (): Promise<true> => {
  // We return `true` because TanStack Query requires a non-undefined return value.
  await api.get('/auth/csrf-token')
  return true
}

// All API calls related to authentication.
// These functions are used by TanStack Query hooks — never called directly from components.

// SECURITY NOTE:
// The HttpOnly refresh_token cookie is sent automatically by the browser.
// The api client (src/lib/api.ts) handles token attachment automatically.
// The backend sets/clears HttpOnly cookies, it is never touch them directly on the frontend.
// The api interceptor attaches the CSRF token from the csrf_token cookie.
