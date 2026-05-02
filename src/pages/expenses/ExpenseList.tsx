import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import { Expense, ExpenseCategory } from '../../types'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Card } from '../../components/ui/Card'
import { Table, Column } from '../../components/ui/Table'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { useAuth } from '../../hooks/useAuth'
import { formatCOP, formatDate } from '../../lib/format'

const expenseSchema = z.object({
  category: z.enum(['salary', 'transport', 'supplies', 'maintenance', 'other']),
  description: z.string().min(3, 'Mínimo 3 caracteres'),
  amount: z.coerce.number().positive('Debe ser mayor a 0'),
  cash_register_id: z.string().min(1, 'Requerido'),
  date: z.string().min(1, 'Requerido'),
})

type ExpenseForm = z.infer<typeof expenseSchema>

const categoryLabels: Record<ExpenseCategory, { label: string; color: 'blue' | 'orange' | 'green' | 'yellow' | 'gray' }> = {
  salary: { label: 'Salario', color: 'blue' },
  transport: { label: 'Transporte', color: 'orange' },
  supplies: { label: 'Insumos', color: 'green' },
  maintenance: { label: 'Mantenimiento', color: 'yellow' },
  other: { label: 'Otro', color: 'gray' },
}

export function ExpenseList() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [category, setCategory] = useState('')

  const { data: cashRegisters = [] } = useQuery({
    queryKey: ['cash_registers'],
    queryFn: async () => {
      const { data } = await supabase.from('cash_registers').select('id, name').eq('active', true)
      return data ?? []
    },
  })

  const { data: expenses = [], isLoading } = useQuery<Expense[]>({
    queryKey: ['expenses', dateFrom, dateTo, category],
    queryFn: async () => {
      let q = supabase
        .from('expenses')
        .select('*, cash_register:cash_registers(name), user:profiles(name)')
        .order('date', { ascending: false })

      if (dateFrom) q = q.gte('date', new Date(dateFrom).toISOString())
      if (dateTo) {
        const end = new Date(dateTo)
        end.setHours(23, 59, 59, 999)
        q = q.lte('date', end.toISOString())
      }
      if (category) q = q.eq('category', category)

      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
  })

  const { register, handleSubmit, formState: { errors }, reset } = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      category: 'other',
      date: new Date().toISOString().split('T')[0],
    },
  })

  const createExpense = useMutation({
    mutationFn: async (data: ExpenseForm) => {
      const { data: expense, error } = await supabase
        .from('expenses')
        .insert({
          ...data,
          user_id: profile?.id,
          date: new Date(data.date).toISOString(),
        })
        .select()
        .single()
      if (error) throw error

      // Record cash movement
      await supabase.from('cash_movements').insert({
        cash_register_id: data.cash_register_id,
        type: 'expense',
        amount: data.amount,
        reference_type: 'expense',
        reference_id: expense.id,
        description: data.description,
        user_id: profile?.id,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['cash_registers'] })
      setAddOpen(false)
      reset()
    },
  })

  const totalShown = expenses.reduce((s, e) => s + e.amount, 0)

  const columns: Column<Expense>[] = [
    {
      key: 'date',
      header: 'Fecha',
      render: (row) => <span className="text-xs">{formatDate(row.date)}</span>,
    },
    {
      key: 'category',
      header: 'Categoría',
      render: (row) => {
        const cat = categoryLabels[row.category]
        return <Badge color={cat?.color ?? 'gray'}>{cat?.label ?? row.category}</Badge>
      },
    },
    {
      key: 'description',
      header: 'Descripción',
      render: (row) => row.description,
    },
    {
      key: 'cash_register',
      header: 'Caja',
      render: (row) => (row.cash_register as { name: string } | undefined)?.name ?? '—',
    },
    {
      key: 'user',
      header: 'Registrado por',
      render: (row) => (row.user as { name: string } | undefined)?.name ?? '—',
    },
    {
      key: 'amount',
      header: 'Monto',
      headerClassName: 'text-right',
      className: 'text-right font-semibold text-red-700',
      render: (row) => formatCOP(row.amount),
    },
  ]

  const cashOptions = cashRegisters.map((r: { id: string; name: string }) => ({ value: r.id, label: r.name }))
  const categoryOptions = Object.entries(categoryLabels).map(([v, d]) => ({ value: v, label: d.label }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Total gastos: <span className="font-bold text-red-700">{formatCOP(totalShown)}</span>
          {' '}({expenses.length} registros)
        </p>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setAddOpen(true)}>
          Registrar Gasto
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input type="date" label="Desde" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <Input type="date" label="Hasta" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          <Select
            label="Categoría"
            options={categoryOptions}
            placeholder="Todas las categorías"
            value={category}
            onChange={e => setCategory(e.target.value)}
          />
        </div>
      </div>

      <Table<Expense>
        columns={columns}
        data={expenses}
        loading={isLoading}
        emptyMessage="No hay gastos registrados"
        keyExtractor={row => row.id}
      />

      {/* Add expense modal */}
      <Modal open={addOpen} onClose={() => { setAddOpen(false); reset() }} title="Registrar Gasto">
        <form onSubmit={handleSubmit(data => createExpense.mutate(data))} className="space-y-4">
          <Select
            label="Categoría"
            options={categoryOptions}
            error={errors.category?.message}
            {...register('category')}
          />
          <Input
            label="Descripción"
            placeholder="Descripción del gasto"
            required
            error={errors.description?.message}
            {...register('description')}
          />
          <Input
            label="Monto"
            type="number"
            step="1"
            min="1"
            placeholder="0"
            required
            error={errors.amount?.message}
            {...register('amount')}
          />
          <Select
            label="Caja"
            options={cashOptions}
            placeholder="Seleccionar caja"
            required
            error={errors.cash_register_id?.message}
            {...register('cash_register_id')}
          />
          <Input
            label="Fecha"
            type="date"
            required
            error={errors.date?.message}
            {...register('date')}
          />
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" fullWidth onClick={() => { setAddOpen(false); reset() }} type="button">
              Cancelar
            </Button>
            <Button variant="danger" fullWidth loading={createExpense.isPending} type="submit">
              Registrar Gasto
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
