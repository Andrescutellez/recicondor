import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, ArrowLeftRight, Wallet } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import { CashRegister } from '../../types'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { useCashTransfer } from '../../hooks/useCash'
import { formatCOP } from '../../lib/format'
import { useAuth } from '../../hooks/useAuth'

const transferSchema = z.object({
  from_register_id: z.string().min(1, 'Requerido'),
  to_register_id: z.string().min(1, 'Requerido'),
  amount: z.coerce.number().positive('Debe ser mayor a 0'),
  description: z.string().optional(),
}).refine(d => d.from_register_id !== d.to_register_id, {
  message: 'Las cajas deben ser diferentes',
  path: ['to_register_id'],
})

type TransferFormData = z.infer<typeof transferSchema>

export function CashList() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [transferOpen, setTransferOpen] = useState(false)
  const [newRegisterOpen, setNewRegisterOpen] = useState(false)
  const transfer = useCashTransfer()

  const { data: registers = [], isLoading } = useQuery<CashRegister[]>({
    queryKey: ['cash_registers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_registers')
        .select('*, operator:profiles(name)')
        .eq('active', true)
        .order('name')
      if (error) throw error
      return data ?? []
    },
  })

  const { register, handleSubmit, formState: { errors }, reset } = useForm<TransferFormData>({
    resolver: zodResolver(transferSchema),
  })

  const onTransfer = async (data: TransferFormData) => {
    try {
      await transfer.mutateAsync({
        from_register_id: data.from_register_id,
        to_register_id: data.to_register_id,
        amount: data.amount,
        description: data.description ?? '',
      })
      setTransferOpen(false)
      reset()
    } catch (err) {
      console.error(err)
    }
  }

  const regOptions = registers.map(r => ({ value: r.id, label: r.name }))
  const totalBalance = registers.reduce((s, r) => s + r.balance, 0)

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">
            Total en cajas: <span className="font-bold text-gray-900 text-base">{formatCOP(totalBalance)}</span>
          </p>
        </div>
        {profile?.role === 'admin' && (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              icon={<ArrowLeftRight className="w-4 h-4" />}
              onClick={() => setTransferOpen(true)}
            >
              Transferir
            </Button>
            <Button
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setNewRegisterOpen(true)}
            >
              Nueva Caja
            </Button>
          </div>
        )}
      </div>

      {/* Registers grid */}
      {isLoading ? (
        <p className="text-gray-400 text-sm">Cargando...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {registers.map((reg) => (
            <Card key={reg.id}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${reg.type === 'main' ? 'bg-green-100' : 'bg-blue-100'}`}>
                    <Wallet className={`w-5 h-5 ${reg.type === 'main' ? 'text-green-600' : 'text-blue-600'}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{reg.name}</h3>
                    {reg.operator && (
                      <p className="text-xs text-gray-500">{(reg.operator as { name: string }).name}</p>
                    )}
                  </div>
                </div>
                <Badge color={reg.type === 'main' ? 'green' : 'blue'}>
                  {reg.type === 'main' ? 'Principal' : 'Operador'}
                </Badge>
              </div>

              <p className={`text-2xl font-bold mb-4 ${reg.balance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {formatCOP(reg.balance)}
              </p>

              <Button
                variant="ghost"
                size="sm"
                fullWidth
                onClick={() => navigate(`/cash/${reg.id}`)}
              >
                Ver movimientos
              </Button>
            </Card>
          ))}
        </div>
      )}

      {/* Transfer Modal */}
      <Modal open={transferOpen} onClose={() => { setTransferOpen(false); reset() }} title="Transferir entre Cajas">
        <form onSubmit={handleSubmit(onTransfer)} className="space-y-4">
          <Select
            label="Desde"
            options={regOptions}
            placeholder="Seleccionar caja origen"
            error={errors.from_register_id?.message}
            {...register('from_register_id')}
          />
          <Select
            label="Hacia"
            options={regOptions}
            placeholder="Seleccionar caja destino"
            error={errors.to_register_id?.message}
            {...register('to_register_id')}
          />
          <Input
            label="Monto"
            type="number"
            step="1"
            min="1"
            placeholder="0"
            error={errors.amount?.message}
            {...register('amount')}
          />
          <Input
            label="Descripción (opcional)"
            placeholder="Motivo de la transferencia"
            {...register('description')}
          />
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" fullWidth onClick={() => { setTransferOpen(false); reset() }} type="button">
              Cancelar
            </Button>
            <Button fullWidth loading={transfer.isPending} type="submit">
              Transferir
            </Button>
          </div>
        </form>
      </Modal>

      {/* New Register Modal */}
      <NewRegisterModal
        open={newRegisterOpen}
        onClose={() => setNewRegisterOpen(false)}
      />
    </div>
  )
}

function NewRegisterModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(false)
  const { data: operators = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, name').eq('active', true)
      return data ?? []
    },
  })

  const { register, handleSubmit, formState: { errors }, reset } = useForm({
    defaultValues: { name: '', type: 'operator', operator_id: '', initial_balance: 0 },
  })

  const onSubmit = async (data: { name: string; type: string; operator_id: string; initial_balance: number }) => {
    setLoading(true)
    try {
      const { data: reg, error } = await supabase
        .from('cash_registers')
        .insert({
          name: data.name,
          type: data.type,
          operator_id: data.operator_id || null,
          balance: 0,
        })
        .select()
        .single()
      if (error) throw error

      if (data.initial_balance > 0 && reg) {
        await supabase.from('cash_movements').insert({
          cash_register_id: reg.id,
          type: 'income',
          amount: data.initial_balance,
          reference_type: 'manual',
          description: 'Saldo inicial',
        })
      }
      reset()
      onClose()
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nueva Caja Registradora">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Nombre" placeholder="Ej: Caja Principal" required error={errors.name?.message} {...register('name', { required: true })} />
        <Select
          label="Tipo"
          options={[{ value: 'main', label: 'Principal' }, { value: 'operator', label: 'Operador' }]}
          {...register('type')}
        />
        <Select
          label="Operador asignado (opcional)"
          options={operators.map((o: { id: string; name: string }) => ({ value: o.id, label: o.name }))}
          placeholder="Sin asignar"
          {...register('operator_id')}
        />
        <Input
          label="Saldo inicial"
          type="number"
          step="1"
          min="0"
          defaultValue={0}
          {...register('initial_balance')}
        />
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" fullWidth onClick={onClose} type="button">Cancelar</Button>
          <Button fullWidth loading={loading} type="submit">Crear Caja</Button>
        </div>
      </form>
    </Modal>
  )
}
