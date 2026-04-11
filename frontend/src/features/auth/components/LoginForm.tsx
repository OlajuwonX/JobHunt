'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
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
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="w-full max-w-sm"
    >
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to your JobHunt account.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute left-[-9999px] top-[-9999px] opacity-0"
          {...field('website' as never)}
        />
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            data-testid="login-email"
            className={cn(
              'w-full rounded-xl border bg-background px-3 py-2.5 text-sm',
              'placeholder:text-muted-foreground',
              'focus:outline-none focus:ring-2 focus:ring-ring',
              'transition-colors duration-150',
              errors.email && 'border-destructive focus:ring-destructive'
            )}
            {...field('email')}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              Password
            </label>
            <Link
              href="/auth/forgot-password"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Your password"
              data-testid="login-password"
              className={cn(
                'w-full rounded-xl border bg-background px-3 py-2.5 pr-10 text-sm',
                'placeholder:text-muted-foreground',
                'focus:outline-none focus:ring-2 focus:ring-ring',
                'transition-colors duration-150',
                errors.password && 'border-destructive focus:ring-destructive'
              )}
              {...field('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
            'w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground',
            'hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60',
            'flex items-center justify-center gap-2'
          )}
        >
          {isPending && <Loader2 size={16} className="animate-spin" />}
          {isPending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link href="/auth/register" className="font-medium text-primary hover:underline">
          Create one
        </Link>
      </p>
    </motion.div>
  )
}
