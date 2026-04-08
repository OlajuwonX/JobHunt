/**
 * Login Page (src/app/auth/login/page.tsx)
 *
 * Server component that renders the client LoginForm.
 * Keeping the page itself as a server component means:
 *   - Metadata is resolved on the server (good for SEO)
 *   - The form component handles all client-side interactivity
 */

import type { Metadata } from 'next'
import { LoginForm } from '../../../features/auth/components/LoginForm'

export const metadata: Metadata = {
  title: 'Sign In — JobHunt',
}

export default function LoginPage() {
  return <LoginForm />
}
