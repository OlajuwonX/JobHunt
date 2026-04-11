import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAuthStore } from '../../../store/auth.store'
import {
  loginUser,
  logoutUser,
  registerUser,
  getMe,
  initCsrf,
} from '../../../services/auth.service'
import type { LoginFormValues, RegisterFormValues } from '../schemas'

// Fetches and sets the CSRF token cookie on app load. Called once in the root layout.
export const useInitCsrf = () => {
  return useQuery({
    queryKey: ['csrf'],
    queryFn: initCsrf,
    staleTime: 25 * 60 * 1000,
    retry: 2,
  })
}


// only runs if the user might be authenticated (has a refresh token cookie). This re-hydrates auth state after a page refresh.
export const useCurrentUser = () => {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getMe,
    retry: false, // don't retry on 401 — user is just not logged in
    staleTime: 5 * 60 * 1000,
  })
}

export const useRegister = () => {
  const router = useRouter()

  return useMutation({
    mutationFn: (values: RegisterFormValues) =>
      registerUser({
        email: values.email,
        password: values.password,
        confirmPassword: values.confirmPassword,
        website: '',
      }),
    onSuccess: (data) => {
      toast.success(data.message)
      router.push('/auth/check-email')
    },
    onError: (error: { response?: { data?: { error?: string } } }) => {
      const message = error.response?.data?.error ?? 'Registration failed. Please try again.'
      toast.error(message)
    },
  })
}

export const useLogin = () => {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: LoginFormValues) => loginUser(values),
    onSuccess: (data) => {
      // store access token and user in memory
      setAuth(data.accessToken, data.user)
      // populate the React Query cache with user data
      queryClient.setQueryData(['auth', 'me'], data.user)
      toast.success(`Welcome back, ${data.user.email}`)
      router.push('/dashboard')
    },
    onError: (error: { response?: { data?: { error?: string } } }) => {
      const message = error.response?.data?.error ?? 'Login failed. Please try again.'
      toast.error(message)
    },
  })
}


export const useLogout = () => {
  const router = useRouter()
  const { clearAuth } = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: logoutUser,
    onSuccess: () => {
      clearAuth()
      queryClient.clear()
      toast.success('Logged out successfully')
      router.push('/auth/login')
    },
    onError: () => {
      // even if the API call fails, clear client-side state
      clearAuth()
      queryClient.clear()
      router.push('/auth/login')
    },
  })
}
