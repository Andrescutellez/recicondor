import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { History, SlidersHorizontal } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Inventory } from '../../types'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { formatCOP, formatQty } from '../../lib/format'

export function InventoryList() {
  const navigate = useNavigate()

  const { data: inventory = [], isLoading } = useQuery<Inventory[]>({
    queryKey: ['inventory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select('*, material:materials(id, name, unit, active)')
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const totalValue = inventory.reduce((s, i) => s + i.quantity * i.avg_cost, 0)
  const active = inventory.filter(i => (i.material as { active: boolean } | undefined)?.active)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">
            Valor total del inventario:{' '}
            <span className="font-bold text-gray-900 text-lg">{formatCOP(totalValue)}</span>
          </p>
          <p className="text-xs text-gray-400">{active.length} materiales activos</p>
        </div>
        <Button
          variant="secondary"
          icon={<SlidersHorizontal className="w-4 h-4" />}
          onClick={() => navigate('/inventory/adjustments')}
        >
          Ajustes
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="text-sm text-gray-400">Cargando inventario...</p>
      ) : (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Material</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Cantidad</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Costo Prom.</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Valor Total</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Estado</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-50">
                {inventory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-400">
                      No hay inventario registrado
                    </td>
                  </tr>
                ) : (
                  inventory.map((inv, idx) => {
                    const mat = inv.material as { id: string; name: string; unit: string; active: boolean } | undefined
                    const isLow = inv.quantity <= 0
                    return (
                      <tr key={inv.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-green-50 transition-colors`}>
                        <td className="px-6 py-3 font-medium text-gray-900">
                          {mat?.name ?? '—'}
                          <span className="ml-2 text-xs text-gray-400">({mat?.unit ?? 'kg'})</span>
                        </td>
                        <td className={`px-6 py-3 text-right font-semibold ${isLow ? 'text-red-600' : 'text-gray-900'}`}>
                          {formatQty(inv.quantity, mat?.unit ?? 'kg')}
                        </td>
                        <td className="px-6 py-3 text-right text-gray-700">
                          {formatCOP(inv.avg_cost)}
                        </td>
                        <td className="px-6 py-3 text-right font-semibold text-gray-900">
                          {formatCOP(inv.quantity * inv.avg_cost)}
                        </td>
                        <td className="px-6 py-3 text-center">
                          {isLow ? (
                            <Badge color="red">Stock bajo</Badge>
                          ) : (
                            <Badge color="green">OK</Badge>
                          )}
                        </td>
                        <td className="px-6 py-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<History className="w-4 h-4" />}
                            onClick={() => navigate(`/inventory/kardex/${mat?.id}`)}
                          >
                            Kardex
                          </Button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
              {inventory.length > 0 && (
                <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                  <tr>
                    <td colSpan={3} className="px-6 py-4 font-semibold text-gray-700">TOTAL INVENTARIO</td>
                    <td className="px-6 py-4 text-right font-bold text-lg text-green-700">{formatCOP(totalValue)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
