import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: boolean
}

export function Card({ children, className = '', padding = true }: CardProps) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 ${padding ? 'p-4 lg:p-6' : ''} ${className}`}>
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 lg:p-5">
      <div className="flex items-center gap-3">
        <div className={`p-2 lg:p-2.5 rounded-xl flex-shrink-0 ${iconBg}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500 truncate">{title}</p>
          <p className="text-lg lg:text-2xl font-bold text-gray-900 leading-tight">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 hidden lg:block">{subtitle}</p>}
        </div>
      </div>
    </div>
  )
}
