'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Briefcase, LayoutDashboard, User, Sun, Moon, LogOut, ChevronDown } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import { useLogout } from '@/features/auth/hooks/useAuth'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: '/dashboard/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/dashboard/applications', label: 'Applications', icon: LayoutDashboard, disabled: true },
  { href: '/dashboard/profile', label: 'Profile', icon: User, disabled: true },
]

// ─── Profile Modal ────────────────────────────────────────────────────────────

function ProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useAuthStore((s) => s.user)
  const { mutate: logout, isPending } = useLogout()
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xs p-0 overflow-hidden" showCloseButton={false}>
        {/* Header — avatar + email */}
        <DialogHeader className="gap-0 border-b border-border px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
              {user?.email?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0">
              <DialogTitle className="truncate text-sm font-semibold">
                {user?.email ?? 'Account'}
              </DialogTitle>
              <p className="text-[11px] text-muted-foreground">Personal account</p>
            </div>
          </div>
        </DialogHeader>

        {/* Options */}
        <div className="py-1">
          {/* Theme toggle */}
          <button
            type="button"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-accent"
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <Moon className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span>{resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}</span>
          </button>

          <div className="my-1 h-px bg-border" />

          {/* Logout */}
          <button
            type="button"
            onClick={() => {
              onClose()
              logout()
            }}
            disabled={isPending}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-destructive transition-colors hover:bg-destructive/8 disabled:opacity-50"
          >
            <LogOut className="size-4 shrink-0" />
            <span>{isPending ? 'Logging out…' : 'Log out'}</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

interface DashboardSidebarProps {
  onNavClick?: () => void
}

export function DashboardSidebar({ onNavClick }: DashboardSidebarProps) {
  const pathname = usePathname()
  const user = useAuthStore((s) => s.user)
  const [profileOpen, setProfileOpen] = useState(false)

  const userInitial = user?.email?.[0]?.toUpperCase() ?? '?'

  return (
    <>
      <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
        {/* ── Workspace / logo header ───────────────────────────── */}
        <div
          className="flex h-11 shrink-0 items-center gap-2 border-b border-sidebar-border px-3"
          style={{ marginTop: 8 }}
        >
          <Image
            src="/joblogo.webp"
            alt="JobHunt"
            width={22}
            height={22}
            className="rounded-sm object-contain"
            priority
          />
          <span className="flex-1 truncate text-[13px] font-semibold tracking-tight">JOBHUNT</span>
          {/* Chevron hint — purely decorative, matches Linear's workspace button */}
          <ChevronDown className="size-3.5 text-sidebar-foreground/30" />
        </div>

        {/* ── Navigation ───────────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto px-1.5 py-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href)
            const Icon = item.icon

            if (item.disabled) {
              return (
                <div
                  key={item.href}
                  title="Coming soon"
                  className="flex h-7 items-center gap-2 rounded-md px-2 text-[13px] text-sidebar-foreground/30 cursor-not-allowed select-none"
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  <span className="text-[10px] font-medium bg-muted/30 rounded px-1.5 py-0.5">
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
                  'flex h-7 items-center gap-2 rounded-md px-2 text-[13px] font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* ── Profile button at bottom ─────────────────────────── */}
        <div className="shrink-0 border-t border-sidebar-border px-1.5 py-2">
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-[13px] transition-colors text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
              {userInitial}
            </span>
            <span className="flex-1 truncate text-left">{user?.email ?? 'Account'}</span>
          </button>
        </div>
      </div>

      {/* Profile modal — rendered outside the sidebar flow via Dialog portal */}
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  )
}
