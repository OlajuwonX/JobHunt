import type { Metadata } from 'next'
import { LoginForm } from '../../../features/auth/components/LoginForm'

export const metadata: Metadata = {
  title: 'Sign In — JobHunt',
}

export default function LoginPage() {
  return <LoginForm />
}
