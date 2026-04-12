import type { Metadata } from 'next'
import Image from 'next/image'

export const metadata: Metadata = {
  title: 'JobHunt — Auth',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#080d18] px-4 py-12"
      style={{
        backgroundImage: 'radial-gradient(circle, rgba(148,163,184,0.07) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_65%_55%_at_50%_50%,rgba(16,185,129,0.07),transparent)]" />

      <div className="relative z-10 w-full max-w-100">
        <div className="rounded bg-white px-8 py-10 shadow-[0_24px_60px_rgba(0,0,0,0.5)] ring-1 ring-white/5">
          <div className="mb-7 flex justify-center">
            <Image
              src="/jobhunt.png"
              alt="JobHunt"
              width={200}
              height={60}
              className="h-14 w-auto object-contain"
              priority
            />
          </div>

          {children}
        </div>

        <p className="mt-5 text-center text-xs text-slate-500">
          &copy; {new Date().getFullYear()} JobHunt. All rights reserved.
        </p>
      </div>
    </main>
  )
}
