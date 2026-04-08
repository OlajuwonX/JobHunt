import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import { ThemeProvider } from '../components/providers/ThemeProvider'
import { QueryProvider } from '../components/providers/QueryProvider'
import { AuthProvider } from '../components/providers/AuthProvider'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'JobHunt — All jobs. One place.',
  description:
    'A unified job feed that removes fragmentation, tracks applications, and guides you toward better opportunities.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/*
       * suppressHydrationWarning on <html> is required by next-themes.
       * next-themes adds class="dark" or class="light" to <html> on the client.
       * Without this, React warns about a mismatch between server and client HTML.
       */}
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background font-sans antialiased`}
      >
        <ThemeProvider>
          <QueryProvider>
            <AuthProvider>
              {children}
              {/* Sonner toast notifications — renders at the top level */}
              <Toaster position="top-right" richColors closeButton />
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
