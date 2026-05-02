import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, TrendingUp, ShoppingCart, DollarSign } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { formatCOP, formatQty } from '../../lib/format'

type Tab = 'cashflow' | 'purchases' | 'sales' | 'profit'

const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'cashflow', label: 'Flujo de Caja', icon: <DollarSign className="w-4 h-4" /> },
  { key: 'purchases', label: 'Compras por Material', icon: <ShoppingCart className="w-4 h-4" /> },
  { key: 'sales', label: 'Ventas por Material', icon: <TrendingUp className="w-4 h-4" /> },
  { key: 'profit', label: 'Rentabilidad', icon: <BarChart3 className="w-4 h-4" /> },
]

function getDefaultDates() {
  const end = new Date()
  const start = new Date()
  start.setDate(1) // first of current month
  return {
    from: start.toISOString().split('T')[0],
    to: end.toISOString().split('T')[0],
  }
}

export function Reports() {
  const [activeTab, setActiveTab] = useState<Tab>('cashflow')
  const defaults = getDefaultDates()
  const [dateFrom, setDateFrom] = useState(defaults.from)
  const [dateTo, setDateTo] = useState(defaults.to)

  return (
    <div className="space-y-6">
      {/* Date filters */}
      <Card>
        <div className="flex items-center gap-4">
          <Input
            label="Desde"
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
          />
          <Input
            label="Hasta"
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
          />
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`
              flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors
              ${activeTab === tab.key
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'cashflow' && <CashFlowReport dateFrom={dateFrom} dateTo={dateTo} />}
      {activeTab === 'purchases' && <PurchasesByMaterial dateFrom={dateFrom} dateTo={dateTo} />}
      {activeTab === 'sales' && <SalesByMaterial dateFrom={dateFrom} dateTo={dateTo} />}
      {activeTab === 'profit' && <ProfitReport dateFrom={dateFrom} dateTo={dateTo} />}
    </div>
  )
}

function CashFlowReport({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['report_cashflow', dateFrom, dateTo],
    queryFn: async () => {
      const fromISO = new Date(dateFrom).toISOString()
      const toDate = new Date(dateTo)
      toDate.setHours(23, 59, 59, 999)
      const toISO = toDate.toISOString()

      const [movementsRes, expensesRes] = await Promise.all([
        supabase
          .from('cash_movements')
          .select('type, amount, reference_type, created_at')
          .gte('created_at', fromISO)
          .lte('created_at', toISO),
        supabase
          .from('expenses')
          .select('amount, category, date')
          .gte('date', fromISO)
          .lte('date', toISO),
      ])

      const movements = movementsRes.data ?? []
      const expenses = expensesRes.data ?? []

      const income = movements.filter(m => m.type === 'income' && m.reference_type === 'sale')
        .reduce((s, m) => s + m.amount, 0)
      const purchases = movements.filter(m => m.type === 'expense' && m.reference_type === 'purchase')
        .reduce((s, m) => s + m.amount, 0)
      const expensesTotal = expenses.reduce((s, e) => s + e.amount, 0)
      const transfers = movements.filter(m => m.type === 'transfer_in').reduce((s, m) => s + m.amount, 0)

      // Expenses by category
      const byCategory: Record<string, number> = {}
      expenses.forEach(e => {
        byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount
      })

      return {
        income,
        purchases,
        expensesTotal,
        transfers,
        net: income - purchases - expensesTotal,
        byCategory,
      }
    },
  })

  if (isLoading) return <p className="text-sm text-gray-400">Calculando...</p>
  if (!data) return null

  const categoryLabels: Record<string, string> = {
    salary: 'Salarios',
    transport: 'Transporte',
    supplies: 'Insumos',
    maintenance: 'Mantenimiento',
    other: 'Otros',
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <p className="text-xs text-gray-500">Ingresos por Ventas</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{formatCOP(data.income)}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">Egresos por Compras</p>
          <p className="text-2xl font-bold text-red-700 mt-1">{formatCOP(data.purchases)}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">Gastos Operativos</p>
          <p className="text-2xl font-bold text-orange-700 mt-1">{formatCOP(data.expensesTotal)}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">Flujo Neto</p>
          <p className={`text-2xl font-bold mt-1 ${data.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {formatCOP(data.net)}
          </p>
        </Card>
      </div>

      {/* Expenses by category */}
      <Card>
        <h3 className="font-semibold text-gray-900 mb-4">Gastos por Categoría</h3>
        {Object.keys(data.byCategory).length === 0 ? (
          <p className="text-sm text-gray-400">No hay gastos en el período</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(data.byCategory)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, amount]) => {
                const pct = data.expensesTotal > 0 ? (amount / data.expensesTotal) * 100 : 0
                return (
                  <div key={cat}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">{categoryLabels[cat] ?? cat}</span>
                      <span className="font-semibold">{formatCOP(amount)} ({pct.toFixed(1)}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-orange-500 h-2 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </Card>
    </div>
  )
}

interface MaterialStat {
  material_id: string
  material_name: string
  unit: string
  total_qty: number
  total_value: number
  avg_price: number
}

function PurchasesByMaterial({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data = [], isLoading } = useQuery<MaterialStat[]>({
    queryKey: ['report_purchases_by_material', dateFrom, dateTo],
    queryFn: async () => {
      const fromISO = new Date(dateFrom).toISOString()
      const toDate = new Date(dateTo)
      toDate.setHours(23, 59, 59, 999)
      const toISO = toDate.toISOString()

      const { data: items, error } = await supabase
        .from('purchase_items')
        .select('quantity, price_per_unit, total, material:materials(id, name, unit), purchase:purchases(date, status)')
        .gte('purchase.date', fromISO)
        .lte('purchase.date', toISO)
      if (error) throw error

      const map: Record<string, MaterialStat> = {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(items ?? []).forEach((item: any) => {
        const mat = Array.isArray(item.material) ? item.material[0] : item.material
        const pur = Array.isArray(item.purchase) ? item.purchase[0] : item.purchase
        if (!mat || pur?.status === 'reversed') return
        const id = mat.id
        if (!map[id]) {
          map[id] = {
            material_id: id,
            material_name: mat.name,
            unit: mat.unit,
            total_qty: 0,
            total_value: 0,
            avg_price: 0,
          }
        }
        map[id].total_qty += item.quantity
        map[id].total_value += item.total
      })
      Object.values(map).forEach(s => {
        s.avg_price = s.total_qty > 0 ? s.total_value / s.total_qty : 0
      })
      return Object.values(map).sort((a, b) => b.total_value - a.total_value)
    },
  })

  if (isLoading) return <p className="text-sm text-gray-400">Calculando...</p>

  const grandQty = data.reduce((s, d) => s + d.total_qty, 0)
  const grandValue = data.reduce((s, d) => s + d.total_value, 0)

  return (
    <Card padding={false}>
      <table className="min-w-full divide-y divide-gray-100">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Material</th>
            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Cantidad</th>
            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Precio Prom.</th>
            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total Pagado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {data.length === 0 ? (
            <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-400">No hay compras en el período</td></tr>
          ) : (
            data.map((row, idx) => (
              <tr key={row.material_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="px-6 py-3 font-medium text-gray-900">{row.material_name}</td>
                <td className="px-6 py-3 text-right">{formatQty(row.total_qty, row.unit)}</td>
                <td className="px-6 py-3 text-right">{formatCOP(row.avg_price)}/{row.unit}</td>
                <td className="px-6 py-3 text-right font-semibold text-gray-900">{formatCOP(row.total_value)}</td>
              </tr>
            ))
          )}
        </tbody>
        {data.length > 0 && (
          <tfoot className="border-t-2 border-gray-200 bg-gray-50">
            <tr>
              <td className="px-6 py-3 font-semibold">TOTAL</td>
              <td className="px-6 py-3 text-right font-semibold">{formatQty(grandQty, 'kg')}</td>
              <td className="px-6 py-3 text-right text-gray-500">—</td>
              <td className="px-6 py-3 text-right font-bold text-red-700">{formatCOP(grandValue)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </Card>
  )
}

function SalesByMaterial({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data = [], isLoading } = useQuery<MaterialStat[]>({
    queryKey: ['report_sales_by_material', dateFrom, dateTo],
    queryFn: async () => {
      const fromISO = new Date(dateFrom).toISOString()
      const toDate = new Date(dateTo)
      toDate.setHours(23, 59, 59, 999)
      const toISO = toDate.toISOString()

      const { data: items, error } = await supabase
        .from('sale_items')
        .select('quantity, price_per_unit, total, material:materials(id, name, unit), sale:sales(date, status)')
        .gte('sale.date', fromISO)
        .lte('sale.date', toISO)
      if (error) throw error

      const map: Record<string, MaterialStat> = {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(items ?? []).forEach((item: any) => {
        const mat = Array.isArray(item.material) ? item.material[0] : item.material
        const sal = Array.isArray(item.sale) ? item.sale[0] : item.sale
        if (!mat || sal?.status === 'reversed') return
        const id = mat.id
        if (!map[id]) {
          map[id] = {
            material_id: id,
            material_name: mat.name,
            unit: mat.unit,
            total_qty: 0,
            total_value: 0,
            avg_price: 0,
          }
        }
        map[id].total_qty += item.quantity
        map[id].total_value += item.total
      })
      Object.values(map).forEach(s => {
        s.avg_price = s.total_qty > 0 ? s.total_value / s.total_qty : 0
      })
      return Object.values(map).sort((a, b) => b.total_value - a.total_value)
    },
  })

  if (isLoading) return <p className="text-sm text-gray-400">Calculando...</p>

  const grandQty = data.reduce((s, d) => s + d.total_qty, 0)
  const grandValue = data.reduce((s, d) => s + d.total_value, 0)

  return (
    <Card padding={false}>
      <table className="min-w-full divide-y divide-gray-100">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Material</th>
            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Cantidad</th>
            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Precio Prom.</th>
            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total Vendido</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {data.length === 0 ? (
            <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-400">No hay ventas en el período</td></tr>
          ) : (
            data.map((row, idx) => (
              <tr key={row.material_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="px-6 py-3 font-medium text-gray-900">{row.material_name}</td>
                <td className="px-6 py-3 text-right">{formatQty(row.total_qty, row.unit)}</td>
                <td className="px-6 py-3 text-right">{formatCOP(row.avg_price)}/{row.unit}</td>
                <td className="px-6 py-3 text-right font-semibold text-green-700">{formatCOP(row.total_value)}</td>
              </tr>
            ))
          )}
        </tbody>
        {data.length > 0 && (
          <tfoot className="border-t-2 border-gray-200 bg-gray-50">
            <tr>
              <td className="px-6 py-3 font-semibold">TOTAL</td>
              <td className="px-6 py-3 text-right font-semibold">{formatQty(grandQty, 'kg')}</td>
              <td className="px-6 py-3 text-right text-gray-500">—</td>
              <td className="px-6 py-3 text-right font-bold text-green-700">{formatCOP(grandValue)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </Card>
  )
}

interface ProfitRow {
  material_id: string
  material_name: string
  unit: string
  qty_purchased: number
  cost_total: number
  qty_sold: number
  revenue_total: number
  avg_buy_price: number
  avg_sell_price: number
  gross_profit: number
  margin: number
}

function ProfitReport({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data = [], isLoading } = useQuery<ProfitRow[]>({
    queryKey: ['report_profit', dateFrom, dateTo],
    queryFn: async () => {
      const fromISO = new Date(dateFrom).toISOString()
      const toDate = new Date(dateTo)
      toDate.setHours(23, 59, 59, 999)
      const toISO = toDate.toISOString()

      const [purchasesRes, salesRes] = await Promise.all([
        supabase
          .from('purchase_items')
          .select('quantity, total, material:materials(id, name, unit), purchase:purchases(date, status)')
          .gte('purchase.date', fromISO)
          .lte('purchase.date', toISO),
        supabase
          .from('sale_items')
          .select('quantity, total, material:materials(id, name, unit), sale:sales(date, status)')
          .gte('sale.date', fromISO)
          .lte('sale.date', toISO),
      ])

      const pMap: Record<string, { name: string; unit: string; qty: number; cost: number }> = {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(purchasesRes.data ?? []).forEach((item: any) => {
        const mat = Array.isArray(item.material) ? item.material[0] : item.material
        const pur = Array.isArray(item.purchase) ? item.purchase[0] : item.purchase
        if (!mat || pur?.status === 'reversed') return
        const id = mat.id
        if (!pMap[id]) pMap[id] = { name: mat.name, unit: mat.unit, qty: 0, cost: 0 }
        pMap[id].qty += item.quantity
        pMap[id].cost += item.total
      })

      const sMap: Record<string, { qty: number; revenue: number }> = {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(salesRes.data ?? []).forEach((item: any) => {
        const mat = Array.isArray(item.material) ? item.material[0] : item.material
        const sal = Array.isArray(item.sale) ? item.sale[0] : item.sale
        if (!mat || sal?.status === 'reversed') return
        const id = mat.id
        if (!sMap[id]) sMap[id] = { qty: 0, revenue: 0 }
        sMap[id].qty += item.quantity
        sMap[id].revenue += item.total
      })

      const allIds = new Set([...Object.keys(pMap), ...Object.keys(sMap)])
      const rows: ProfitRow[] = []

      allIds.forEach(id => {
        const p = pMap[id] ?? { name: sMap[id] ? 'Desconocido' : '', unit: 'kg', qty: 0, cost: 0 }
        const s = sMap[id] ?? { qty: 0, revenue: 0 }
        const costPerUnit = p.qty > 0 ? p.cost / p.qty : 0
        const estimatedCost = s.qty * costPerUnit
        const grossProfit = s.revenue - estimatedCost
        const margin = s.revenue > 0 ? (grossProfit / s.revenue) * 100 : 0

        rows.push({
          material_id: id,
          material_name: pMap[id]?.name ?? 'Desconocido',
          unit: pMap[id]?.unit ?? 'kg',
          qty_purchased: p.qty,
          cost_total: p.cost,
          qty_sold: s.qty,
          revenue_total: s.revenue,
          avg_buy_price: costPerUnit,
          avg_sell_price: s.qty > 0 ? s.revenue / s.qty : 0,
          gross_profit: grossProfit,
          margin,
        })
      })

      return rows.sort((a, b) => b.gross_profit - a.gross_profit)
    },
  })

  if (isLoading) return <p className="text-sm text-gray-400">Calculando...</p>

  const totalRevenue = data.reduce((s, r) => s + r.revenue_total, 0)
  const totalProfit = data.reduce((s, r) => s + r.gross_profit, 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <p className="text-xs text-gray-500">Ingresos por ventas</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{formatCOP(totalRevenue)}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">Utilidad bruta estimada</p>
          <p className={`text-2xl font-bold mt-1 ${totalProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {formatCOP(totalProfit)}
          </p>
        </Card>
      </div>

      <Card padding={false}>
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Material</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Precio compra</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Precio venta</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">kg Vendidos</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Ingresos</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Utilidad</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Margen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-400">No hay datos en el período</td></tr>
            ) : (
              data.map((row, idx) => (
                <tr key={row.material_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-6 py-3 font-medium text-gray-900">{row.material_name}</td>
                  <td className="px-6 py-3 text-right text-sm">{formatCOP(row.avg_buy_price)}</td>
                  <td className="px-6 py-3 text-right text-sm">{formatCOP(row.avg_sell_price)}</td>
                  <td className="px-6 py-3 text-right text-sm">{formatQty(row.qty_sold, row.unit)}</td>
                  <td className="px-6 py-3 text-right font-semibold text-green-700">{formatCOP(row.revenue_total)}</td>
                  <td className={`px-6 py-3 text-right font-semibold ${row.gross_profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {formatCOP(row.gross_profit)}
                  </td>
                  <td className={`px-6 py-3 text-right font-semibold ${row.margin >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {row.margin.toFixed(1)}%
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
