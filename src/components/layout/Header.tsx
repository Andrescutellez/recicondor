import { useLocation } from 'react-router-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar, Menu } from 'lucide-react'

const routeTitles: Record<string, string> = {
  '/dashboard':               'Dashboard',
  '/cash':                    'Cajas',
  '/purchases':               'Compras',
  '/purchases/new':           'Nueva Compra',
  '/inventory':               'Inventario',
  '/inventory/adjustments':   'Ajustes de Inventario',
  '/sales':                   'Ventas',
  '/sales/new':               'Nueva Venta',
  '/expenses':                'Gastos',
  '/materials':               'Materiales',
  '/reports':                 'Reportes',
  '/users':                   'Usuarios',
}

function getTitle(pathname: string): string {
  if (routeTitles[pathname]) return routeTitles[pathname]
  if (pathname.startsWith('/cash/'))              return 'Detalle de Caja'
  if (pathname.startsWith('/inventory/kardex/'))  return 'Kardex'
  return 'Recicondor'
}

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const location = useLocation()
  const title = getTitle(location.pathname)
  const today = format(new Date(), "EEEE d 'de' MMMM", { locale: es })

  return (
    <header className="h-14 lg:h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-10">
      {/* Left: hamburger + logo on mobile */}
      <div className="flex items-center gap-2">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 rounded-lg text-gray-500 hover:bg-gray-100 active:bg-gray-200 transition-colors"
          aria-label="Abrir menú"
        >
          <Menu className="w-5 h-5" />
        </button>
        <img
          src="/logo-recicondor.png"
          alt="Recicondor"
          className="lg:hidden h-8 w-auto object-contain"
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
        />
      </div>

      <h1 className="text-base lg:text-xl font-semibold text-gray-900 capitalize lg:ml-0 absolute left-1/2 -translate-x-1/2 lg:static lg:translate-x-0">
        {title}
      </h1>

      {/* Date — hidden on small screens */}
      <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500">
        <Calendar className="w-4 h-4" />
        <span className="capitalize">{today}</span>
      </div>
    </header>
  )
}
