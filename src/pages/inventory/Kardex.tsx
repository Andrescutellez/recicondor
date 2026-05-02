import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { InventoryMovement } from '../../types'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { MovementTypeBadge } from '../../components/ui/Badge'
import { formatCOP, formatDate, formatQty } from '../../lib/format'

export function Kardex() {
  const { materialId } = useParams<{ materialId: string }>()
  const navigate = useNavigate()

  const { data: material } = useQuery({
    queryKey: ['material', materialId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .eq('id', materialId)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!materialId,
  })

  const { data: inventory } = useQuery({
    queryKey: ['inventory_item', materialId],
    queryFn: async () => {
      const { data } = await supabase
        .from('inventory')
        .select('*')
        .eq('material_id', materialId)
        .single()
      return data
    },
    enabled: !!materialId,
  })

  const { data: movements = [], isLoading } = useQuery<InventoryMovement[]>({
    queryKey: ['kardex', materialId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_movements')
        .select('*, user:profiles(name)')
        .eq('material_id', materialId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!materialId,
  })

  const unit = material?.unit ?? 'kg'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />} onClick={() => navigate('/inventory')}>
          Volver
        </Button>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Kardex — {material?.name ?? '...'}
          </h2>
          <p className="text-sm text-gray-500">Historial completo de movimientos</p>
        </div>
      </div>

      {/* Current state */}
      {inventory && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card>
            <p className="text-sm text-gray-500">Cantidad actual</p>
            <p className={`text-2xl font-bold mt-1 ${inventory.quantity < 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {formatQty(inventory.quantity, unit)}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Costo promedio</p>
            <p className="text-2xl font-bold mt-1 text-gray-900">{formatCOP(inventory.avg_cost)}/{unit}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Valor total</p>
            <p className="text-2xl font-bold mt-1 text-green-700">
              {formatCOP(inventory.quantity * inventory.avg_cost)}
            </p>
          </Card>
        </div>
      )}

      {/* Movements */}
      <Card padding={false}>
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Movimientos ({movements.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Cantidad</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Costo Unit.</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Saldo</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Motivo</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Usuario</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-50">
              {isLoading ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-400">Cargando...</td></tr>
              ) : movements.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-400">No hay movimientos</td></tr>
              ) : (
                movements.map((mv, idx) => (
                  <tr key={mv.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-6 py-3 text-xs text-gray-500">{formatDate(mv.created_at)}</td>
                    <td className="px-6 py-3"><MovementTypeBadge type={mv.type} /></td>
                    <td className={`px-6 py-3 text-right font-semibold ${mv.quantity >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {mv.quantity >= 0 ? '+' : ''}{formatQty(mv.quantity, unit)}
                    </td>
                    <td className="px-6 py-3 text-right text-gray-700">
                      {mv.cost_per_unit != null ? formatCOP(mv.cost_per_unit) : '—'}
                    </td>
                    <td className="px-6 py-3 text-right font-semibold text-gray-900">
                      {mv.balance_after != null ? formatQty(mv.balance_after, unit) : '—'}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">{mv.reason ?? '—'}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {(mv.user as { name: string } | undefined)?.name ?? '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
