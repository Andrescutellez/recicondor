import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: boolean
}

export function Card({ children, className = '', padding = true }: CardProps) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 ${padding ? 'p-6' : ''} ${className}`}>
      {children}
    </div>
  )
}

interface StatCardProps {
  title: string
  value: string
  icon: React.ReactNode
  iconBg?: string
  subtitle?: string
  trend?: 'up' | 'down' | 'neutral'
}

export function StatCard({ title, value, icon, iconBg = 'bg-green-100', subtitle }: StatCardProps) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-gray-400">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-xl ${iconBg}`}>
          {icon}
        </div>
      </div>
    </Card>
  )
}
