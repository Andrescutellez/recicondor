import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Wallet, Package, ShoppingCart, TrendingUp,
  AlertTriangle, ArrowRight, History
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { StatCard, Card } from '../components/ui/Card'
import { Badge, StatusBadge } from '../components/ui/Badge'
import { formatCOP, formatQty } from '../lib/format'

function useStats() {
  return useQuery({
    queryKey: ['dashboard_stats'],
    queryFn: async () => {
      const today = new Date()
      const todayStr = today.toISOString().slice(0, 10)

      const [cashRes, inventoryRes, purchasesRes, salesRes] = await Promise.all([
        supabase.from('cash_registers').select('balance').eq('active', true),
        supabase.from('inventory').select('quantity, avg_cost'),
        supabase.from('purchases').select('total').eq('status', 'active').gte('date', `${todayStr}T00:00:00`),
        supabase.from('sales').select('total').eq('status', 'active').gte('date', `${todayStr}T00:00:00`),
      ])

      const totalCash = (cashRes.data ?? []).reduce((s, r) => s + (r.balance ?? 0), 0)
      const totalInventoryValue = (inventoryRes.data ?? []).reduce(
        (s, r) => s + (r.quantity ?? 0) * (r.avg_cost ?? 0), 0
      )
      const todayPurchases = (purchasesRes.data ?? []).reduce((s, r) => s + (r.total ?? 0), 0)
      const todaySales = (salesRes.data ?? []).reduce((s, r) => s + (r.total ?? 0), 0)

      return { totalCash, totalInventoryValue, todayPurchases, todaySales }
    },
  })
}

function useInventorySummary() {
  return useQuery({
    queryKey: ['inventory_summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select('*, material:materials(id, name, unit)')
        .order('quantity', { ascending: false })
      if (error) throw error
      return (data ?? []).filter((i) => (i.material as { id: string } | undefined)?.id)
    },
  })
}

function useRecentPurchases() {
  return useQuery({
    queryKey: ['recent_purchases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchases')
        .select('*, operator:profiles!operator_id(name), provider:providers(name)')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(5)
      if (error) throw error
      return data ?? []
    },
  })
}

function useRecentSales() {
  return useQuery({
    queryKey: ['recent_sales'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('*, operator:profiles!operator_id(name)')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(5)
      if (error) throw error
      return data ?? []
    },
  })
}

function useLowInventory() {
  return useQuery({
    queryKey: ['low_inventory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select('*, material:materials(name, unit)')
        .lte('quantity', 0)
      if (error) throw error
      return data ?? []
    },
  })
}

export function Dashboard() {
  const stats = useStats()
  const inventorySummary = useInventorySummary()
  const recentPurchases = useRecentPurchases()
  const recentSales = useRecentSales()
  const lowInventory = useLowInventory()

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard
          title="Total en Cajas"
          value={stats.data ? formatCOP(stats.data.totalCash) : '—'}
          icon={<Wallet className="w-6 h-6 text-green-600" />}
          iconBg="bg-green-100"
          subtitle="Suma de todas las cajas activas"
        />
        <StatCard
          title="Valor de Inventario"
          value={stats.data ? formatCOP(stats.data.totalInventoryValue) : '—'}
          icon={<Package className="w-6 h-6 text-blue-600" />}
          iconBg="bg-blue-100"
          subtitle="Costo promedio ponderado"
        />
        <StatCard
          title="Compras de Hoy"
          value={stats.data ? formatCOP(stats.data.todayPurchases) : '—'}
          icon={<ShoppingCart className="w-6 h-6 text-purple-600" />}
          iconBg="bg-purple-100"
          subtitle="Total comprado hoy"
        />
        <StatCard
          title="Ventas de Hoy"
          value={stats.data ? formatCOP(stats.data.todaySales) : '—'}
          icon={<TrendingUp className="w-6 h-6 text-orange-600" />}
          iconBg="bg-orange-100"
          subtitle="Total vendido hoy"
        />
      </div>

      {/* Low inventory alert */}
      {(lowInventory.data?.length ?? 0) > 0 && (
        <Card>
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Materiales con inventario en cero o negativo
              </h3>
              <div className="flex flex-wrap gap-2">
                {lowInventory.data?.map((inv: { material_id: string; quantity: number; material?: { name: string; unit: string } }) => (
                  <Link key={inv.material_id} to={`/inventory/kardex/${inv.material_id}`}>
                    <Badge color={inv.quantity < 0 ? 'red' : 'yellow'}>
                      {inv.material?.name} ({inv.quantity?.toFixed(3)} {inv.material?.unit})
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Inventory summary */}
      <Card padding={false}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Inventario por Material</h2>
          <Link to="/inventory" className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1">
            Ver completo <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {inventorySummary.isLoading ? (
          <p className="px-6 py-4 text-sm text-gray-400">Cargando...</p>
        ) : (inventorySummary.data?.length ?? 0) === 0 ? (
          <p className="px-6 py-4 text-sm text-gray-400">Sin inventario registrado</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Material</th>
                  <th className="px-6 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Cantidad</th>
                  <th className="px-6 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Costo Prom.</th>
                  <th className="px-6 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Valor</th>
                  <th className="px-6 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Kardex</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {inventorySummary.data?.map((inv) => {
                  const mat = inv.material as { id: string; name: string; unit: string } | undefined
                  const isLow = inv.quantity <= 0
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="px-6 py-2.5 font-medium text-gray-900">
                        {mat?.name}
                        <span className="ml-1.5 text-xs text-gray-400">({mat?.unit})</span>
                      </td>
                      <td className={`px-6 py-2.5 text-right font-semibold ${isLow ? 'text-red-600' : 'text-gray-900'}`}>
                        {formatQty(inv.quantity, mat?.unit ?? 'kg')}
                      </td>
                      <td className="px-6 py-2.5 text-right text-gray-600">{formatCOP(inv.avg_cost)}</td>
                      <td className="px-6 py-2.5 text-right font-semibold text-gray-900">
                        {formatCOP(inv.quantity * inv.avg_cost)}
                      </td>
                      <td className="px-6 py-2.5 text-center">
                        <Link
                          to={`/inventory/kardex/${mat?.id}`}
                          className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-700"
                          onClick={e => e.stopPropagation()}
                        >
                          <History className="w-3 h-3" /> Ver
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Recent Purchases */}
        <Card padding={false}>
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Últimas Compras</h2>
            <Link to="/purchases" className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1">
              Ver todas <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentPurchases.isLoading ? (
              <p className="px-6 py-4 text-sm text-gray-400">Cargando...</p>
            ) : (recentPurchases.data?.length ?? 0) === 0 ? (
              <p className="px-6 py-4 text-sm text-gray-400">No hay compras recientes</p>
            ) : (
              recentPurchases.data?.map((p: { id: string; date: string; operator?: { name: string }; provider?: { name: string }; total: number; status: string }) => (
                <div key={p.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {p.provider?.name ?? 'Sin proveedor'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {p.operator?.name} · {format(new Date(p.date), "d MMM, HH:mm", { locale: es })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{formatCOP(p.total)}</p>
                    <StatusBadge status={p.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Recent Sales */}
        <Card padding={false}>
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Últimas Ventas</h2>
            <Link to="/sales" className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1">
              Ver todas <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentSales.isLoading ? (
              <p className="px-6 py-4 text-sm text-gray-400">Cargando...</p>
            ) : (recentSales.data?.length ?? 0) === 0 ? (
              <p className="px-6 py-4 text-sm text-gray-400">No hay ventas recientes</p>
            ) : (
              recentSales.data?.map((s: { id: string; date: string; operator?: { name: string }; customer_name?: string; total: number; status: string }) => (
                <div key={s.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {s.customer_name ?? 'Comprador general'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {s.operator?.name} · {format(new Date(s.date), "d MMM, HH:mm", { locale: es })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-green-700">{formatCOP(s.total)}</p>
                    <StatusBadge status={s.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
