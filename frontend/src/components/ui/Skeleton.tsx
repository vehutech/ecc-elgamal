'use client'

import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
  lines?: number
}

export function Skeleton({ className, lines = 1 }: SkeletonProps) {
  if (lines === 1) {
    return <div className={cn('skeleton h-4', className)} />
  }
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn('skeleton h-4', i === lines - 1 && 'w-3/4', className)}
        />
      ))}
    </div>
  )
}

export function KeySkeleton() {
  return (
    <div className="space-y-2 animate-fade-in">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-20" />
      <Skeleton className="h-3 w-20 mt-3" />
      <Skeleton className="h-32" />
    </div>
  )
}

export function StatSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 animate-fade-in">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="card p-3 space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-6 w-24" />
        </div>
      ))}
    </div>
  )
}

export function ChartSkeleton() {
  return (
    <div className="space-y-3 animate-fade-in">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-48 w-full" />
    </div>
  )
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      className="animate-spin"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeOpacity="0.2"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="var(--accent)"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}
