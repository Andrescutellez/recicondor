import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, ChevronDown, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Purchase } from '../../types'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { StatusBadge } from '../../components/ui/Badge'
import { formatCOP, formatDate, formatQty } from '../../lib/format'

export function PurchaseList() {
  const navigate = useNavigate()
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [operatorId, setOperatorId] = useState('')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data: operators = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, name').eq('active', true)
      return data ?? []
    },
  })

  const { data: purchases = [], isLoading } = useQuery<Purchase[]>({
    queryKey: ['purchases', dateFrom, dateTo, operatorId],
    queryFn: async () => {
      let q = supabase
        .from('purchases')
        // Use explicit FK hint to resolve ambiguity (operator_id vs created_by both → profiles)
        .select('*, operator:profiles!operator_id(name), provider:providers(name), cash_register:cash_registers(name)')
        .order('date', { ascending: false })

      if (dateFrom) q = q.gte('date', `${dateFrom}T00:00:00`)
      if (dateTo)   q = q.lte('date', `${dateTo}T23:59:59.999`)
      if (operatorId) q = q.eq('operator_id', operatorId)

      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
  })

  const filtered = search
    ? purchases.filter(p =>
        p.provider?.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.operator?.name?.toLowerCase().includes(search.toLowerCase())
      )
    : purchases

  const totalShown = filtered.reduce((s, p) => s + p.total, 0)

  const toggleExpand = (id: string) => setExpandedId(prev => prev === id ? null : id)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Total filtrado: <span className="font-bold text-gray-900">{formatCOP(totalShown)}</span>
          {' '}({filtered.length} compras)
        </p>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => navigate('/purchases/new')}>
          Nueva Compra
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar proveedor u operador..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <Input label="" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <Input label="" type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)} />
          <Select
            label=""
            options={operators.map((o: { id: string; name: string }) => ({ value: o.id, label: o.name }))}
            placeholder="Todos los operadores"
            value={operatorId}
            onChange={e => setOperatorId(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {isLoading ? (
          <p className="px-6 py-8 text-sm text-gray-400 text-center">Cargando...</p>
        ) : filtered.length === 0 ? (
          <p className="px-6 py-8 text-sm text-gray-400 text-center">No hay compras que coincidan con los filtros</p>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-8" />
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Proveedor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Operador</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Caja</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Estado</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((p) => (
                <>
                  <tr
                    key={p.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => toggleExpand(p.id)}
                  >
                    <td className="pl-4 py-3 text-gray-400">
                      {expandedId === p.id
                        ? <ChevronDown className="w-4 h-4" />
                        : <ChevronRight className="w-4 h-4" />}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{formatDate(p.date)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{p.provider?.name ?? <span className="text-gray-400">Sin proveedor</span>}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{p.operator?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{(p.cash_register as { name: string } | undefined)?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCOP(p.total)}</td>
                  </tr>
                  {expandedId === p.id && (
                    <tr key={`${p.id}-detail`}>
                      <td colSpan={7} className="bg-green-50 px-8 py-3">
                        <PurchaseItemsDetail purchaseId={p.id} />
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

function PurchaseItemsDetail({ purchaseId }: { purchaseId: string }) {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['purchase_items', purchaseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_items')
        .select('*, material:materials(name, unit)')
        .eq('purchase_id', purchaseId)
      if (error) throw error
      return data ?? []
    },
  })

  if (isLoading) return <p className="text-xs text-gray-400 py-1">Cargando materiales...</p>

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">Materiales comprados</p>
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
              <td className="py-0.5 text-right font-semibold text-gray-900">{formatCOP(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
