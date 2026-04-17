import { DashboardSidebar } from '@/components/DashboardSidebar'
import { MobileSidebarDrawer } from '@/components/MobileSidebarDrawer'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar — full height, fixed width */}
      <aside className="relative hidden lg:flex lg:w-56 lg:shrink-0 lg:flex-col border-r border-border">
        <DashboardSidebar />
      </aside>

      {/* Main content column */}
      <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
        {/* Mobile top bar + drawer (hidden on lg+) */}
        <MobileSidebarDrawer />

        {/* Page content — scrollable */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
