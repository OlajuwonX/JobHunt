'use client'

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
