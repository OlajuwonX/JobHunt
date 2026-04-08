/**
 * Auth Layout (src/app/auth/layout.tsx)
 *
 * Shared layout for all /auth/* pages (login, register, verify).
 * Centered card layout with the JobHunt brand mark.
 * Server component — no 'use client' needed.
 */

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'JobHunt — Auth',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4">
      {/* Brand mark */}
      <div className="mb-8 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <span className="text-sm font-bold text-primary-foreground">J</span>
        </div>
        <span className="text-lg font-semibold text-foreground">JobHunt</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-sm">{children}</div>

      <p className="mt-6 text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} JobHunt. All rights reserved.
      </p>
    </main>
  )
}
