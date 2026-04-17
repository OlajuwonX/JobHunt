'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Briefcase, LayoutDashboard, User, Sun, Moon, LogOut, ChevronUp } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import { useLogout } from '@/features/auth/hooks/useAuth'

const NAV_ITEMS = [
  { href: '/dashboard/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/dashboard/applications', label: 'Applications', icon: LayoutDashboard, disabled: true },
  { href: '/dashboard/profile', label: 'Profile', icon: User, disabled: true },
]

interface DashboardSidebarProps {
  onNavClick?: () => void
}

export function DashboardSidebar({ onNavClick }: DashboardSidebarProps) {
  const pathname = usePathname()
  const user = useAuthStore((s) => s.user)
  const { mutate: logout, isPending } = useLogout()
  const { resolvedTheme, setTheme } = useTheme()
  const [profileOpen, setProfileOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    if (profileOpen) document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [profileOpen])

  const userInitial = user?.email?.[0]?.toUpperCase() ?? '?'

  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Logo area */}
      <div className="flex h-13 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-3.5">
        <Image
          src="/joblogo.webp"
          alt="JobHunt"
          width={26}
          height={26}
          className="rounded-md object-contain"
          priority
        />
        <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
          JOBHUNT
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href)
          const Icon = item.icon

          if (item.disabled) {
            return (
              <div
                key={item.href}
                title="Coming soon"
                className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-sidebar-foreground/30 cursor-not-allowed select-none"
              >
                <Icon className="size-4 shrink-0" />
                <span className="flex-1 text-sm">{item.label}</span>
                <span className="text-[10px] font-medium bg-muted/40 text-muted-foreground/50 rounded px-1.5 py-0.5">
                  Soon
                </span>
              </div>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Profile section at bottom */}
      <div className="shrink-0 border-t border-sidebar-border px-2 py-2" ref={popoverRef}>
        <button
          type="button"
          onClick={() => setProfileOpen((v) => !v)}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
            profileOpen
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
          )}
        >
          {/* User avatar */}
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
            {userInitial}
          </span>
          <span className="flex-1 truncate text-left text-xs font-medium">
            {user?.email ?? 'Account'}
          </span>
          <ChevronUp
            className={cn(
              'size-3.5 shrink-0 text-sidebar-foreground/40 transition-transform duration-200',
              !profileOpen && 'rotate-180'
            )}
          />
        </button>

        {/* Profile popover — slides up */}
        {profileOpen && (
          <div className="absolute bottom-full left-2 right-2 mb-1 z-50 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
            {/* Email header */}
            <div className="border-b border-border px-3 py-2.5">
              <p className="truncate text-xs font-semibold text-popover-foreground">
                {user?.email}
              </p>
              <p className="text-[11px] text-muted-foreground">Personal account</p>
            </div>

            {/* Theme toggle */}
            <button
              type="button"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-popover-foreground transition-colors hover:bg-accent"
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="size-4 shrink-0" />
              ) : (
                <Moon className="size-4 shrink-0" />
              )}
              <span>{resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
            </button>

            {/* Logout */}
            <button
              type="button"
              onClick={() => {
                setProfileOpen(false)
                logout()
              }}
              disabled={isPending}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
            >
              <LogOut className="size-4 shrink-0" />
              <span>{isPending ? 'Logging out...' : 'Log out'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
