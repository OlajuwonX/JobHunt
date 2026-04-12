import Link from 'next/link'
import { ArrowRight, CheckCircle } from 'lucide-react'

const features = [
  'Jobs from Greenhouse, Lever, and more — in one place',
  'Deduplication: never see the same job twice',
  'ATS score: know your match before you apply',
  'Track every application from saved to offer',
  'Real-time alerts when new matching jobs appear',
]

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <span className="text-xs font-bold text-primary-foreground">J</span>
            </div>
            <span className="font-semibold text-foreground">JobHunt</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/auth/register"
              className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
        <div className="inline-flex items-center rounded-full border bg-muted px-3 py-1 text-xs text-muted-foreground mb-6">
          Now in early access
        </div>
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          All jobs. <span className="text-primary">One place.</span>
        </h1>
        <p className="mt-4 max-w-lg text-base text-muted-foreground">
          Stop jumping between job boards. JobHunt aggregates listings, removes duplicates, scores
          your resume, and tracks every application — automatically.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/auth/register"
            className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Create free account
            <ArrowRight size={16} />
          </Link>
          <Link
            href="/auth/login"
            className="rounded-xl border px-6 py-3 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Sign in
          </Link>
        </div>

        {/* Features */}
        <ul className="mt-12 space-y-3 text-left">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
              <CheckCircle size={16} className="mt-0.5 shrink-0 text-primary" />
              {feature}
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
