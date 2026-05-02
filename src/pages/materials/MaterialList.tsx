import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Power } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import { Material } from '../../types'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/Badge'
import { useAuth } from '../../hooks/useAuth'
import { formatDate } from '../../lib/format'

const materialSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  description: z.string().optional(),
  unit: z.enum(['kg', 'unidad', 'litro', 'tonelada']),
})

type MaterialForm = z.infer<typeof materialSchema>

export function MaterialList() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null)
  const isAdmin = profile?.role === 'admin'

  const { data: materials = [], isLoading } = useQuery<Material[]>({
    queryKey: ['materials_all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .order('name')
      if (error) throw error
      return data ?? []
    },
  })

  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<MaterialForm>({
    resolver: zodResolver(materialSchema),
    defaultValues: { unit: 'kg' },
  })

  const openCreate = () => {
    setEditingMaterial(null)
    reset({ name: '', description: '', unit: 'kg' })
    setFormOpen(true)
  }

  const openEdit = (mat: Material) => {
    setEditingMaterial(mat)
    setValue('name', mat.name)
    setValue('description', mat.description ?? '')
    setValue('unit', mat.unit as 'kg' | 'unidad' | 'litro' | 'tonelada')
    setFormOpen(true)
  }

  const saveMaterial = useMutation({
    mutationFn: async (data: MaterialForm) => {
      if (editingMaterial) {
        const { error } = await supabase
          .from('materials')
          .update({ name: data.name, description: data.description || null, unit: data.unit })
          .eq('id', editingMaterial.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('materials').insert({
          name: data.name,
          description: data.description || null,
          unit: data.unit,
          created_by: profile?.id,
        })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials_all'] })
      queryClient.invalidateQueries({ queryKey: ['materials'] })
      setFormOpen(false)
      reset()
    },
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('materials').update({ active: !active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials_all'] })
      queryClient.invalidateQueries({ queryKey: ['materials'] })
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {materials.filter(m => m.active).length} materiales activos · {materials.length} total
        </p>
        {isAdmin && (
          <Button icon={<Plus className="w-4 h-4" />} onClick={openCreate}>
            Nuevo Material
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">Cargando materiales...</p>
      ) : (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Descripción</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Unidad</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Creado</th>
                  {isAdmin && <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Acciones</th>}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-50">
                {materials.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-400">
                      No hay materiales creados
                    </td>
                  </tr>
                ) : (
                  materials.map((mat, idx) => (
                    <tr key={mat.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} ${!mat.active ? 'opacity-60' : ''}`}>
                      <td className="px-6 py-3 font-medium text-gray-900">{mat.name}</td>
                      <td className="px-6 py-3 text-sm text-gray-500">{mat.description ?? '—'}</td>
                      <td className="px-6 py-3 text-center">
                        <Badge color="blue">{mat.unit}</Badge>
                      </td>
                      <td className="px-6 py-3 text-center">
                        <Badge color={mat.active ? 'green' : 'gray'}>
                          {mat.active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </td>
                      <td className="px-6 py-3 text-xs text-gray-400">{formatDate(mat.created_at)}</td>
                      {isAdmin && (
                        <td className="px-6 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<Pencil className="w-3 h-3" />}
                              onClick={() => openEdit(mat)}
                            >
                              Editar
                            </Button>
                            <Button
                              variant={mat.active ? 'secondary' : 'ghost'}
                              size="sm"
                              icon={<Power className="w-3 h-3" />}
                              onClick={() => toggleActive.mutate({ id: mat.id, active: mat.active })}
                            >
                              {mat.active ? 'Desactivar' : 'Activar'}
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Form modal */}
      <Modal
        open={formOpen}
        onClose={() => { setFormOpen(false); reset() }}
        title={editingMaterial ? 'Editar Material' : 'Nuevo Material'}
      >
        <form onSubmit={handleSubmit(data => saveMaterial.mutate(data))} className="space-y-4">
          <Input
            label="Nombre"
            placeholder="Ej: Cartón, Cobre, PET"
            required
            error={errors.name?.message}
            {...register('name')}
          />
          <Input
            label="Descripción (opcional)"
            placeholder="Descripción del material"
            {...register('description')}
          />
          <Select
            label="Unidad de medida"
            options={[
              { value: 'kg', label: 'Kilogramos (kg)' },
              { value: 'unidad', label: 'Unidad' },
              { value: 'litro', label: 'Litros' },
              { value: 'tonelada', label: 'Toneladas' },
            ]}
            error={errors.unit?.message}
            {...register('unit')}
          />
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" fullWidth onClick={() => { setFormOpen(false); reset() }} type="button">
              Cancelar
            </Button>
            <Button fullWidth loading={saveMaterial.isPending} type="submit">
              {editingMaterial ? 'Guardar Cambios' : 'Crear Material'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
