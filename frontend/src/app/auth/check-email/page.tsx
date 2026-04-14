import type { Metadata } from 'next'
import Link from 'next/link'
import { MailCheck } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Check Your Email — JobHunt',
}

export default function CheckEmailPage() {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-subtle">
        <MailCheck className="h-6 w-6 text-brand" />
      </div>
      <h1 className="text-lg font-semibold text-foreground">Check your inbox</h1>
      <p className="mt-2 text-sm text-dp-subtle">
        We&apos;ve sent a verification link to your email address. Click it to activate your
        account.
      </p>
      <p className="mt-3 text-xs text-dp-muted">
        Link expires in 24 hours. Didn&apos;t get it? Check your spam folder.
      </p>
      <Link
        href="/auth/login"
        className="mt-6 text-sm font-medium text-brand hover:text-brand-dim transition-colors"
      >
        Back to sign in
      </Link>
    </div>
  )
}
