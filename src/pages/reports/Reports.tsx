import { useState, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, TrendingUp, ShoppingCart, DollarSign, Printer, FileText, ChevronDown, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../../lib/supabase'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { formatCOP, formatQty } from '../../lib/format'

type Tab = 'summary' | 'cashflow' | 'purchases' | 'sales' | 'profit'

const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'summary',   label: 'Resumen',              icon: <FileText className="w-4 h-4" /> },
  { key: 'cashflow',  label: 'Flujo de Caja',        icon: <DollarSign className="w-4 h-4" /> },
  { key: 'purchases', label: 'Compras x Material',   icon: <ShoppingCart className="w-4 h-4" /> },
  { key: 'sales',     label: 'Ventas x Material',    icon: <TrendingUp className="w-4 h-4" /> },
  { key: 'profit',    label: 'Rentabilidad',          icon: <BarChart3 className="w-4 h-4" /> },
]

function getDefaultDates() {
  const end = new Date()
  const start = new Date()
  start.setDate(1)
  return {
    from: start.toISOString().slice(0, 10),
    to:   end.toISOString().slice(0, 10),
  }
}

const dateInputCls = 'w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent'

export function Reports() {
  const [activeTab, setActiveTab] = useState<Tab>('summary')
  const defaults = getDefaultDates()
  const [dateFrom, setDateFrom] = useState(defaults.from)
  const [dateTo,   setDateTo]   = useState(defaults.to)

  return (
    <div className="space-y-4">
      {/* Date filters */}
      <Card>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Desde</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={dateInputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Hasta</label>
            <input type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)}   className={dateInputCls} />
          </div>
        </div>
      </Card>

      {/* Tabs — scrollable */}
      <div className="flex border-b border-gray-200 overflow-x-auto scrollbar-none -mb-px">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`
              flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap
              ${activeTab === tab.key
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'summary'   && <DailyReport  dateFrom={dateFrom} dateTo={dateTo} />}
      {activeTab === 'cashflow'  && <CashFlowReport dateFrom={dateFrom} dateTo={dateTo} />}
      {activeTab === 'purchases' && <PurchasesByMaterial dateFrom={dateFrom} dateTo={dateTo} />}
      {activeTab === 'sales'     && <SalesByMaterial dateFrom={dateFrom} dateTo={dateTo} />}
      {activeTab === 'profit'    && <ProfitReport dateFrom={dateFrom} dateTo={dateTo} />}
    </div>
  )
}

// ─── Daily Summary + Print ────────────────────────────────────────────────────

const categoryLabels: Record<string, string> = {
  salary: 'Salarios', transport: 'Transporte', supplies: 'Insumos',
  maintenance: 'Mantenimiento', other: 'Otros',
}

function DailyReport({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const reportRef = useRef<HTMLDivElement>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['report_daily', dateFrom, dateTo],
    queryFn: async () => {
      const from = `${dateFrom}T00:00:00`
      const to   = `${dateTo}T23:59:59.999`

      const [purchasesRes, salesRes, expensesRes] = await Promise.all([
        supabase.from('purchases')
          .select('id, date, total, notes, operator:profiles!operator_id(name), provider:providers(name), items:purchase_items(quantity, price_per_unit, total, material:materials(name, unit))')
          .eq('status', 'active').gte('date', from).lte('date', to).order('date'),
        supabase.from('sales')
          .select('id, date, total, customer_name, notes, cash_register_id, operator:profiles!operator_id(name), items:sale_items(quantity, price_per_unit, total, material:materials(name, unit))')
          .eq('status', 'active').gte('date', from).lte('date', to).order('date'),
        supabase.from('expenses')
          .select('id, date, amount, description, category')
          .gte('date', dateFrom).lte('date', dateTo).order('date'),
      ])

      return {
        purchases: (purchasesRes.data ?? []) as PurchaseRow[],
        sales:     (salesRes.data ?? [])     as SaleRow[],
        expenses:  (expensesRes.data ?? [])  as ExpenseRow[],
      }
    },
  })

  const handlePrint = useCallback(() => {
    if (!data) return
    const fmtDate = (d: string) => format(new Date(d), "d 'de' MMMM yyyy, HH:mm", { locale: es })
    const fmtDay  = (d: string) => format(new Date(d), "d MMM yyyy", { locale: es })
    const fmtCOP  = (n: number) => `$ ${Math.round(n).toLocaleString('es-CO')}`

    const totalCompras = data.purchases.reduce((s, p) => s + p.total, 0)
    const totalVentas  = data.sales.reduce((s, p) => s + p.total, 0)
    const totalGastos  = data.expenses.reduce((s, p) => s + p.amount, 0)
    const flujoNeto    = totalVentas - totalCompras - totalGastos

    const purchasesHTML = data.purchases.length === 0
      ? '<tr><td colspan="4" style="text-align:center;color:#999">Sin compras en el período</td></tr>'
      : data.purchases.map(p => `
          <tr>
            <td>${fmtDate(p.date)}</td>
            <td>${(p.provider as {name:string}|undefined)?.name ?? '—'}</td>
            <td>${(p.operator as {name:string}|undefined)?.name ?? '—'}</td>
            <td class="right bold">${fmtCOP(p.total)}</td>
          </tr>
          ${(p.items as ItemRow[]).map(i => {
            const m = i.material as {name:string;unit:string}|undefined
            return `<tr class="sub"><td></td><td colspan="2" style="color:#555;font-size:11px">• ${m?.name ?? ''}: ${i.quantity.toFixed(3)} ${m?.unit ?? ''} × ${fmtCOP(i.price_per_unit)}</td><td class="right" style="color:#555;font-size:11px">${fmtCOP(i.total)}</td></tr>`
          }).join('')}
        `).join('')

    const salesHTML = data.sales.length === 0
      ? '<tr><td colspan="5" style="text-align:center;color:#999">Sin ventas en el período</td></tr>'
      : data.sales.map(s => `
          <tr>
            <td>${fmtDate(s.date)}</td>
            <td>${s.customer_name ?? 'Comprador general'}</td>
            <td>${(s.operator as {name:string}|undefined)?.name ?? '—'}</td>
            <td style="text-align:center">${s.cash_register_id ? 'Caja' : 'Externo'}</td>
            <td class="right bold green">${fmtCOP(s.total)}</td>
          </tr>
          ${(s.items as ItemRow[]).map(i => {
            const m = i.material as {name:string;unit:string}|undefined
            return `<tr class="sub"><td></td><td colspan="3" style="color:#555;font-size:11px">• ${m?.name ?? ''}: ${i.quantity.toFixed(3)} ${m?.unit ?? ''} × ${fmtCOP(i.price_per_unit)}</td><td class="right" style="color:#555;font-size:11px">${fmtCOP(i.total)}</td></tr>`
          }).join('')}
        `).join('')

    const expensesHTML = data.expenses.length === 0
      ? '<tr><td colspan="4" style="text-align:center;color:#999">Sin gastos en el período</td></tr>'
      : data.expenses.map(e => `
          <tr>
            <td>${fmtDay(e.date)}</td>
            <td>${e.description ?? '—'}</td>
            <td>${categoryLabels[e.category] ?? e.category}</td>
            <td class="right bold red">${fmtCOP(e.amount)}</td>
          </tr>`).join('')

    const periodLabel = dateFrom === dateTo
      ? fmtDay(dateFrom)
      : `${fmtDay(dateFrom)} al ${fmtDay(dateTo)}`

    const html = `<!DOCTYPE html><html lang="es">
<head><meta charset="utf-8"><title>Reporte ECA — ${periodLabel}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#111;padding:20px 24px}
  h1{font-size:20px;font-weight:700;color:#166534}
  .sub-title{color:#555;font-size:12px;margin:2px 0 16px}
  h2{font-size:13px;font-weight:700;color:#166534;margin:20px 0 6px;border-bottom:1.5px solid #bbf7d0;padding-bottom:3px;text-transform:uppercase;letter-spacing:.04em}
  table{width:100%;border-collapse:collapse;margin-bottom:4px}
  th{background:#f0fdf4;font-weight:600;text-align:left;padding:5px 8px;font-size:10px;text-transform:uppercase;color:#555;border-bottom:2px solid #bbf7d0}
  td{padding:4px 8px;border-bottom:1px solid #f0f0f0}
  .right{text-align:right}
  .bold{font-weight:600}
  .green{color:#166534}
  .red{color:#991b1b}
  .sub td{background:#fafafa;padding:2px 8px}
  .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0}
  .card{border:1px solid #d1fae5;border-radius:8px;padding:10px 12px}
  .card .label{font-size:10px;color:#666;text-transform:uppercase;letter-spacing:.04em}
  .card .value{font-size:18px;font-weight:700;margin-top:2px}
  .generated{font-size:10px;color:#999;margin-top:20px;border-top:1px solid #eee;padding-top:8px}
  @media print{body{padding:10px 14px}.summary{grid-template-columns:repeat(4,1fr)}}
</style>
</head>
<body>
  <h1>Recicondor — Colina Verde</h1>
  <p class="sub-title">Reporte de movimientos · ${periodLabel}</p>

  <div class="summary">
    <div class="card"><div class="label">Ventas</div><div class="value green">${fmtCOP(totalVentas)}</div></div>
    <div class="card"><div class="label">Compras</div><div class="value red">${fmtCOP(totalCompras)}</div></div>
    <div class="card"><div class="label">Gastos</div><div class="value" style="color:#c2410c">${fmtCOP(totalGastos)}</div></div>
    <div class="card"><div class="label">Flujo Neto</div><div class="value ${flujoNeto >= 0 ? 'green' : 'red'}">${fmtCOP(flujoNeto)}</div></div>
  </div>

  <h2>Compras (${data.purchases.length})</h2>
  <table>
    <thead><tr><th>Fecha y hora</th><th>Proveedor</th><th>Operador</th><th class="right">Total</th></tr></thead>
    <tbody>${purchasesHTML}</tbody>
    <tfoot><tr style="border-top:2px solid #d1fae5"><td colspan="3" style="text-align:right;font-weight:600;padding:6px 8px">TOTAL COMPRAS</td><td class="right bold red">${fmtCOP(totalCompras)}</td></tr></tfoot>
  </table>

  <h2>Ventas (${data.sales.length})</h2>
  <table>
    <thead><tr><th>Fecha y hora</th><th>Cliente</th><th>Operador</th><th style="text-align:center">Pago</th><th class="right">Total</th></tr></thead>
    <tbody>${salesHTML}</tbody>
    <tfoot><tr style="border-top:2px solid #d1fae5"><td colspan="4" style="text-align:right;font-weight:600;padding:6px 8px">TOTAL VENTAS</td><td class="right bold green">${fmtCOP(totalVentas)}</td></tr></tfoot>
  </table>

  <h2>Gastos (${data.expenses.length})</h2>
  <table>
    <thead><tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th class="right">Monto</th></tr></thead>
    <tbody>${expensesHTML}</tbody>
    <tfoot><tr style="border-top:2px solid #d1fae5"><td colspan="3" style="text-align:right;font-weight:600;padding:6px 8px">TOTAL GASTOS</td><td class="right bold red">${fmtCOP(totalGastos)}</td></tr></tfoot>
  </table>

  <p class="generated">Generado el ${format(new Date(), "d 'de' MMMM yyyy, HH:mm", { locale: es })} · Recicondor ID 50863</p>
</body></html>`

    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) { alert('Permite las ventanas emergentes para imprimir'); return }
    win.document.write(html)
    win.document.close()
    setTimeout(() => { win.print() }, 400)
  }, [data, dateFrom, dateTo])

  if (isLoading) return <p className="text-sm text-gray-400 py-6 text-center">Cargando movimientos...</p>
  if (!data) return null

  const totalCompras = data.purchases.reduce((s, p) => s + p.total, 0)
  const totalVentas  = data.sales.reduce((s, p) => s + p.total, 0)
  const totalGastos  = data.expenses.reduce((s, p) => s + p.amount, 0)
  const flujoNeto    = totalVentas - totalCompras - totalGastos

  return (
    <div className="space-y-4" ref={reportRef}>
      {/* Resumen */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Resumen del período</h3>
        <Button size="sm" variant="secondary" icon={<Printer className="w-4 h-4" />} onClick={handlePrint}>
          Imprimir / PDF
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><p className="text-xs text-gray-500">Ventas</p><p className="text-xl font-bold text-green-700 mt-0.5">{formatCOP(totalVentas)}</p></Card>
        <Card><p className="text-xs text-gray-500">Compras</p><p className="text-xl font-bold text-red-700 mt-0.5">{formatCOP(totalCompras)}</p></Card>
        <Card><p className="text-xs text-gray-500">Gastos</p><p className="text-xl font-bold text-orange-700 mt-0.5">{formatCOP(totalGastos)}</p></Card>
        <Card><p className="text-xs text-gray-500">Flujo Neto</p><p className={`text-xl font-bold mt-0.5 ${flujoNeto >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatCOP(flujoNeto)}</p></Card>
      </div>

      {/* Compras */}
      <Card padding={false}>
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-medium text-gray-700">Compras ({data.purchases.length})</h3>
          <span className="text-sm font-semibold text-red-700">{formatCOP(totalCompras)}</span>
        </div>
        {data.purchases.length === 0 ? (
          <p className="px-4 py-4 text-sm text-gray-400">Sin compras en el período</p>
        ) : (
          <SummaryPurchaseList purchases={data.purchases} />
        )}
      </Card>

      {/* Ventas */}
      <Card padding={false}>
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-medium text-gray-700">Ventas ({data.sales.length})</h3>
          <span className="text-sm font-semibold text-green-700">{formatCOP(totalVentas)}</span>
        </div>
        {data.sales.length === 0 ? (
          <p className="px-4 py-4 text-sm text-gray-400">Sin ventas en el período</p>
        ) : (
          <SummarySaleList sales={data.sales} />
        )}
      </Card>

      {/* Gastos */}
      {data.expenses.length > 0 && (
        <Card padding={false}>
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-medium text-gray-700">Gastos ({data.expenses.length})</h3>
            <span className="text-sm font-semibold text-orange-700">{formatCOP(totalGastos)}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {data.expenses.map(e => (
              <div key={e.id} className="px-4 py-2.5 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-800">{e.description ?? '—'}</p>
                  <p className="text-xs text-gray-400">{categoryLabels[e.category] ?? e.category} · {format(new Date(e.date), "d MMM", { locale: es })}</p>
                </div>
                <p className="text-sm font-semibold text-orange-700">{formatCOP(e.amount)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

interface ItemRow { quantity: number; price_per_unit: number; total: number; material: unknown }
interface PurchaseRow { id: string; date: string; total: number; notes: string | null; operator: unknown; provider: unknown; items: ItemRow[] }
interface SaleRow { id: string; date: string; total: number; customer_name: string | null; notes: string | null; cash_register_id: string | null; operator: unknown; items: ItemRow[] }
interface ExpenseRow { id: string; date: string; amount: number; description: string | null; category: string }

function SummaryPurchaseList({ purchases }: { purchases: PurchaseRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  return (
    <div className="divide-y divide-gray-50">
      {purchases.map(p => {
        const provider = p.provider as { name: string } | undefined
        const operator = p.operator as { name: string } | undefined
        const expanded = expandedId === p.id
        return (
          <div key={p.id}>
            <button className="w-full px-4 py-2.5 flex items-center gap-2 hover:bg-gray-50 text-left" onClick={() => setExpandedId(expanded ? null : p.id)}>
              {expanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{provider?.name ?? 'Sin proveedor'}</p>
                <p className="text-xs text-gray-400">{operator?.name ?? '—'} · {format(new Date(p.date), "d MMM, HH:mm", { locale: es })}</p>
              </div>
              <p className="text-sm font-semibold text-gray-900 whitespace-nowrap">{formatCOP(p.total)}</p>
            </button>
            {expanded && (
              <div className="bg-green-50 px-6 pb-2">
                {p.items.map((item, i) => {
                  const m = item.material as { name: string; unit: string } | undefined
                  return (
                    <div key={i} className="flex justify-between py-0.5 text-xs text-gray-600">
                      <span>{m?.name}: {formatQty(item.quantity, m?.unit ?? 'kg')}</span>
                      <span>{formatCOP(item.total)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function SummarySaleList({ sales }: { sales: SaleRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  return (
    <div className="divide-y divide-gray-50">
      {sales.map(s => {
        const operator = s.operator as { name: string } | undefined
        const expanded = expandedId === s.id
        return (
          <div key={s.id}>
            <button className="w-full px-4 py-2.5 flex items-center gap-2 hover:bg-gray-50 text-left" onClick={() => setExpandedId(expanded ? null : s.id)}>
              {expanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{s.customer_name ?? 'Comprador general'}</p>
                <p className="text-xs text-gray-400">
                  {operator?.name ?? '—'} · {format(new Date(s.date), "d MMM, HH:mm", { locale: es })}
                  {!s.cash_register_id && <span className="ml-1 text-orange-500">· Pago externo</span>}
                </p>
              </div>
              <p className="text-sm font-semibold text-green-700 whitespace-nowrap">{formatCOP(s.total)}</p>
            </button>
            {expanded && (
              <div className="bg-green-50 px-6 pb-2">
                {s.items.map((item, i) => {
                  const m = item.material as { name: string; unit: string } | undefined
                  return (
                    <div key={i} className="flex justify-between py-0.5 text-xs text-gray-600">
                      <span>{m?.name}: {formatQty(item.quantity, m?.unit ?? 'kg')}</span>
                      <span>{formatCOP(item.total)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Cash Flow ────────────────────────────────────────────────────────────────

function CashFlowReport({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['report_cashflow', dateFrom, dateTo],
    queryFn: async () => {
      const fromISO = `${dateFrom}T00:00:00`
      const toISO   = `${dateTo}T23:59:59.999`

      const [movementsRes, expensesRes] = await Promise.all([
        supabase.from('cash_movements').select('type, amount, reference_type, created_at')
          .gte('created_at', fromISO).lte('created_at', toISO),
        supabase.from('expenses').select('amount, category, date')
          .gte('date', dateFrom).lte('date', dateTo),
      ])

      const movements = movementsRes.data ?? []
      const expenses  = expensesRes.data ?? []

      const income    = movements.filter(m => m.type === 'income' && m.reference_type === 'sale').reduce((s, m) => s + m.amount, 0)
      const purchases = movements.filter(m => m.type === 'expense' && m.reference_type === 'purchase').reduce((s, m) => s + m.amount, 0)
      const expTotal  = expenses.reduce((s, e) => s + e.amount, 0)

      const byCategory: Record<string, number> = {}
      expenses.forEach(e => { byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount })

      return { income, purchases, expensesTotal: expTotal, net: income - purchases - expTotal, byCategory }
    },
  })

  if (isLoading) return <p className="text-sm text-gray-400 py-4">Calculando...</p>
  if (!data) return null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><p className="text-xs text-gray-500">Ingresos por Ventas</p><p className="text-xl font-bold text-green-700 mt-0.5">{formatCOP(data.income)}</p></Card>
        <Card><p className="text-xs text-gray-500">Egresos por Compras</p><p className="text-xl font-bold text-red-700 mt-0.5">{formatCOP(data.purchases)}</p></Card>
        <Card><p className="text-xs text-gray-500">Gastos Operativos</p><p className="text-xl font-bold text-orange-700 mt-0.5">{formatCOP(data.expensesTotal)}</p></Card>
        <Card><p className="text-xs text-gray-500">Flujo Neto</p><p className={`text-xl font-bold mt-0.5 ${data.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatCOP(data.net)}</p></Card>
      </div>
      <Card>
        <h3 className="font-semibold text-gray-900 mb-4">Gastos por Categoría</h3>
        {Object.keys(data.byCategory).length === 0 ? (
          <p className="text-sm text-gray-400">No hay gastos en el período</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(data.byCategory).sort(([, a], [, b]) => b - a).map(([cat, amount]) => {
              const pct = data.expensesTotal > 0 ? (amount / data.expensesTotal) * 100 : 0
              return (
                <div key={cat}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700">{categoryLabels[cat] ?? cat}</span>
                    <span className="font-semibold">{formatCOP(amount)} ({pct.toFixed(1)}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-orange-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}

// ─── Purchases by Material ────────────────────────────────────────────────────

interface MaterialStat {
  material_id: string; material_name: string; unit: string
  total_qty: number; total_value: number; avg_price: number
}

function PurchasesByMaterial({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data = [], isLoading } = useQuery<MaterialStat[]>({
    queryKey: ['report_purchases_by_material', dateFrom, dateTo],
    queryFn: async () => {
      const { data: items, error } = await supabase
        .from('purchase_items')
        .select('quantity, price_per_unit, total, material:materials(id, name, unit), purchase:purchases(date, status)')
        .gte('purchase.date', `${dateFrom}T00:00:00`)
        .lte('purchase.date', `${dateTo}T23:59:59.999`)
      if (error) throw error

      const map: Record<string, MaterialStat> = {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(items ?? []).forEach((item: any) => {
        const mat = Array.isArray(item.material) ? item.material[0] : item.material
        const pur = Array.isArray(item.purchase) ? item.purchase[0] : item.purchase
        if (!mat || pur?.status === 'reversed') return
        const id = mat.id
        if (!map[id]) map[id] = { material_id: id, material_name: mat.name, unit: mat.unit, total_qty: 0, total_value: 0, avg_price: 0 }
        map[id].total_qty   += item.quantity
        map[id].total_value += item.total
      })
      Object.values(map).forEach(s => { s.avg_price = s.total_qty > 0 ? s.total_value / s.total_qty : 0 })
      return Object.values(map).sort((a, b) => b.total_value - a.total_value)
    },
  })

  if (isLoading) return <p className="text-sm text-gray-400 py-4">Calculando...</p>

  const grandQty   = data.reduce((s, d) => s + d.total_qty, 0)
  const grandValue = data.reduce((s, d) => s + d.total_value, 0)

  return (
    <Card padding={false}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Material</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Cantidad</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Precio Prom.</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">No hay compras en el período</td></tr>
            ) : data.map(row => (
              <tr key={row.material_id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{row.material_name}</td>
                <td className="px-4 py-3 text-right text-gray-700">{formatQty(row.total_qty, row.unit)}</td>
                <td className="px-4 py-3 text-right text-gray-600 hidden sm:table-cell">{formatCOP(row.avg_price)}/{row.unit}</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCOP(row.total_value)}</td>
              </tr>
            ))}
          </tbody>
          {data.length > 0 && (
            <tfoot className="border-t-2 border-gray-200 bg-gray-50">
              <tr>
                <td className="px-4 py-3 font-semibold">TOTAL</td>
                <td className="px-4 py-3 text-right font-semibold">{formatQty(grandQty, 'kg')}</td>
                <td className="hidden sm:table-cell" />
                <td className="px-4 py-3 text-right font-bold text-red-700">{formatCOP(grandValue)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </Card>
  )
}

// ─── Sales by Material ────────────────────────────────────────────────────────

function SalesByMaterial({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data = [], isLoading } = useQuery<MaterialStat[]>({
    queryKey: ['report_sales_by_material', dateFrom, dateTo],
    queryFn: async () => {
      const { data: items, error } = await supabase
        .from('sale_items')
        .select('quantity, price_per_unit, total, material:materials(id, name, unit), sale:sales(date, status)')
        .gte('sale.date', `${dateFrom}T00:00:00`)
        .lte('sale.date', `${dateTo}T23:59:59.999`)
      if (error) throw error

      const map: Record<string, MaterialStat> = {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(items ?? []).forEach((item: any) => {
        const mat = Array.isArray(item.material) ? item.material[0] : item.material
        const sal = Array.isArray(item.sale) ? item.sale[0] : item.sale
        if (!mat || sal?.status === 'reversed') return
        const id = mat.id
        if (!map[id]) map[id] = { material_id: id, material_name: mat.name, unit: mat.unit, total_qty: 0, total_value: 0, avg_price: 0 }
        map[id].total_qty   += item.quantity
        map[id].total_value += item.total
      })
      Object.values(map).forEach(s => { s.avg_price = s.total_qty > 0 ? s.total_value / s.total_qty : 0 })
      return Object.values(map).sort((a, b) => b.total_value - a.total_value)
    },
  })

  if (isLoading) return <p className="text-sm text-gray-400 py-4">Calculando...</p>

  const grandQty   = data.reduce((s, d) => s + d.total_qty, 0)
  const grandValue = data.reduce((s, d) => s + d.total_value, 0)

  return (
    <Card padding={false}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Material</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Cantidad</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Precio Prom.</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">No hay ventas en el período</td></tr>
            ) : data.map(row => (
              <tr key={row.material_id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{row.material_name}</td>
                <td className="px-4 py-3 text-right text-gray-700">{formatQty(row.total_qty, row.unit)}</td>
                <td className="px-4 py-3 text-right text-gray-600 hidden sm:table-cell">{formatCOP(row.avg_price)}/{row.unit}</td>
                <td className="px-4 py-3 text-right font-semibold text-green-700">{formatCOP(row.total_value)}</td>
              </tr>
            ))}
          </tbody>
          {data.length > 0 && (
            <tfoot className="border-t-2 border-gray-200 bg-gray-50">
              <tr>
                <td className="px-4 py-3 font-semibold">TOTAL</td>
                <td className="px-4 py-3 text-right font-semibold">{formatQty(grandQty, 'kg')}</td>
                <td className="hidden sm:table-cell" />
                <td className="px-4 py-3 text-right font-bold text-green-700">{formatCOP(grandValue)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </Card>
  )
}

// ─── Profit Report (expandable rows) ─────────────────────────────────────────

interface ProfitRow {
  material_id: string; material_name: string; unit: string
  qty_purchased: number; cost_total: number; qty_sold: number; revenue_total: number
  avg_buy_price: number; avg_sell_price: number; gross_profit: number; margin: number
}

function ProfitReport({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data = [], isLoading } = useQuery<ProfitRow[]>({
    queryKey: ['report_profit', dateFrom, dateTo],
    queryFn: async () => {
      const [purchasesRes, salesRes] = await Promise.all([
        supabase.from('purchase_items')
          .select('quantity, total, material:materials(id, name, unit), purchase:purchases(date, status)')
          .gte('purchase.date', `${dateFrom}T00:00:00`).lte('purchase.date', `${dateTo}T23:59:59.999`),
        supabase.from('sale_items')
          .select('quantity, total, material:materials(id, name, unit), sale:sales(date, status)')
          .gte('sale.date', `${dateFrom}T00:00:00`).lte('sale.date', `${dateTo}T23:59:59.999`),
      ])

      const pMap: Record<string, { name: string; unit: string; qty: number; cost: number }> = {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(purchasesRes.data ?? []).forEach((item: any) => {
        const mat = Array.isArray(item.material) ? item.material[0] : item.material
        const pur = Array.isArray(item.purchase) ? item.purchase[0] : item.purchase
        if (!mat || pur?.status === 'reversed') return
        const id = mat.id
        if (!pMap[id]) pMap[id] = { name: mat.name, unit: mat.unit, qty: 0, cost: 0 }
        pMap[id].qty  += item.quantity
        pMap[id].cost += item.total
      })

      const sMap: Record<string, { qty: number; revenue: number }> = {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(salesRes.data ?? []).forEach((item: any) => {
        const mat = Array.isArray(item.material) ? item.material[0] : item.material
        const sal = Array.isArray(item.sale) ? item.sale[0] : item.sale
        if (!mat || sal?.status === 'reversed') return
        const id = mat.id
        if (!sMap[id]) sMap[id] = { qty: 0, revenue: 0 }
        sMap[id].qty     += item.quantity
        sMap[id].revenue += item.total
      })

      const rows: ProfitRow[] = []
      new Set([...Object.keys(pMap), ...Object.keys(sMap)]).forEach(id => {
        const p = pMap[id] ?? { name: 'Desconocido', unit: 'kg', qty: 0, cost: 0 }
        const s = sMap[id] ?? { qty: 0, revenue: 0 }
        const costPerUnit   = p.qty > 0 ? p.cost / p.qty : 0
        const estimatedCost = s.qty * costPerUnit
        const grossProfit   = s.revenue - estimatedCost
        const margin        = s.revenue > 0 ? (grossProfit / s.revenue) * 100 : 0
        rows.push({
          material_id: id, material_name: pMap[id]?.name ?? 'Desconocido', unit: pMap[id]?.unit ?? 'kg',
          qty_purchased: p.qty, cost_total: p.cost, qty_sold: s.qty, revenue_total: s.revenue,
          avg_buy_price: costPerUnit, avg_sell_price: s.qty > 0 ? s.revenue / s.qty : 0,
          gross_profit: grossProfit, margin,
        })
      })

      return rows.sort((a, b) => b.gross_profit - a.gross_profit)
    },
  })

  if (isLoading) return <p className="text-sm text-gray-400 py-4">Calculando...</p>

  const totalRevenue = data.reduce((s, r) => s + r.revenue_total, 0)
  const totalProfit  = data.reduce((s, r) => s + r.gross_profit, 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card><p className="text-xs text-gray-500">Ingresos por ventas</p><p className="text-xl font-bold text-green-700 mt-0.5">{formatCOP(totalRevenue)}</p></Card>
        <Card><p className="text-xs text-gray-500">Utilidad bruta est.</p><p className={`text-xl font-bold mt-0.5 ${totalProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatCOP(totalProfit)}</p></Card>
      </div>

      <Card padding={false}>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-8" />
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Material</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">P. Compra</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">P. Venta</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Utilidad</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Margen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">No hay datos en el período</td></tr>
            ) : data.map(row => {
              const exp = expandedId === row.material_id
              return (
                <>
                  <tr key={row.material_id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedId(exp ? null : row.material_id)}>
                    <td className="pl-4 py-3 text-gray-400">{exp ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{row.material_name}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600 hidden sm:table-cell">{formatCOP(row.avg_buy_price)}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600 hidden sm:table-cell">{formatCOP(row.avg_sell_price)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${row.gross_profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatCOP(row.gross_profit)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${row.margin >= 0 ? 'text-green-700' : 'text-red-700'}`}>{row.margin.toFixed(1)}%</td>
                  </tr>
                  {exp && (
                    <tr key={`${row.material_id}-d`}>
                      <td colSpan={6} className="bg-green-50 px-8 py-2.5 text-xs text-gray-600">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div><p className="text-gray-400 uppercase text-[10px]">kg comprados</p><p className="font-semibold">{formatQty(row.qty_purchased, row.unit)}</p></div>
                          <div><p className="text-gray-400 uppercase text-[10px]">Costo total</p><p className="font-semibold">{formatCOP(row.cost_total)}</p></div>
                          <div><p className="text-gray-400 uppercase text-[10px]">kg vendidos</p><p className="font-semibold">{formatQty(row.qty_sold, row.unit)}</p></div>
                          <div><p className="text-gray-400 uppercase text-[10px]">Ingresos</p><p className="font-semibold text-green-700">{formatCOP(row.revenue_total)}</p></div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
