import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, ChevronDown, ChevronRight, Lock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Sale } from '../../types'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { StatusBadge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { formatCOP, formatDate, formatQty } from '../../lib/format'
import { useAuth } from '../../hooks/useAuth'

export function SaleList() {
  // ALL hooks at top — no conditional returns before this
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const isOperator = profile?.role === 'operator'

  const { data: sales = [], isLoading } = useQuery<Sale[]>({
    queryKey: ['sales', dateFrom, dateTo],
    queryFn: async () => {
      let q = supabase
        .from('sales')
        .select('*, operator:profiles!operator_id(name), cash_register:cash_registers(name)')
        .order('date', { ascending: false })

      if (dateFrom) q = q.gte('date', new Date(dateFrom + 'T00:00:00').toISOString())
      if (dateTo)   q = q.lte('date', new Date(dateTo + 'T23:59:59.999').toISOString())

      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
    enabled: !isOperator,
  })

  const toggleExpand = (id: string) => setExpandedId(prev => prev === id ? null : id)

  // Role guard — AFTER all hooks
  if (isOperator) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 py-8 text-gray-400">
          <Lock className="w-10 h-10" />
          <p className="font-medium text-gray-600">Sin acceso al historial de ventas</p>
          <Button onClick={() => navigate('/sales/new')}>Registrar Nueva Venta</Button>
        </div>
      </Card>
    )
  }

  const filtered = search
    ? sales.filter(s =>
        s.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
        s.operator?.name?.toLowerCase().includes(search.toLowerCase())
      )
    : sales

  const totalShown = filtered.reduce((s, p) => s + p.total, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Total filtrado: <span className="font-bold text-gray-900">{formatCOP(totalShown)}</span>
          {' '}({filtered.length} ventas)
        </p>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => navigate('/sales/new')}>
          Nueva Venta
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar cliente u operador..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <Input label="Fecha desde" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <Input label="Fecha hasta" type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)} />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
        {isLoading ? (
          <p className="px-6 py-8 text-sm text-gray-400 text-center">Cargando...</p>
        ) : filtered.length === 0 ? (
          <p className="px-6 py-8 text-sm text-gray-400 text-center">No hay ventas que coincidan con los filtros</p>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-8" />
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Operador</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Caja</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Estado</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((s) => (
                <>
                  <tr
                    key={s.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => toggleExpand(s.id)}
                  >
                    <td className="pl-4 py-3 text-gray-400">
                      {expandedId === s.id
                        ? <ChevronDown className="w-4 h-4" />
                        : <ChevronRight className="w-4 h-4" />}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap hidden sm:table-cell">{formatDate(s.date)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <div className="font-medium">{s.customer_name ?? <span className="text-gray-400">Comprador general</span>}</div>
                      <div className="text-xs text-gray-400 sm:hidden">{formatDate(s.date)}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 hidden md:table-cell">{s.operator?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 hidden lg:table-cell">{(s.cash_register as { name: string } | undefined)?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-center hidden sm:table-cell"><StatusBadge status={s.status} /></td>
                    <td className="px-4 py-3 text-right font-semibold text-green-700 whitespace-nowrap">{formatCOP(s.total)}</td>
                  </tr>
                  {expandedId === s.id && (
                    <tr key={`${s.id}-detail`}>
                      <td colSpan={7} className="bg-green-50 px-4 md:px-8 py-3">
                        <SaleItemsDetail saleId={s.id} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function SaleItemsDetail({ saleId }: { saleId: string }) {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['sale_items', saleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sale_items').select('*, material:materials(name, unit)').eq('sale_id', saleId)
      if (error) throw error
      return data ?? []
    },
  })
  if (isLoading) return <p className="text-xs text-gray-400 py-1">Cargando materiales...</p>
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">Materiales vendidos</p>
      <table className="text-sm w-full max-w-lg">
        <thead>
          <tr className="text-xs text-gray-400">
            <th className="text-left pr-6 pb-1">Material</th>
            <th className="text-right pr-6 pb-1">Cantidad</th>
            <th className="text-right pr-6 pb-1">Precio/kg</th>
            <th className="text-right pb-1">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item: { id: string; material?: { name: string; unit: string }; quantity: number; price_per_unit: number; total: number }) => (
            <tr key={item.id}>
              <td className="pr-6 py-0.5 font-medium text-gray-800">{item.material?.name}</td>
              <td className="pr-6 py-0.5 text-right text-gray-600">{formatQty(item.quantity, item.material?.unit ?? 'kg')}</td>
              <td className="pr-6 py-0.5 text-right text-gray-600">{formatCOP(item.price_per_unit)}</td>
              <td className="py-0.5 text-right font-semibold text-green-700">{formatCOP(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
