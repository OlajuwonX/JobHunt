/**
 * Check Email Page (src/app/auth/check-email/page.tsx)
 *
 * Shown after successful registration.
 * Tells the user to go check their inbox.
 * Pure server component — no interactivity needed.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { MailCheck } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Check Your Email — JobHunt',
}

export default function CheckEmailPage() {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        <MailCheck className="h-7 w-7 text-primary" />
      </div>
      <h1 className="text-xl font-semibold text-foreground">Check your email</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        We&apos;ve sent a verification link to your inbox. Click it to activate your account.
      </p>
      <p className="mt-4 text-xs text-muted-foreground">
        The link expires in 24 hours. Didn&apos;t receive it? Check your spam folder.
      </p>
      <Link href="/auth/login" className="mt-6 text-sm font-medium text-primary hover:underline">
        Back to sign in
      </Link>
    </div>
  )
}
