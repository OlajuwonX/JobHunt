import type { Metadata } from 'next'
import Image from 'next/image'

export const metadata: Metadata = {
  title: 'JobHunt — Auth',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4">
      <div className="mb-4 flex items-center gap-2">
        <div className="relative h-28 w-45 rounded-xl bg-primary">
          <Image src="/favicon.png" alt="JobHunt Logo" fill className="object-contain p-3" />
        </div>
      </div>
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-sm">{children}</div>

      <p className="mt-6 text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} JobHunt. All rights reserved.
      </p>
    </main>
  )
}
