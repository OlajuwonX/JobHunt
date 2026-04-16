import { DashboardSidebar } from '@/components/DashboardSidebar'
import { DashboardTopBar } from '@/components/DashboardTopBar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <DashboardTopBar />

      <div className="flex flex-1">
        <aside className="hidden lg:flex lg:w-56 lg:shrink-0 lg:flex-col border-r border-border">
          <DashboardSidebar />
        </aside>

        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  )
}
