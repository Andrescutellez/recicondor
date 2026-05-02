import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import { AdjustmentType } from '../../types'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Card } from '../../components/ui/Card'
import { useAuth } from '../../hooks/useAuth'
import { Lock } from 'lucide-react'

const adjustmentSchema = z.object({
  type: z.enum(['loss', 'gain', 'correction', 'conversion', 'shrinkage']),
  material_id: z.string().min(1, 'Requerido'),
  quantity: z.coerce.number().positive('Debe ser mayor a 0'),
  reason: z.string().min(3, 'Mínimo 3 caracteres'),
  notes: z.string().optional(),
})

type AdjFormData = z.infer<typeof adjustmentSchema>

const typeDescriptions: Record<AdjustmentType, { label: string; description: string; effect: string }> = {
  loss: {
    label: 'Pérdida',
    description: 'Material perdido, dañado o extraviado',
    effect: 'Reduce el inventario',
  },
  gain: {
    label: 'Ganancia',
    description: 'Material encontrado o sobrante no registrado',
    effect: 'Aumenta el inventario',
  },
  correction: {
    label: 'Corrección',
    description: 'Ajuste por error de pesaje o registro incorrecto',
    effect: 'Puede aumentar o reducir según cantidad ingresada',
  },
  conversion: {
    label: 'Conversión',
    description: 'Material se transforma en otro material (ej: papel → cartón procesado)',
    effect: 'Reduce el material origen',
  },
  shrinkage: {
    label: 'Merma',
    description: 'Reducción natural por secado, evaporación u otros procesos',
    effect: 'Reduce el inventario',
  },
}

const movementTypeMap: Record<AdjustmentType, string> = {
  loss: 'adjustment_loss',
  gain: 'adjustment_gain',
  correction: 'adjustment_correction',
  conversion: 'conversion_out',
  shrinkage: 'shrinkage',
}

export function AdjustmentForm() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [submitError, setSubmitError] = useState('')

  const { data: materials = [] } = useQuery({
    queryKey: ['materials'],
    queryFn: async () => {
      const { data } = await supabase.from('materials').select('id, name, unit').eq('active', true).order('name')
      return data ?? []
    },
  })

  const { register, handleSubmit, watch, formState: { errors } } = useForm<AdjFormData>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: { type: 'loss', quantity: 0, reason: '' },
  })

  const selectedType = watch('type') as AdjustmentType
  const typeInfo = typeDescriptions[selectedType]

  const createAdjustment = useMutation({
    mutationFn: async (data: AdjFormData) => {
      // Create adjustment record
      const { data: adj, error: adjError } = await supabase
        .from('inventory_adjustments')
        .insert({
          type: data.type,
          material_id: data.material_id,
          quantity: data.quantity,
          reason: data.reason,
          notes: data.notes || null,
          user_id: profile?.id,
        })
        .select()
        .single()
      if (adjError) throw adjError

      // Get current inventory
      const { data: inv } = await supabase
        .from('inventory')
        .select('quantity, avg_cost')
        .eq('material_id', data.material_id)
        .single()

      const currentQty = inv?.quantity ?? 0
      const isNegative = ['loss', 'conversion', 'shrinkage'].includes(data.type)
      const delta = isNegative ? -data.quantity : data.quantity
      const newQty = currentQty + delta

      // Update inventory
      const { error: invError } = await supabase
        .from('inventory')
        .upsert(
          { material_id: data.material_id, quantity: newQty, updated_at: new Date().toISOString() },
          { onConflict: 'material_id' }
        )
      if (invError) throw invError

      // Record kardex movement
      const { error: mvError } = await supabase.from('inventory_movements').insert({
        material_id: data.material_id,
        type: movementTypeMap[data.type],
        quantity: delta,
        cost_per_unit: inv?.avg_cost ?? 0,
        balance_after: newQty,
        reference_id: adj.id,
        reference_type: 'adjustment',
        reason: data.reason,
        user_id: profile?.id,
      })
      if (mvError) throw mvError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      queryClient.invalidateQueries({ queryKey: ['kardex'] })
      navigate('/inventory')
    },
    onError: (err: Error) => setSubmitError(err.message),
  })

  const matOptions = materials.map((m: { id: string; name: string; unit: string }) => ({
    value: m.id,
    label: `${m.name} (${m.unit})`,
  }))

  // Role guard — after all hooks
  if (profile?.role === 'operator') {
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 py-8 text-gray-400">
          <Lock className="w-10 h-10" />
          <p className="font-medium text-gray-600">Solo los administradores pueden realizar ajustes de inventario</p>
          <Button variant="secondary" onClick={() => navigate('/inventory')}>Volver al Inventario</Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />} onClick={() => navigate('/inventory')}>
          Volver
        </Button>
        <h2 className="text-lg font-semibold text-gray-900">Nuevo Ajuste de Inventario</h2>
      </div>

      <form onSubmit={handleSubmit(data => createAdjustment.mutate(data))} className="space-y-4">
        {/* Type selection */}
        <Card>
          <Select
            label="Tipo de ajuste"
            options={Object.entries(typeDescriptions).map(([v, d]) => ({ value: v, label: d.label }))}
            error={errors.type?.message}
            {...register('type')}
          />
          {typeInfo && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm font-medium text-blue-800">{typeInfo.label}</p>
              <p className="text-xs text-blue-600 mt-0.5">{typeInfo.description}</p>
              <p className="text-xs text-blue-700 mt-1 font-medium">Efecto: {typeInfo.effect}</p>
            </div>
          )}
        </Card>

        {/* Details */}
        <Card>
          <div className="space-y-4">
            <Select
              label="Material"
              options={matOptions}
              placeholder="Seleccionar material"
              required
              error={errors.material_id?.message}
              {...register('material_id')}
            />
            <Input
              label="Cantidad"
              type="number"
              step="0.001"
              min="0.001"
              placeholder="0.000"
              required
              error={errors.quantity?.message}
              hint={`Ingrese la cantidad a ${['loss', 'conversion', 'shrinkage'].includes(selectedType) ? 'descontar' : 'agregar'}`}
              {...register('quantity')}
            />
            <Input
              label="Motivo"
              placeholder="Descripción del ajuste"
              required
              error={errors.reason?.message}
              {...register('reason')}
            />
            <Input
              label="Notas adicionales (opcional)"
              placeholder="Observaciones"
              {...register('notes')}
            />
          </div>
        </Card>

        {submitError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {submitError}
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => navigate('/inventory')} type="button">
            Cancelar
          </Button>
          <Button
            size="lg"
            icon={<CheckCircle className="w-5 h-5" />}
            loading={createAdjustment.isPending}
            type="submit"
          >
            Registrar Ajuste
          </Button>
        </div>
      </form>
    </div>
  )
}
