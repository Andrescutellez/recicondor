import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ShoppingCart, TrendingUp, Package, Receipt } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

export function BottomNav() {
  const { profile } = useAuth()
  const isOperator = profile?.role === 'operator'

  const items = isOperator
    ? [
        { to: '/dashboard',   icon: <LayoutDashboard className="w-6 h-6" />, label: 'Inicio' },
        { to: '/purchases/new', icon: <ShoppingCart className="w-6 h-6" />, label: 'Comprar' },
        { to: '/sales/new',   icon: <TrendingUp className="w-6 h-6" />,     label: 'Vender' },
        { to: '/inventory',   icon: <Package className="w-6 h-6" />,        label: 'Inv.' },
        { to: '/expenses',    icon: <Receipt className="w-6 h-6" />,        label: 'Gastos' },
      ]
    : [
        { to: '/dashboard',   icon: <LayoutDashboard className="w-6 h-6" />, label: 'Inicio' },
        { to: '/purchases',   icon: <ShoppingCart className="w-6 h-6" />,    label: 'Compras' },
        { to: '/sales',       icon: <TrendingUp className="w-6 h-6" />,      label: 'Ventas' },
        { to: '/inventory',   icon: <Package className="w-6 h-6" />,         label: 'Inv.' },
        { to: '/cash',        icon: <Receipt className="w-6 h-6" />,         label: 'Cajas' },
      ]

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-10 safe-area-pb">
      <div className="flex">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            className={({ isActive }) => `
              flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium
              transition-colors active:bg-gray-50
              ${isActive ? 'text-green-600' : 'text-gray-400'}
            `}
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
