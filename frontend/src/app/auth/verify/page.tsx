'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { verifyEmail } from '../../../services/auth.service'

function VerifyContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')

  const { mutate, isPending, isSuccess, isError, error } = useMutation({
    mutationFn: () => {
      if (!token) throw new Error('No token provided')
      return verifyEmail(token)
    },
    onSuccess: () => {
      setTimeout(() => router.push('/auth/login'), 2000)
    },
  })

  useEffect(() => {
    if (token) mutate()
  }, [token, mutate])

  if (!token) {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/15">
          <XCircle className="h-6 w-6 text-destructive" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">Invalid link</h1>
        <p className="mt-2 text-sm text-dp-subtle">This verification link is missing a token.</p>
        <Link
          href="/auth/register"
          className="mt-5 text-sm font-medium text-brand hover:text-brand-dim transition-colors"
        >
          Create a new account
        </Link>
      </div>
    )
  }

  if (isPending) {
    return (
      <div className="flex flex-col items-center text-center">
        <Loader2 className="mb-4 h-10 w-10 animate-spin text-brand" />
        <h1 className="text-lg font-semibold text-foreground">Verifying your email…</h1>
        <p className="mt-2 text-sm text-dp-subtle">Just a moment.</p>
      </div>
    )
  }

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-subtle">
          <CheckCircle className="h-6 w-6 text-brand" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">Email verified!</h1>
        <p className="mt-2 text-sm text-dp-subtle">
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
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/15">
          <XCircle className="h-6 w-6 text-destructive" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">Verification failed</h1>
        <p className="mt-2 text-sm text-dp-subtle">{message}</p>
        <Link
          href="/auth/login"
          className="mt-5 text-sm font-medium text-brand hover:text-brand-dim transition-colors"
        >
          Back to sign in
        </Link>
      </div>
    )
  }

  return null
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center text-center">
          <Loader2 className="mb-4 h-10 w-10 animate-spin text-brand" />
          <h1 className="text-lg font-semibold text-foreground">Loading…</h1>
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  )
}
