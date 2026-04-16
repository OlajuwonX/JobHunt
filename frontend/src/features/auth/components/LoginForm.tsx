'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useLogin } from '../hooks/useAuth'
import { loginSchema, type LoginFormValues } from '../schemas'
import { cn } from '../../../lib/utils'

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false)
  const { mutate: login, isPending } = useLogin()

  const {
    register: field,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = (values: LoginFormValues) => {
    login(values)
  }

  return (
    <div className="w-full">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold text-foreground">Sign in</h1>
        <p className="mt-1 text-sm text-dp-subtle">
          Welcome back. Enter your credentials to continue.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute -left-2499.75 -top-2499.75 opacity-0"
          {...field('website' as never)}
        />

        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-medium text-dp-subtle">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            data-testid="login-email"
            className={cn(
              'w-full rounded-lg border border-dp-border bg-dp-input px-3.5 py-2.5 text-sm text-foreground',
              'placeholder:text-dp-muted transition-colors duration-150',
              'focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 focus:bg-dp-input-focus',
              errors.email &&
                'border-destructive focus:border-destructive focus:ring-destructive/20'
            )}
            {...field('email')}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-dp-subtle">
              Password
            </label>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Your password"
              data-testid="login-password"
              className={cn(
                'w-full rounded-lg border border-dp-border bg-dp-input px-3.5 py-2.5 pr-10 text-sm text-foreground',
                'placeholder:text-dp-muted transition-colors duration-150',
                'focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 focus:bg-dp-input-focus',
                errors.password &&
                  'border-destructive focus:border-destructive focus:ring-destructive/20'
              )}
              {...field('password')}
            />
            <div className="flex items-center justify-end mt-1">
              <Link
                href="/auth/forgot-password"
                className="text-xs text-brand hover:text-brand-dim transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-dp-muted transition-colors hover:text-dp-subtle"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isPending}
          data-testid="login-submit"
          className={cn(
            'mt-1 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5',
            'bg-brand text-sm font-semibold text-brand-fg',
            'hover:bg-brand-dim focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-surface',
            'transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60'
          )}
        >
          {isPending && <Loader2 size={16} className="animate-spin" />}
          {isPending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-dp-subtle">
        Don&apos;t have an account?{' '}
        <Link
          href="/auth/register"
          className="font-medium text-brand hover:text-brand-dim transition-colors"
        >
          Create one
        </Link>
      </p>
    </div>
  )
}
