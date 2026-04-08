'use client'

/**
 * RegisterForm (src/features/auth/components/RegisterForm.tsx)
 *
 * Handles the registration UI: form, validation, submission.
 * Uses TanStack Query mutation (via useRegister hook) for the API call.
 * Uses Zod for client-side validation before any network request is made.
 *
 * HONEYPOT: The `website` field is hidden with CSS. Real users never fill it.
 * Bots fill all fields. If `website` has a value, the backend silently ignores
 * the registration (returns fake success).
 */

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { useRegister } from '../hooks/useAuth'
import { registerSchema, type RegisterFormValues } from '../schemas'
import { cn } from '../../../lib/utils'

export function RegisterForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const { mutate: register, isPending } = useRegister()

  const {
    register: field,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = (values: RegisterFormValues) => {
    register(values)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="w-full max-w-sm"
    >
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Create account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Start your job search, the smart way.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* ── Honeypot (hidden from real users, traps bots) ──────────────── */}
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute left-[-9999px] top-[-9999px] opacity-0"
          {...field('website' as never)}
        />

        {/* ── Email ─────────────────────────────────────────────────────── */}
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            data-testid="register-email"
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

        {/* ── Password ──────────────────────────────────────────────────── */}
        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium text-foreground">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Min 8 chars, 1 uppercase, 1 number"
              data-testid="register-password"
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

        {/* ── Confirm Password ──────────────────────────────────────────── */}
        <div className="space-y-1">
          <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
            Confirm password
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Re-enter your password"
              data-testid="register-confirm"
              className={cn(
                'w-full rounded-xl border bg-background px-3 py-2.5 pr-10 text-sm',
                'placeholder:text-muted-foreground',
                'focus:outline-none focus:ring-2 focus:ring-ring',
                'transition-colors duration-150',
                errors.confirmPassword && 'border-destructive focus:ring-destructive'
              )}
              {...field('confirmPassword')}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
            >
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
          )}
        </div>

        {/* ── Submit ────────────────────────────────────────────────────── */}
        <button
          type="submit"
          disabled={isPending}
          data-testid="register-submit"
          className={cn(
            'w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground',
            'hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'transition-all duration-150',
            'disabled:cursor-not-allowed disabled:opacity-60',
            'flex items-center justify-center gap-2'
          )}
        >
          {isPending && <Loader2 size={16} className="animate-spin" />}
          {isPending ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/auth/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </motion.div>
  )
}
