import React from 'react'

type BadgeColor = 'green' | 'red' | 'yellow' | 'blue' | 'gray' | 'purple' | 'orange'

interface BadgeProps {
  children: React.ReactNode
  color?: BadgeColor
  size?: 'sm' | 'md'
}

const colorClasses: Record<BadgeColor, string> = {
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  blue: 'bg-blue-100 text-blue-800',
  gray: 'bg-gray-100 text-gray-700',
  purple: 'bg-purple-100 text-purple-800',
  orange: 'bg-orange-100 text-orange-800',
}

export function Badge({ children, color = 'gray', size = 'md' }: BadgeProps) {
  return (
    <span className={`
      inline-flex items-center font-medium rounded-full
      ${colorClasses[color]}
      ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'}
    `}>
      {children}
    </span>
  )
}

// Convenience badges
export function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { label: string; color: BadgeColor }> = {
    admin: { label: 'Admin', color: 'purple' },
    operator: { label: 'Operador', color: 'blue' },
    auditor: { label: 'Auditor', color: 'yellow' },
  }
  const config = map[role] ?? { label: role, color: 'gray' }
  return <Badge color={config.color}>{config.label}</Badge>
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: BadgeColor }> = {
    active: { label: 'Activo', color: 'green' },
    reversed: { label: 'Anulado', color: 'red' },
    inactive: { label: 'Inactivo', color: 'gray' },
  }
  const config = map[status] ?? { label: status, color: 'gray' }
  return <Badge color={config.color}>{config.label}</Badge>
}

export function MovementTypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; color: BadgeColor }> = {
    income: { label: 'Ingreso', color: 'green' },
    expense: { label: 'Egreso', color: 'red' },
    transfer_in: { label: 'Transferencia +', color: 'blue' },
    transfer_out: { label: 'Transferencia -', color: 'orange' },
    purchase: { label: 'Compra', color: 'blue' },
    sale: { label: 'Venta', color: 'green' },
    adjustment_loss: { label: 'Pérdida', color: 'red' },
    adjustment_gain: { label: 'Ganancia', color: 'green' },
    adjustment_correction: { label: 'Corrección', color: 'yellow' },
    shrinkage: { label: 'Merma', color: 'orange' },
    conversion_in: { label: 'Conversión +', color: 'blue' },
    conversion_out: { label: 'Conversión -', color: 'orange' },
  }
  const config = map[type] ?? { label: type, color: 'gray' }
  return <Badge color={config.color}>{config.label}</Badge>
}
