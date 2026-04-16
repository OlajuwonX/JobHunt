import type { Metadata } from 'next'
import Image from 'next/image'

export const metadata: Metadata = {
  title: 'JobHunt — Auth',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12"
      style={{
        backgroundImage: 'radial-gradient(circle, rgba(148,163,184,0.07) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }}
    >
      <div className="relative z-10 w-full max-w-100">
        <div className="rounded bg-surface px-8 py-10 shadow-[0_24px_60px_rgba(0,0,0,0.5)] ring-1 ring-dp-border">
          <div className="mb-3 flex justify-center">
            <Image
              src="/joblogo.webp"
              alt="JobHunt"
              width={240}
              height={100}
              className="h-18 w-auto object-contain"
              priority
            />
          </div>
          {children}
        </div>

        <p className="mt-5 text-center text-xs text-dp-muted">
          &copy; {new Date().getFullYear()} JobHunt. All rights reserved.
        </p>
      </div>
    </main>
  )
}
