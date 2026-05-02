import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, ArrowLeftRight, Wallet, Trash2, PlusCircle } from 'lucide-react'
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
import { useCashTransfer, useAddCashMovement, useDeleteCashRegister } from '../../hooks/useCash'
import { formatCOP } from '../../lib/format'
import { useAuth } from '../../hooks/useAuth'

const transferSchema = z.object({
  from_register_id: z.string().min(1, 'Requerido'),
  to_register_id:   z.string().min(1, 'Requerido'),
  amount:           z.coerce.number().positive('Debe ser mayor a 0'),
  description:      z.string().optional(),
}).refine(d => d.from_register_id !== d.to_register_id, {
  message: 'Las cajas deben ser diferentes',
  path: ['to_register_id'],
})
type TransferFormData = z.infer<typeof transferSchema>

const incomeSchema = z.object({
  amount:      z.coerce.number().positive('Debe ser mayor a 0'),
  description: z.string().min(1, 'Requerido'),
})
type IncomeFormData = z.infer<typeof incomeSchema>

export function CashList() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const [transferOpen,    setTransferOpen]    = useState(false)
  const [newRegisterOpen, setNewRegisterOpen] = useState(false)
  const [incomeTarget,    setIncomeTarget]    = useState<CashRegister | null>(null)
  const [deleteTarget,    setDeleteTarget]    = useState<CashRegister | null>(null)

  const transfer   = useCashTransfer()
  const addMovement = useAddCashMovement()
  const deleteMut   = useDeleteCashRegister()

  const { data: registers = [], isLoading } = useQuery<CashRegister[]>({
    queryKey: ['cash_registers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_registers').select('*, operator:profiles(name)').eq('active', true).order('name')
      if (error) throw error
      return data ?? []
    },
  })

  // Transfer form
  const {
    register: tReg, handleSubmit: tSubmit, formState: { errors: tErr }, reset: tReset,
  } = useForm<TransferFormData>({ resolver: zodResolver(transferSchema) })

  const onTransfer = async (data: TransferFormData) => {
    try {
      await transfer.mutateAsync({ from_register_id: data.from_register_id, to_register_id: data.to_register_id, amount: data.amount, description: data.description ?? '' })
      setTransferOpen(false); tReset()
    } catch (err) { console.error(err) }
  }

  // Income form
  const {
    register: iReg, handleSubmit: iSubmit, formState: { errors: iErr }, reset: iReset,
  } = useForm<IncomeFormData>({ resolver: zodResolver(incomeSchema) })

  const onIncome = async (data: IncomeFormData) => {
    if (!incomeTarget || !profile) return
    try {
      await addMovement.mutateAsync({
        cash_register_id: incomeTarget.id,
        type: 'income',
        amount: data.amount,
        description: data.description,
        user_id: profile.id,
        reference_type: 'manual',
      })
      setIncomeTarget(null); iReset()
    } catch (err) { console.error(err) }
  }

  const regOptions   = registers.map(r => ({ value: r.id, label: r.name }))
  const totalBalance = registers.reduce((s, r) => s + r.balance, 0)

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-gray-500">
          Total en cajas: <span className="font-bold text-gray-900 text-base">{formatCOP(totalBalance)}</span>
        </p>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" icon={<ArrowLeftRight className="w-4 h-4" />} onClick={() => setTransferOpen(true)}>
              Transferir
            </Button>
            <Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setNewRegisterOpen(true)}>
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
            <Card key={reg.id} className="flex flex-col gap-3">
              <div className="flex items-start justify-between">
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

              <p className={`text-2xl font-bold ${reg.balance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {formatCOP(reg.balance)}
              </p>

              <div className="flex gap-2">
                <Button variant="ghost" size="sm" fullWidth onClick={() => navigate(`/cash/${reg.id}`)}>
                  Ver movimientos
                </Button>
                {isAdmin && (
                  <>
                    <Button
                      variant="secondary" size="sm"
                      icon={<PlusCircle className="w-4 h-4" />}
                      onClick={() => setIncomeTarget(reg)}
                      title="Ingresar dinero"
                    >
                      Ingresar
                    </Button>
                    <button
                      onClick={() => setDeleteTarget(reg)}
                      className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Eliminar caja"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Transfer Modal */}
      <Modal open={transferOpen} onClose={() => { setTransferOpen(false); tReset() }} title="Transferir entre Cajas">
        <form onSubmit={tSubmit(onTransfer)} className="space-y-4">
          <Select label="Desde" options={regOptions} placeholder="Seleccionar caja origen" error={tErr.from_register_id?.message} {...tReg('from_register_id')} />
          <Select label="Hacia" options={regOptions} placeholder="Seleccionar caja destino" error={tErr.to_register_id?.message} {...tReg('to_register_id')} />
          <Input label="Monto" type="number" step="1" min="1" placeholder="0" error={tErr.amount?.message} {...tReg('amount')} />
          <Input label="Descripción (opcional)" placeholder="Motivo de la transferencia" {...tReg('description')} />
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" fullWidth onClick={() => { setTransferOpen(false); tReset() }} type="button">Cancelar</Button>
            <Button fullWidth loading={transfer.isPending} type="submit">Transferir</Button>
          </div>
        </form>
      </Modal>

      {/* Income Modal */}
      <Modal
        open={!!incomeTarget}
        onClose={() => { setIncomeTarget(null); iReset() }}
        title={`Ingresar dinero — ${incomeTarget?.name ?? ''}`}
      >
        <form onSubmit={iSubmit(onIncome)} className="space-y-4">
          <p className="text-sm text-gray-500">
            Saldo actual: <span className="font-semibold text-gray-900">{formatCOP(incomeTarget?.balance ?? 0)}</span>
          </p>
          <Input label="Monto a ingresar" type="number" inputMode="numeric" step="1" min="1" placeholder="0" error={iErr.amount?.message} {...iReg('amount')} />
          <Input label="Descripción" placeholder="Ej: envio Diego" required error={iErr.description?.message} {...iReg('description')} />
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" fullWidth onClick={() => { setIncomeTarget(null); iReset() }} type="button">Cancelar</Button>
            <Button fullWidth loading={addMovement.isPending} type="submit">Registrar ingreso</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Eliminar Caja">
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            ¿Seguro que deseas eliminar <span className="font-semibold">{deleteTarget?.name}</span>?
            Los movimientos históricos se conservan.
          </p>
          {(deleteTarget?.balance ?? 0) !== 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              ⚠️ Esta caja tiene un saldo de <strong>{formatCOP(deleteTarget?.balance ?? 0)}</strong>.
              Asegúrate de transferirlo antes de eliminarla.
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" fullWidth onClick={() => setDeleteTarget(null)} type="button">Cancelar</Button>
            <Button
              variant="danger" fullWidth
              loading={deleteMut.isPending}
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}
            >
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>

      {/* New Register Modal */}
      <NewRegisterModal open={newRegisterOpen} onClose={() => setNewRegisterOpen(false)} />
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
      const { data: reg, error } = await supabase.from('cash_registers')
        .insert({ name: data.name, type: data.type, operator_id: data.operator_id || null, balance: 0 })
        .select().single()
      if (error) throw error
      if (data.initial_balance > 0 && reg) {
        await supabase.from('cash_movements').insert({
          cash_register_id: reg.id, type: 'income', amount: data.initial_balance,
          reference_type: 'manual', description: 'Saldo inicial',
        })
      }
      reset(); onClose()
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nueva Caja Registradora">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Nombre" placeholder="Ej: Caja Principal" required error={errors.name?.message} {...register('name', { required: true })} />
        <Select label="Tipo" options={[{ value: 'main', label: 'Principal' }, { value: 'operator', label: 'Operador' }]} {...register('type')} />
        <Select
          label="Operador asignado (opcional)"
          options={operators.map((o: { id: string; name: string }) => ({ value: o.id, label: o.name }))}
          placeholder="Sin asignar"
          {...register('operator_id')}
        />
        <Input label="Saldo inicial" type="number" step="1" min="0" defaultValue={0} {...register('initial_balance')} />
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" fullWidth onClick={onClose} type="button">Cancelar</Button>
          <Button fullWidth loading={loading} type="submit">Crear Caja</Button>
        </div>
      </form>
    </Modal>
  )
}
