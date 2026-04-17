'use client'

/**
 * LinearCard — building blocks for the job card UI.
 *
 * Components:
 *   LinearCard        — outer container with ring + hover shadow
 *   LinearCardTitle   — job title (2-line clamp)
 *   LinearCardBadge   — small pill label (source, match score, etc.)
 *   LinearCardFooter  — bottom action row (sits below a divider)
 *   LinearCardButton  — action button inside the footer
 */

import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

// ─── LinearCard ────────────────────────────────────────────────────────────────

interface LinearCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export const LinearCard = forwardRef<HTMLDivElement, LinearCardProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'group relative flex flex-col gap-2.5 rounded-xl bg-card p-3.5',
        'ring-1 ring-foreground/8 transition-shadow duration-150',
        'hover:shadow-md hover:ring-foreground/15',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
)
LinearCard.displayName = 'LinearCard'

// ─── LinearCardTitle ───────────────────────────────────────────────────────────

interface LinearCardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode
}

export function LinearCardTitle({ className, children, ...props }: LinearCardTitleProps) {
  return (
    <h3
      className={cn(
        'line-clamp-2 text-sm font-semibold leading-snug text-card-foreground',
        'transition-colors group-hover:text-primary',
        className
      )}
      {...props}
    >
      {children}
    </h3>
  )
}

// ─── LinearCardBadge ──────────────────────────────────────────────────────────

interface LinearCardBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode
}

export function LinearCardBadge({ className, children, ...props }: LinearCardBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}

// ─── LinearCardFooter ─────────────────────────────────────────────────────────

interface LinearCardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function LinearCardFooter({ className, children, ...props }: LinearCardFooterProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 border-t border-border pt-2.5',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

// ─── LinearCardButton ─────────────────────────────────────────────────────────

interface LinearCardButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  variant?: 'default' | 'ghost'
}

export function LinearCardButton({
  className,
  children,
  variant = 'ghost',
  ...props
}: LinearCardButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'relative z-10 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
        variant === 'default'
          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
