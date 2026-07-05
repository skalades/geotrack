import { cn } from '@/lib/utils'
import { MeasurementStatus, PointType } from '@/types'
import { STATUS_LABELS, STATUS_COLORS, POINT_TYPE_COLORS } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'primary' | 'purple'
  size?: 'sm' | 'md'
  className?: string
}

export function Badge({ children, variant = 'default', size = 'sm', className }: BadgeProps) {
  const variants = {
    default: 'bg-slate-100 text-slate-600',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-red-100 text-red-700',
    primary: 'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700',
  }
  const sizes = { sm: 'px-2 py-0.5 text-xs', md: 'px-3 py-1 text-sm' }
  return (
    <span className={cn('inline-flex items-center font-semibold rounded-full border', variants[variant], sizes[size], className)}>
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status: MeasurementStatus }) {
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border', STATUS_COLORS[status])}>
      {STATUS_LABELS[status]}
    </span>
  )
}

export function PointTypeBadge({ type }: { type: PointType }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 text-xs font-bold rounded-full', POINT_TYPE_COLORS[type])}>
      {type}
    </span>
  )
}
