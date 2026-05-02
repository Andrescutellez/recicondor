import React from 'react'
import { Loader2 } from 'lucide-react'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'warning'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: React.ReactNode
  fullWidth?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:   'bg-green-600 text-white hover:bg-green-700 active:bg-green-800 focus:ring-green-500 border-transparent',
  secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300 focus:ring-gray-400 border-transparent',
  danger:    'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus:ring-red-500 border-transparent',
  ghost:     'bg-transparent text-gray-600 hover:bg-gray-100 active:bg-gray-200 focus:ring-gray-400 border-gray-300',
  warning:   'bg-yellow-500 text-white hover:bg-yellow-600 active:bg-yellow-700 focus:ring-yellow-400 border-transparent',
}

// Mobile-friendly sizes: min 44px height for touch targets
const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-2 lg:py-1.5 text-sm gap-1.5',
  md: 'px-4 py-3 lg:py-2 text-sm gap-2',
  lg: 'px-6 py-3.5 lg:py-3 text-base gap-2',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = false,
  children,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center font-medium rounded-xl border
        focus:outline-none focus:ring-2 focus:ring-offset-2
        transition-colors duration-150 select-none
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : icon ? (
        <span className="flex-shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  )
}
