import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Layers, FilterX, Target, ClipboardList, BellRing, Globe } from 'lucide-react'

const features = [
  {
    icon: Layers,
    title: 'One unified feed',
    description:
      'Jobs from Greenhouse, Lever, WeForkRemotely, and more — pulled into a single, clean list.',
  },
  {
    icon: FilterX,
    title: 'Zero duplicates',
    description:
      'The same role posted on three platforms shows up once. No noise, no scrolling past repeats.',
  },
  {
    icon: Target,
    title: 'ATS match score',
    description:
      'See how well your resume matches a job description before you spend time applying.',
  },
  {
    icon: ClipboardList,
    title: 'Application tracker',
    description:
      'From saved to offer — every application in one place, with statuses you actually control.',
  },
  {
    icon: BellRing,
    title: 'Real-time alerts',
    description:
      'Get notified the moment a new job matching your profile is posted. No manual searching.',
  },
  {
    icon: Globe,
    title: 'Nigerian platforms included',
    description:
      'Jobberman, NGCareers, and local boards alongside global listings in the same feed.',
  },
]

export default function HomePage() {
  return (
    <main
      className="min-h-screen bg-canvas text-foreground"
      style={{
        backgroundImage: 'radial-gradient(circle, rgba(148,163,184,0.07) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }}
    >
      <nav className="sticky top-0 z-10 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Image
            src="/joblogo.webp"
            alt="JobHunt"
            width={240}
            height={100}
            className="h-18 w-auto object-contain"
            priority
          />
          <div className="flex items-center gap-4">
            <Link
              href="/auth/login"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              href="/auth/register"
              className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg transition-colors hover:bg-brand-dim"
            >
              Get started
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-5xl px-6 pb-24 pt-20 text-center">
        <span className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand-subtle px-3 py-1 text-xs font-medium text-brand">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          Now in early access
        </span>

        <h1 className="mx-auto max-w-2xl text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
          Job hunting,
          <br />
          the smarter way.
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
          Stop jumping between job boards. JobHunt aggregates listings from every major platform,
          removes duplicates, scores your resume and tracks every application in one place.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/auth/register"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-7 py-3 text-sm font-semibold text-brand-fg transition-colors hover:bg-brand-dim sm:w-auto"
          >
            Create free account
            <ArrowRight size={15} />
          </Link>
          <Link
            href="/auth/login"
            className="flex w-full items-center justify-center rounded-lg border border-canvas-border px-7 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-brand/30 hover:text-foreground sm:w-auto"
          >
            Sign in
          </Link>
        </div>
      </section>

      <section className="border-t border-canvas-border">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="mb-14 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Everything your job search needs
            </h2>
            <p className="mt-2 text-muted-foreground">
              Built around one principle: clarity, control, continuity.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <div key={title}>
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-canvas-border bg-surface">
                  <Icon size={16} className="text-brand" />
                </div>
                <h3 className="mb-1 text-sm font-semibold text-foreground">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-canvas-border">
        <div className="mx-auto max-w-5xl px-6 py-20 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Ready to simplify your job search?
          </h2>
          <p className="mt-2 text-muted-foreground">Free to use. No credit card required.</p>
          <Link
            href="/auth/register"
            className="mt-7 inline-flex items-center gap-2 rounded-lg bg-brand px-7 py-3 text-sm font-semibold text-brand-fg transition-colors hover:bg-brand-dim"
          >
            Get started for free
            <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-canvas-border ">
        <div className="mx-auto flex max-w-5xl items-center justify-center px-6 py-8">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} JobHunt. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  )
}
