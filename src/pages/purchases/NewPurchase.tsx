import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, ArrowLeft, CheckCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Material, Provider } from '../../types'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { useAuth } from '../../hooks/useAuth'
import { formatCOP, formatKg } from '../../lib/format'

interface LineItem {
  id: string
  material_id: string
  material_name: string
  quantity: number
  price_per_unit: number
  total: number
}

export function NewPurchase() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const queryClient = useQueryClient()

  const [operatorId, setOperatorId] = useState(profile?.id ?? '')
  const [providerId, setProviderId] = useState('')
  const [cashRegisterId, setCashRegisterId] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<LineItem[]>([])
  const [error, setError] = useState('')

  // Add item state
  const [selectedMaterialId, setSelectedMaterialId] = useState('')
  const [qty, setQty] = useState('')
  const [price, setPrice] = useState('')
  const qtyRef = useRef<HTMLInputElement>(null)
  const [newProviderOpen, setNewProviderOpen] = useState(false)

  const { data: operators = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, name').eq('active', true)
      return data ?? []
    },
  })

  const { data: materials = [] } = useQuery<Material[]>({
    queryKey: ['materials'],
    queryFn: async () => {
      const { data, error } = await supabase.from('materials').select('*').eq('active', true).order('name')
      if (error) throw error
      return data ?? []
    },
  })

  const { data: providers = [], refetch: refetchProviders } = useQuery<Provider[]>({
    queryKey: ['providers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('providers').select('*').eq('active', true).order('name')
      if (error) throw error
      return data ?? []
    },
  })

  const { data: cashRegisters = [] } = useQuery({
    queryKey: ['cash_registers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cash_registers').select('*').eq('active', true).order('name')
      if (error) throw error
      return data ?? []
    },
  })

  // When material changes, focus quantity
  useEffect(() => {
    if (selectedMaterialId) qtyRef.current?.focus()
  }, [selectedMaterialId])

  const addItem = () => {
    if (!selectedMaterialId || !qty || !price) return
    const mat = materials.find(m => m.id === selectedMaterialId)
    if (!mat) return
    const quantity = parseFloat(qty)
    const priceVal = parseFloat(price)
    if (isNaN(quantity) || isNaN(priceVal) || quantity <= 0 || priceVal <= 0) return

    const newItem: LineItem = {
      id: crypto.randomUUID(),
      material_id: selectedMaterialId,
      material_name: mat.name,
      quantity,
      price_per_unit: priceVal,
      total: quantity * priceVal,
    }

    // If material already in list, replace or accumulate
    setItems(prev => {
      const exists = prev.findIndex(i => i.material_id === selectedMaterialId)
      if (exists >= 0) {
        const updated = [...prev]
        updated[exists] = { ...updated[exists], quantity, price_per_unit: priceVal, total: quantity * priceVal }
        return updated
      }
      return [...prev, newItem]
    })
    setSelectedMaterialId('')
    setQty('')
    setPrice('')
  }

  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id))

  const grandTotal = items.reduce((s, i) => s + i.total, 0)

  const createPurchase = useMutation({
    mutationFn: async () => {
      if (!cashRegisterId) throw new Error('Seleccione una caja')
      if (items.length === 0) throw new Error('Agregue al menos un material')

      // Insert purchase
      const { data: purchase, error: purchaseError } = await supabase
        .from('purchases')
        .insert({
          operator_id: operatorId || null,
          provider_id: providerId || null,
          cash_register_id: cashRegisterId,
          total: grandTotal,
          notes: notes || null,
          created_by: profile?.id,
        })
        .select()
        .single()

      if (purchaseError) throw purchaseError

      // Insert items (triggers handle inventory)
      const itemsToInsert = items.map(item => ({
        purchase_id: purchase.id,
        material_id: item.material_id,
        quantity: item.quantity,
        price_per_unit: item.price_per_unit,
        total: item.total,
      }))

      const { error: itemsError } = await supabase.from('purchase_items').insert(itemsToInsert)
      if (itemsError) throw itemsError

      // Insert cash movement
      const { error: cashError } = await supabase.from('cash_movements').insert({
        cash_register_id: cashRegisterId,
        type: 'expense',
        amount: grandTotal,
        reference_type: 'purchase',
        reference_id: purchase.id,
        description: `Compra #${purchase.id.slice(0, 8)}`,
        user_id: profile?.id,
      })
      if (cashError) throw cashError

      return purchase
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      queryClient.invalidateQueries({ queryKey: ['cash_registers'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      navigate('/purchases')
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

  const matOptions = materials.map(m => ({ value: m.id, label: `${m.name} (${m.unit})` }))
  const operatorOptions = operators.map((o: { id: string; name: string }) => ({ value: o.id, label: o.name }))
  const providerOptions = providers.map(p => ({ value: p.id, label: p.name }))
  const cashOptions = cashRegisters.map((r: { id: string; name: string }) => ({ value: r.id, label: r.name }))

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />} onClick={() => navigate('/purchases')}>
          Volver
        </Button>
        <h2 className="text-lg font-semibold text-gray-900">Nueva Compra</h2>
      </div>

      {/* Purchase header form */}
      <Card>
        <h3 className="font-medium text-gray-700 mb-4">Datos de la Compra</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Operador"
            options={operatorOptions}
            placeholder="Seleccionar operador"
            value={operatorId}
            onChange={e => setOperatorId(e.target.value)}
          />
          <div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Select
                  label="Proveedor"
                  options={providerOptions}
                  placeholder="Sin proveedor (opcional)"
                  value={providerId}
                  onChange={e => setProviderId(e.target.value)}
                />
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="mb-0.5"
                onClick={() => setNewProviderOpen(true)}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <Select
            label="Caja"
            options={cashOptions}
            placeholder="Seleccionar caja"
            value={cashRegisterId}
            onChange={e => setCashRegisterId(e.target.value)}
            required
          />
          <Input
            label="Notas"
            placeholder="Observaciones opcionales"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>
      </Card>

      {/* Add items */}
      <Card>
        <h3 className="font-medium text-gray-700 mb-4">Agregar Materiales</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2">
            <Select
              label="Material"
              options={matOptions}
              placeholder="Seleccionar material"
              value={selectedMaterialId}
              onChange={e => setSelectedMaterialId(e.target.value)}
            />
          </div>
          <Input
            label="Cantidad (kg)"
            type="number"
            inputMode="decimal"
            step="0.001"
            min="0.001"
            placeholder="0.000"
            value={qty}
            onChange={e => setQty(e.target.value)}
            ref={qtyRef}
          />
          <Input
            label="Precio/kg"
            type="number"
            inputMode="numeric"
            step="1"
            min="1"
            placeholder="0"
            value={price}
            onChange={e => setPrice(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addItem() }}
          />
        </div>

        {/* Preview total for current item */}
        {qty && price && (
          <div className="mt-2 text-sm text-gray-500">
            Subtotal: <span className="font-semibold text-gray-900">
              {formatCOP(parseFloat(qty || '0') * parseFloat(price || '0'))}
            </span>
            {' '}({formatKg(parseFloat(qty || '0'))})
          </div>
        )}

        <Button
          className="mt-3 w-full md:w-auto"
          variant="secondary"
          icon={<Plus className="w-4 h-4" />}
          onClick={addItem}
          disabled={!selectedMaterialId || !qty || !price}
        >
          Agregar ítem
        </Button>
      </Card>

      {/* Items table */}
      {items.length > 0 && (
        <Card padding={false}>
          <div className="px-4 lg:px-6 py-3 border-b border-gray-100">
            <h3 className="font-medium text-gray-700">Ítems de la Compra</h3>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Material</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Cantidad</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Precio/kg</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total</th>
                <th className="px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-900">{item.material_name}</td>
                  <td className="px-6 py-3 text-right text-gray-700">{formatKg(item.quantity)}</td>
                  <td className="px-6 py-3 text-right text-gray-700">{formatCOP(item.price_per_unit)}</td>
                  <td className="px-6 py-3 text-right font-semibold text-gray-900">{formatCOP(item.total)}</td>
                  <td className="px-2 py-3">
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-200">
              <tr>
                <td colSpan={3} className="px-6 py-4 text-right font-semibold text-gray-700">TOTAL</td>
                <td className="px-6 py-4 text-right text-xl font-bold text-green-700">{formatCOP(grandTotal)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
          </div>
        </Card>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Submit — sticky on mobile */}
      <div className="flex gap-3 sticky bottom-20 lg:static lg:bottom-auto bg-gray-50 py-3 -mx-4 px-4 lg:mx-0 lg:px-0 lg:py-0 border-t border-gray-100 lg:border-0">
        <Button variant="secondary" className="hidden lg:inline-flex" onClick={() => navigate('/purchases')}>
          Cancelar
        </Button>
        <Button
          size="lg"
          fullWidth
          icon={<CheckCircle className="w-5 h-5" />}
          loading={createPurchase.isPending}
          disabled={items.length === 0 || !cashRegisterId}
          onClick={() => createPurchase.mutate()}
        >
          Registrar Compra — {formatCOP(grandTotal)}
        </Button>
      </div>

      {/* New provider modal */}
      <NewProviderModal
        open={newProviderOpen}
        onClose={() => setNewProviderOpen(false)}
        onCreated={(id) => {
          refetchProviders()
          setProviderId(id)
          setNewProviderOpen(false)
        }}
      />
    </div>
  )
}

function NewProviderModal({
  open, onClose, onCreated
}: {
  open: boolean
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState('street')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('providers')
        .insert({ name, type, phone: phone || null })
        .select()
        .single()
      if (error) throw error
      onCreated(data.id)
      setName('')
      setPhone('')
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nuevo Proveedor">
      <div className="space-y-4">
        <Input
          label="Nombre"
          placeholder="Nombre del proveedor"
          required
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <Select
          label="Tipo"
          options={[
            { value: 'street', label: 'Reciclador de calle' },
            { value: 'recycler', label: 'Reciclador organizado' },
            { value: 'company', label: 'Empresa' },
            { value: 'other', label: 'Otro' },
          ]}
          value={type}
          onChange={e => setType(e.target.value)}
        />
        <Input
          label="Teléfono (opcional)"
          placeholder="300 000 0000"
          value={phone}
          onChange={e => setPhone(e.target.value)}
        />
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" fullWidth onClick={onClose} type="button">Cancelar</Button>
          <Button fullWidth loading={loading} onClick={handleCreate}>Crear</Button>
        </div>
      </div>
    </Modal>
  )
}
