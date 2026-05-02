import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, ArrowLeft, CheckCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Material, Inventory } from '../../types'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Card } from '../../components/ui/Card'
import { useAuth } from '../../hooks/useAuth'
import { formatCOP, formatKg, formatQty } from '../../lib/format'

interface LineItem {
  id: string
  material_id: string
  material_name: string
  material_unit: string
  available: number
  quantity: number
  price_per_unit: number
  total: number
}

export function NewSale() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const queryClient = useQueryClient()

  const [customerName, setCustomerName] = useState('')
  const [operatorId, setOperatorId] = useState(profile?.id ?? '')
  const [cashRegisterId, setCashRegisterId] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<LineItem[]>([])
  const [error, setError] = useState('')

  const [selectedMaterialId, setSelectedMaterialId] = useState('')
  const [qty, setQty] = useState('')
  const [price, setPrice] = useState('')
  const qtyRef = useRef<HTMLInputElement>(null)

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

  const { data: inventory = [] } = useQuery<Inventory[]>({
    queryKey: ['inventory'],
    queryFn: async () => {
      const { data, error } = await supabase.from('inventory').select('*')
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

  useEffect(() => {
    if (selectedMaterialId) qtyRef.current?.focus()
  }, [selectedMaterialId])

  const getAvailable = (matId: string) => {
    const inv = inventory.find(i => i.material_id === matId)
    return inv?.quantity ?? 0
  }

  const addItem = () => {
    if (!selectedMaterialId || !qty || !price) return
    const mat = materials.find(m => m.id === selectedMaterialId)
    if (!mat) return
    const quantity = parseFloat(qty)
    const priceVal = parseFloat(price)
    if (isNaN(quantity) || isNaN(priceVal) || quantity <= 0 || priceVal <= 0) return
    const available = getAvailable(selectedMaterialId)
    if (quantity > available) {
      setError(`Stock insuficiente de ${mat.name}: disponible ${formatQty(available, mat.unit)}`)
      return
    }

    setError('')
    const newItem: LineItem = {
      id: crypto.randomUUID(),
      material_id: selectedMaterialId,
      material_name: mat.name,
      material_unit: mat.unit,
      available,
      quantity,
      price_per_unit: priceVal,
      total: quantity * priceVal,
    }

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

  const createSale = useMutation({
    mutationFn: async () => {
      if (!cashRegisterId) throw new Error('Seleccione una caja')
      if (items.length === 0) throw new Error('Agregue al menos un material')

      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          customer_name: customerName || null,
          operator_id: operatorId || null,
          cash_register_id: cashRegisterId,
          total: grandTotal,
          notes: notes || null,
          created_by: profile?.id,
        })
        .select()
        .single()

      if (saleError) throw saleError

      const saleItems = items.map(item => ({
        sale_id: sale.id,
        material_id: item.material_id,
        quantity: item.quantity,
        price_per_unit: item.price_per_unit,
        total: item.total,
      }))

      const { error: itemsError } = await supabase.from('sale_items').insert(saleItems)
      if (itemsError) throw itemsError

      const { error: cashError } = await supabase.from('cash_movements').insert({
        cash_register_id: cashRegisterId,
        type: 'income',
        amount: grandTotal,
        reference_type: 'sale',
        reference_id: sale.id,
        description: `Venta #${sale.id.slice(0, 8)}`,
        user_id: profile?.id,
      })
      if (cashError) throw cashError

      return sale
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['cash_registers'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      navigate('/sales')
    },
    onError: (err: Error) => setError(err.message),
  })

  const matOptions = materials
    .filter(m => getAvailable(m.id) > 0)
    .map(m => ({
      value: m.id,
      label: `${m.name} — ${formatQty(getAvailable(m.id), m.unit)} disponible`,
    }))

  const operatorOptions = operators.map((o: { id: string; name: string }) => ({ value: o.id, label: o.name }))
  const cashOptions = cashRegisters.map((r: { id: string; name: string }) => ({ value: r.id, label: r.name }))

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />} onClick={() => navigate('/sales')}>
          Volver
        </Button>
        <h2 className="text-lg font-semibold text-gray-900">Nueva Venta</h2>
      </div>

      <Card>
        <h3 className="font-medium text-gray-700 mb-4">Datos de la Venta</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Cliente (opcional)"
            placeholder="Nombre del cliente"
            value={customerName}
            onChange={e => setCustomerName(e.target.value)}
          />
          <Select
            label="Operador"
            options={operatorOptions}
            placeholder="Seleccionar operador"
            value={operatorId}
            onChange={e => setOperatorId(e.target.value)}
          />
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

      <Card>
        <h3 className="font-medium text-gray-700 mb-4">Agregar Materiales</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2">
            <Select
              label="Material (con stock disponible)"
              options={matOptions}
              placeholder="Seleccionar material"
              value={selectedMaterialId}
              onChange={e => setSelectedMaterialId(e.target.value)}
            />
          </div>
          <Input
            label="Cantidad"
            type="number"
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
            step="1"
            min="1"
            placeholder="0"
            value={price}
            onChange={e => setPrice(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addItem() }}
          />
        </div>
        {qty && price && (
          <div className="mt-2 text-sm text-gray-500">
            Subtotal: <span className="font-semibold text-gray-900">
              {formatCOP(parseFloat(qty || '0') * parseFloat(price || '0'))}
            </span>
            {' '}({formatKg(parseFloat(qty || '0'))})
          </div>
        )}
        <Button
          className="mt-3"
          variant="secondary"
          size="sm"
          icon={<Plus className="w-4 h-4" />}
          onClick={addItem}
          disabled={!selectedMaterialId || !qty || !price}
        >
          Agregar ítem
        </Button>
      </Card>

      {items.length > 0 && (
        <Card padding={false}>
          <div className="px-6 py-3 border-b border-gray-100">
            <h3 className="font-medium text-gray-700">Ítems de la Venta</h3>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Material</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Disponible</th>
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
                  <td className="px-6 py-3 text-right text-xs text-gray-400">
                    {formatQty(item.available, item.material_unit)}
                  </td>
                  <td className="px-6 py-3 text-right text-gray-700">{formatQty(item.quantity, item.material_unit)}</td>
                  <td className="px-6 py-3 text-right text-gray-700">{formatCOP(item.price_per_unit)}</td>
                  <td className="px-6 py-3 text-right font-semibold text-green-700">{formatCOP(item.total)}</td>
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
                <td colSpan={4} className="px-6 py-4 text-right font-semibold text-gray-700">TOTAL</td>
                <td className="px-6 py-4 text-right text-xl font-bold text-green-700">{formatCOP(grandTotal)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </Card>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="secondary" onClick={() => navigate('/sales')}>
          Cancelar
        </Button>
        <Button
          size="lg"
          icon={<CheckCircle className="w-5 h-5" />}
          loading={createSale.isPending}
          disabled={items.length === 0 || !cashRegisterId}
          onClick={() => createSale.mutate()}
        >
          Registrar Venta — {formatCOP(grandTotal)}
        </Button>
      </div>
    </div>
  )
}
