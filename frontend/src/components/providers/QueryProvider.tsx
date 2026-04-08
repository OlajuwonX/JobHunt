'use client'

/**
 * QueryProvider (src/components/providers/QueryProvider.tsx)
 *
 * Wraps the app with TanStack Query's context.
 * Every component inside can use useQuery, useMutation, etc.
 *
 * WHY 'use client'?
 *   Next.js App Router runs components on the SERVER by default.
 *   Providers with state (like QueryClient) must run on the CLIENT.
 *   'use client' tells Next.js: "render this in the browser".
 *
 * WHY useState FOR queryClient?
 *   Creating it outside useState would share one client across all users
 *   in server-side rendering — a security risk. useState ensures each
 *   browser session gets its own isolated cache.
 */

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data is considered fresh for 1 minute — won't refetch if already loaded
            staleTime: 60 * 1000,
            // Retry failed requests once before showing an error
            retry: 1,
            // Refetch when the user returns to the tab (catches stale data)
            refetchOnWindowFocus: true,
          },
          mutations: {
            // Don't retry failed mutations — they have side effects
            retry: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* DevTools only visible in development — not included in production build */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
