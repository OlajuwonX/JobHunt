'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DashboardSidebar } from './DashboardSidebar'

export function MobileSidebarDrawer() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Mobile top strip — only visible on small screens */}
      <header className="lg:hidden flex h-13 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
        >
          <Menu className="size-4" />
        </Button>
        <Image
          src="/joblogo.webp"
          alt="JobHunt"
          width={22}
          height={22}
          className="rounded-md object-contain"
          priority
        />
        <span className="text-sm font-semibold tracking-tight">JOBHUNT</span>
      </header>

      {/* Overlay drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="relative z-50 w-56 shadow-xl">
            {/* Close button overlaid on the logo row */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 z-10 size-7"
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
            >
              <X className="size-4" />
            </Button>
            <div className="h-full">
              <DashboardSidebar onNavClick={() => setOpen(false)} />
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
