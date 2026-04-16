'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Briefcase, LayoutDashboard, User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  disabled?: boolean
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard/jobs',
    label: 'Jobs',
    icon: <Briefcase className="size-4" />,
  },
  {
    href: '/dashboard/applications',
    label: 'Applications',
    icon: <LayoutDashboard className="size-4" />,
    disabled: true,
  },
  {
    href: '/dashboard/profile',
    label: 'Profile',
    icon: <User className="size-4" />,
    disabled: true,
  },
]

interface DashboardSidebarProps {
  onNavClick?: () => void
}

export function DashboardSidebar({ onNavClick }: DashboardSidebarProps) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-1 p-3">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname.startsWith(item.href)

        if (item.disabled) {
          return (
            <div
              key={item.href}
              title="Coming soon"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground/50 cursor-not-allowed select-none"
            >
              {item.icon}
              <span>{item.label}</span>
              <span className="ml-auto text-xs font-medium bg-muted/50 text-muted-foreground/50 rounded px-1.5 py-0.5">
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
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {item.icon}
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
