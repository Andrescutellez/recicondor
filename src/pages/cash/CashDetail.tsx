import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Plus, ChevronDown, ChevronRight, Package, Lock } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import { CashMovement } from '../../types'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { MovementTypeBadge } from '../../components/ui/Badge'
import { useAddCashMovement } from '../../hooks/useCash'
import { useAuth } from '../../hooks/useAuth'
import { formatCOP, formatDate, formatQty } from '../../lib/format'

const movementSchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: z.coerce.number().positive('Debe ser mayor a 0'),
  description: z.string().min(1, 'Requerido'),
})
type MovementForm = z.infer<typeof movementSchema>

export function CashDetail() {
  // ALL hooks must be at top level, before any conditional return
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [addOpen, setAddOpen] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const addMovement = useAddCashMovement()

  const { data: cashRegister } = useQuery({
    queryKey: ['cash_register', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_registers').select('*').eq('id', id).single()
      if (error) throw error
      return data
    },
    enabled: !!id && profile?.role !== 'operator',
  })

  const { data: movements = [], isLoading } = useQuery<CashMovement[]>({
    queryKey: ['cash_movements', id, dateFrom, dateTo],
    queryFn: async () => {
      let q = supabase
        .from('cash_movements')
        .select('*, user:profiles(name)')
        .eq('cash_register_id', id)
        .order('created_at', { ascending: false })

      if (dateFrom) q = q.gte('created_at', `${dateFrom}T00:00:00`)
      if (dateTo)   q = q.lte('created_at', `${dateTo}T23:59:59.999`)

      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
    enabled: !!id && profile?.role !== 'operator',
  })

  const { register: formRegister, handleSubmit, formState: { errors }, reset } = useForm<MovementForm>({
    resolver: zodResolver(movementSchema),
    defaultValues: { type: 'income', amount: 0, description: '' },
  })

  const onSubmit = async (data: MovementForm) => {
    if (!profile || !id) return
    try {
      await addMovement.mutateAsync({
        cash_register_id: id,
        type: data.type,
        amount: data.amount,
        description: data.description,
        user_id: profile.id,
      })
      setAddOpen(false)
      reset()
    } catch (err) {
      console.error(err)
    }
  }

  const toggleExpand = (movId: string) => setExpandedId(prev => prev === movId ? null : movId)

  // Role guard — rendered AFTER all hooks
  if (profile?.role === 'operator') {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-12 flex flex-col items-center gap-3 text-gray-400">
        <Lock className="w-10 h-10" />
        <p className="font-medium text-gray-600">Sin acceso al historial de caja</p>
        <button onClick={() => navigate('/cash')} className="text-sm text-green-600 hover:underline">
          Volver a Cajas
        </button>
      </div>
    )
  }

  const totalIn = movements
    .filter(m => m.type === 'income' || m.type === 'transfer_in')
    .reduce((s, m) => s + m.amount, 0)
  const totalOut = movements
    .filter(m => m.type === 'expense' || m.type === 'transfer_out')
    .reduce((s, m) => s + m.amount, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />} onClick={() => navigate('/cash')}>
            Volver
          </Button>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{cashRegister?.name ?? 'Caja'}</h2>
            <p className={`text-2xl font-bold ${(cashRegister?.balance ?? 0) < 0 ? 'text-red-600' : 'text-green-700'}`}>
              {cashRegister ? formatCOP(cashRegister.balance) : '—'}
            </p>
          </div>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setAddOpen(true)}>
          Movimiento Manual
        </Button>
      </div>

      {/* Period summary */}
      {movements.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <p className="text-xs text-gray-500 mb-1">Ingresos (período)</p>
            <p className="text-lg font-bold text-green-700">+{formatCOP(totalIn)}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500 mb-1">Egresos (período)</p>
            <p className="text-lg font-bold text-red-600">-{formatCOP(totalOut)}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500 mb-1">Flujo neto</p>
            <p className={`text-lg font-bold ${totalIn - totalOut >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
              {formatCOP(totalIn - totalOut)}
            </p>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <div className="flex gap-4 items-end">
          <Input label="Desde" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <Input label="Hasta" type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)} />
          <Button variant="secondary" onClick={() => { setDateFrom(''); setDateTo('') }}>Limpiar</Button>
        </div>
      </Card>

      {/* Movements table with expandable inventory detail */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {isLoading ? (
          <p className="px-6 py-8 text-sm text-gray-400 text-center">Cargando...</p>
        ) : movements.length === 0 ? (
          <p className="px-6 py-8 text-sm text-gray-400 text-center">No hay movimientos para este período</p>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-8" />
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Descripción</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Referencia</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Usuario</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {movements.map((m) => {
                const hasInventory = m.reference_type === 'purchase' || m.reference_type === 'sale'
                return (
                  <>
                    <tr
                      key={m.id}
                      className={`hover:bg-gray-50 ${hasInventory ? 'cursor-pointer' : ''}`}
                      onClick={() => hasInventory && toggleExpand(m.id)}
                    >
                      <td className="pl-4 py-3 text-gray-300">
                        {hasInventory && (
                          expandedId === m.id
                            ? <ChevronDown className="w-4 h-4 text-gray-400" />
                            : <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{formatDate(m.created_at)}</td>
                      <td className="px-4 py-3"><MovementTypeBadge type={m.type} /></td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {m.description ?? '—'}
                        {hasInventory && (
                          <span className="ml-2 inline-flex items-center gap-0.5 text-xs text-blue-500">
                            <Package className="w-3 h-3" /> inventario
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 capitalize">{m.reference_type ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {(m.user as { name: string } | undefined)?.name ?? '—'}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${
                        m.type === 'income' || m.type === 'transfer_in' ? 'text-green-700' : 'text-red-700'
                      }`}>
                        {m.type === 'income' || m.type === 'transfer_in' ? '+' : '-'}
                        {formatCOP(m.amount)}
                      </td>
                    </tr>
                    {expandedId === m.id && m.reference_id && (
                      <tr key={`${m.id}-inv`}>
                        <td colSpan={7} className="bg-blue-50 px-10 py-3">
                          <MovementInventoryDetail
                            referenceId={m.reference_id}
                            referenceType={m.reference_type!}
                          />
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add movement modal */}
      <Modal open={addOpen} onClose={() => { setAddOpen(false); reset() }} title="Movimiento Manual">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Select
            label="Tipo"
            options={[
              { value: 'income', label: 'Ingreso' },
              { value: 'expense', label: 'Egreso' },
            ]}
            error={errors.type?.message}
            {...formRegister('type')}
          />
          <Input
            label="Monto"
            type="number"
            step="1"
            min="1"
            placeholder="0"
            error={errors.amount?.message}
            {...formRegister('amount')}
          />
          <Input
            label="Descripción"
            placeholder="Motivo del movimiento"
            required
            error={errors.description?.message}
            {...formRegister('description')}
          />
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" fullWidth onClick={() => { setAddOpen(false); reset() }} type="button">
              Cancelar
            </Button>
            <Button fullWidth loading={addMovement.isPending} type="submit">
              Registrar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function MovementInventoryDetail({ referenceId, referenceType }: { referenceId: string; referenceType: string }) {
  const isPurchase = referenceType === 'purchase'
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['movement_items', referenceType, referenceId],
    queryFn: async () => {
      if (isPurchase) {
        const { data, error } = await supabase.from('purchase_items')
          .select('*, material:materials(name, unit)').eq('purchase_id', referenceId)
        if (error) throw error
        return data ?? []
      } else {
        const { data, error } = await supabase.from('sale_items')
          .select('*, material:materials(name, unit)').eq('sale_id', referenceId)
        if (error) throw error
        return data ?? []
      }
    },
  })

  if (isLoading) return <p className="text-xs text-gray-400 py-1">Cargando inventario...</p>

  return (
    <div>
      <p className="text-xs font-semibold text-blue-700 mb-2 uppercase flex items-center gap-1">
        <Package className="w-3 h-3" />
        {isPurchase ? 'Materiales recibidos en inventario' : 'Materiales salidos de inventario'}
      </p>
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
              <td className={`pr-6 py-0.5 text-right font-semibold ${isPurchase ? 'text-green-700' : 'text-red-600'}`}>
                {isPurchase ? '+' : '-'}{formatQty(item.quantity, item.material?.unit ?? 'kg')}
              </td>
              <td className="pr-6 py-0.5 text-right text-gray-600">{formatCOP(item.price_per_unit)}</td>
              <td className="py-0.5 text-right font-semibold text-gray-900">{formatCOP(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
