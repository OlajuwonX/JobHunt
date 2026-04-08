'use client'

/**
 * ThemeProvider (src/components/providers/ThemeProvider.tsx)
 *
 * Wraps the app with next-themes for dark/light mode.
 * Reads system preference on first load.
 * Allows manual toggle that persists in localStorage.
 *
 * USAGE in components:
 *   const { theme, setTheme } = useTheme()
 *   setTheme('dark')   // or 'light' or 'system'
 */

import { ThemeProvider as NextThemesProvider } from 'next-themes'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class" // adds class="dark" to <html> element
      defaultTheme="system" // respects OS preference on first visit
      enableSystem // allows "system" as a theme option
      disableTransitionOnChange // prevents flash during theme switch
    >
      {children}
    </NextThemesProvider>
  )
}
