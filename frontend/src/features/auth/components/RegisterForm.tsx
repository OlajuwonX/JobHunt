'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
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
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Create account</h1>
        <p className="mt-1 text-sm text-slate-500">Start your job search, the smart way.</p>
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

        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            data-testid="register-email"
            className={cn(
              'w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900',
              'placeholder:text-slate-400 transition-colors duration-150',
              'focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20',
              errors.email && 'border-red-400 focus:border-red-400 focus:ring-red-400/20'
            )}
            {...field('email')}
          />
          {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
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
                'w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 pr-10 text-sm text-slate-900',
                'placeholder:text-slate-400 transition-colors duration-150',
                'focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20',
                errors.password && 'border-red-400 focus:border-red-400 focus:ring-red-400/20'
              )}
              {...field('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700">
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
                'w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 pr-10 text-sm text-slate-900',
                'placeholder:text-slate-400 transition-colors duration-150',
                'focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20',
                errors.confirmPassword &&
                  'border-red-400 focus:border-red-400 focus:ring-red-400/20'
              )}
              {...field('confirmPassword')}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
            >
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-xs text-red-500">{errors.confirmPassword.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isPending}
          data-testid="register-submit"
          className={cn(
            'mt-1 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5',
            'bg-slate-900 text-sm font-semibold text-white',
            'hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2',
            'transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60'
          )}
        >
          {isPending && <Loader2 size={16} className="animate-spin" />}
          {isPending ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link
          href="/auth/login"
          className="font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}
