'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Menu, X, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/features/jobs/components/ThemeToggle'
import { DashboardSidebar } from './DashboardSidebar'
import { useAuthStore } from '@/store/auth.store'
import { useLogout } from '@/features/auth/hooks/useAuth'

export function DashboardTopBar() {
  const user = useAuthStore((s) => s.user)
  const { mutate: logout, isPending } = useLogout()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/80 backdrop-blur-sm px-4">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setMobileNavOpen((v) => !v)}
          aria-label="Toggle navigation"
        >
          {mobileNavOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>

        <div className="mr-auto flex items-center gap-2">
          <Image
            src="/joblogo.webp"
            alt="JobHunt"
            width={120}
            height={40}
            className="h-12 w-auto object-contain"
            priority
          />
        </div>

        <div className="flex items-center gap-2">
          {user?.email && (
            <span className="hidden sm:block text-xs text-muted-foreground truncate max-w-45">
              {user.email}
            </span>
          )}
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => logout()}
            disabled={isPending}
            aria-label="Log out"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-30 flex">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative z-10 w-64 bg-background border-r border-border pt-14">
            <DashboardSidebar onNavClick={() => setMobileNavOpen(false)} />
          </aside>
        </div>
      )}
    </>
  )
}
