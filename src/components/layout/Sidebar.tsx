import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Wallet, ShoppingCart, Package,
  TrendingUp, Receipt, Tag, BarChart3, Users,
  LogOut, ChevronRight, PlusCircle, X
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

type NavRole = 'all' | 'admin_auditor' | 'operator_only'

interface NavItem {
  to: string
  icon: React.ReactNode
  label: string
  role?: NavRole
}

const navItems: NavItem[] = [
  { to: '/dashboard',  icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard' },
  { to: '/cash',       icon: <Wallet className="w-5 h-5" />,          label: 'Cajas' },
  { to: '/purchases',  icon: <ShoppingCart className="w-5 h-5" />,    label: 'Compras' },
  { to: '/sales',      icon: <TrendingUp className="w-5 h-5" />,      label: 'Ventas',       role: 'admin_auditor' },
  { to: '/sales/new',  icon: <PlusCircle className="w-5 h-5" />,      label: 'Nueva Venta',  role: 'operator_only' },
  { to: '/inventory',  icon: <Package className="w-5 h-5" />,         label: 'Inventario' },
  { to: '/expenses',   icon: <Receipt className="w-5 h-5" />,         label: 'Gastos' },
  { to: '/materials',  icon: <Tag className="w-5 h-5" />,             label: 'Materiales' },
  { to: '/reports',    icon: <BarChart3 className="w-5 h-5" />,       label: 'Reportes',     role: 'admin_auditor' },
  { to: '/users',      icon: <Users className="w-5 h-5" />,           label: 'Usuarios',     role: 'admin_auditor' },
]

const roleLabel: Record<string, string> = {
  admin: 'Administrador',
  operator: 'Operador',
  auditor: 'Auditor',
}

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const isOperator = profile?.role === 'operator'

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/login')
    } catch (err) {
      console.error(err)
    }
  }

  const visibleItems = navItems.filter((item) => {
    if (item.role === 'operator_only') return isOperator
    if (item.role === 'admin_auditor') return !isOperator
    return true
  })

  return (
    <>
      {/* Sidebar panel */}
      <aside
        className={`
          fixed inset-y-0 left-0 w-64 bg-gray-900 text-white flex flex-col z-30
          transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        {/* Logo + close button */}
        <div className="px-5 py-4 border-b border-gray-700/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logo-recicondor.png"
              alt="Recicondor"
              className="w-10 h-10 object-contain rounded-lg flex-shrink-0"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
            <div className="min-w-0">
              <h1 className="text-base font-bold text-white leading-tight">Recicondor</h1>
              <p className="text-xs text-green-400 font-medium">Colina Verde</p>
              <p className="text-[10px] text-gray-500">ID: 50863</p>
            </div>
          </div>
          {/* Close button — only visible on mobile */}
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/sales/new'}
              onClick={onClose}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-3 lg:py-2.5 rounded-xl text-sm font-medium
                transition-all duration-150 group
                ${isActive
                  ? 'bg-green-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800 active:bg-gray-700'
                }
              `}
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-50 transition-opacity" />
            </NavLink>
          ))}
        </nav>

        {/* User info + logout */}
        <div className="px-3 py-4 border-t border-gray-700/50">
          {profile && (
            <div className="px-3 py-2 mb-2">
              <p className="text-sm font-medium text-white truncate">{profile.name}</p>
              <p className="text-xs text-gray-400">{roleLabel[profile.role] ?? profile.role}</p>
            </div>
          )}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-3 py-3 lg:py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-red-600/20 active:bg-red-600/30 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Cerrar Sesión
          </button>
        </div>
      </aside>
    </>
  )
}
