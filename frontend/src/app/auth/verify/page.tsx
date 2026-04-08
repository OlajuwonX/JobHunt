'use client'

/**
 * Verify Email Page (src/app/auth/verify/page.tsx)
 *
 * The verification link in the email points here:
 *   https://jobhunt.vercel.app/auth/verify?token=<token>
 *
 * On mount: reads ?token from the URL and calls the backend to activate the account.
 * Shows a loading state, then success or error.
 *
 * 'use client' because we need useSearchParams() to read the URL query param.
 */

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { verifyEmail } from '../../../services/auth.service'

export default function VerifyPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')

  const { mutate, isPending, isSuccess, isError, error } = useMutation({
    mutationFn: () => {
      if (!token) throw new Error('No token provided')
      return verifyEmail(token)
    },
    onSuccess: () => {
      // Redirect to login after 2 seconds
      setTimeout(() => router.push('/auth/login'), 2000)
    },
  })

  useEffect(() => {
    // Trigger verification as soon as we have a token
    if (token) mutate()
  }, [token, mutate])

  if (!token) {
    return (
      <div className="flex flex-col items-center text-center">
        <XCircle className="mb-4 h-12 w-12 text-destructive" />
        <h1 className="text-xl font-semibold">Invalid link</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This verification link is missing a token.
        </p>
        <Link
          href="/auth/register"
          className="mt-4 text-sm font-medium text-primary hover:underline"
        >
          Create a new account
        </Link>
      </div>
    )
  }

  if (isPending) {
    return (
      <div className="flex flex-col items-center text-center">
        <Loader2 className="mb-4 h-10 w-10 animate-spin text-primary" />
        <h1 className="text-xl font-semibold">Verifying your email…</h1>
        <p className="mt-2 text-sm text-muted-foreground">Just a moment.</p>
      </div>
    )
  }

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center text-center">
        <CheckCircle className="mb-4 h-12 w-12 text-green-500" />
        <h1 className="text-xl font-semibold">Email verified!</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account is active. Redirecting to sign in…
        </p>
      </div>
    )
  }

  if (isError) {
    const message =
      (error as { response?: { data?: { error?: string } } })?.response?.data?.error ??
      'This link may have expired or already been used.'

    return (
      <div className="flex flex-col items-center text-center">
        <XCircle className="mb-4 h-12 w-12 text-destructive" />
        <h1 className="text-xl font-semibold">Verification failed</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <Link href="/auth/login" className="mt-4 text-sm font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </div>
    )
  }

  return null
}
