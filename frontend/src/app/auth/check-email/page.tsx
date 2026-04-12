import type { Metadata } from 'next'
import Link from 'next/link'
import { MailCheck } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Check Your Email — JobHunt',
}

export default function CheckEmailPage() {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50">
        <MailCheck className="h-6 w-6 text-emerald-600" />
      </div>
      <h1 className="text-lg font-semibold text-slate-900">Check your inbox</h1>
      <p className="mt-2 text-sm text-slate-500">
        We&apos;ve sent a verification link to your email address. Click it to activate your
        account.
      </p>
      <p className="mt-3 text-xs text-slate-400">
        Link expires in 24 hours. Didn&apos;t get it? Check your spam folder.
      </p>
      <Link
        href="/auth/login"
        className="mt-6 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
      >
        Back to sign in
      </Link>
    </div>
  )
}
