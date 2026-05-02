// ============================================================
// ECA - Type Definitions
// ============================================================

export type UserRole = 'admin' | 'operator' | 'auditor'

export interface Profile {
  id: string
  name: string
  role: UserRole
  active: boolean
  created_at: string
}

export type MaterialUnit = 'kg' | 'unidad' | 'litro' | 'tonelada'

export interface Material {
  id: string
  name: string
  description: string | null
  unit: MaterialUnit
  active: boolean
  created_at: string
  created_by: string | null
}

export type CashRegisterType = 'main' | 'operator'

export interface CashRegister {
  id: string
  name: string
  type: CashRegisterType
  operator_id: string | null
  balance: number
  active: boolean
  created_at: string
  // joined
  operator?: Profile
}

export type CashMovementType = 'income' | 'expense' | 'transfer_in' | 'transfer_out'
export type CashReferenceType = 'purchase' | 'sale' | 'expense' | 'transfer' | 'manual'

export interface CashMovement {
  id: string
  cash_register_id: string
  type: CashMovementType
  amount: number
  reference_type: CashReferenceType | null
  reference_id: string | null
  description: string | null
  user_id: string | null
  created_at: string
  // joined
  cash_register?: CashRegister
  user?: Profile
}

export type ProviderType = 'street' | 'recycler' | 'company' | 'other'

export interface Provider {
  id: string
  name: string
  type: ProviderType | null
  phone: string | null
  notes: string | null
  active: boolean
  created_at: string
}

export type PurchaseStatus = 'active' | 'reversed'

export interface Purchase {
  id: string
  operator_id: string | null
  provider_id: string | null
  cash_register_id: string | null
  total: number
  date: string
  notes: string | null
  status: PurchaseStatus
  created_by: string | null
  created_at: string
  // joined
  operator?: Profile
  provider?: Provider
  cash_register?: CashRegister
  purchase_items?: PurchaseItem[]
}

export interface PurchaseItem {
  id: string
  purchase_id: string
  material_id: string
  quantity: number
  price_per_unit: number
  total: number
  // joined
  material?: Material
}

export interface Inventory {
  id: string
  material_id: string
  quantity: number
  avg_cost: number
  updated_at: string
  // joined
  material?: Material
}

export type InventoryMovementType =
  | 'purchase'
  | 'sale'
  | 'adjustment_loss'
  | 'adjustment_gain'
  | 'adjustment_correction'
  | 'conversion_in'
  | 'conversion_out'
  | 'shrinkage'

export interface InventoryMovement {
  id: string
  material_id: string
  type: InventoryMovementType
  quantity: number
  cost_per_unit: number | null
  balance_after: number | null
  reference_id: string | null
  reference_type: string | null
  reason: string | null
  user_id: string | null
  created_at: string
  // joined
  material?: Material
  user?: Profile
}

export type AdjustmentType = 'loss' | 'gain' | 'correction' | 'conversion' | 'shrinkage'

export interface InventoryAdjustment {
  id: string
  type: AdjustmentType
  material_id: string | null
  quantity: number
  reason: string
  notes: string | null
  user_id: string | null
  created_at: string
  // joined
  material?: Material
  user?: Profile
}

export type SaleStatus = 'active' | 'reversed'

export interface Sale {
  id: string
  customer_name: string | null
  operator_id: string | null
  cash_register_id: string | null
  total: number
  date: string
  notes: string | null
  status: SaleStatus
  created_by: string | null
  created_at: string
  // joined
  operator?: Profile
  cash_register?: CashRegister
  sale_items?: SaleItem[]
}

export interface SaleItem {
  id: string
  sale_id: string
  material_id: string
  quantity: number
  price_per_unit: number
  total: number
  // joined
  material?: Material
}

export type ExpenseCategory = 'salary' | 'transport' | 'supplies' | 'maintenance' | 'other'

export interface Expense {
  id: string
  category: ExpenseCategory
  description: string
  amount: number
  cash_register_id: string | null
  user_id: string | null
  date: string
  created_at: string
  // joined
  cash_register?: CashRegister
  user?: Profile
}

// Form types
export interface PurchaseItemForm {
  material_id: string
  quantity: number
  price_per_unit: number
  total: number
}

export interface NewPurchaseForm {
  operator_id: string
  provider_id: string
  cash_register_id: string
  notes: string
  items: PurchaseItemForm[]
}

export interface SaleItemForm {
  material_id: string
  quantity: number
  price_per_unit: number
  total: number
}

export interface NewSaleForm {
  customer_name: string
  operator_id: string
  cash_register_id: string
  notes: string
  items: SaleItemForm[]
}

export interface TransferForm {
  from_register_id: string
  to_register_id: string
  amount: number
  description: string
}

// Dashboard stats
export interface DashboardStats {
  totalCash: number
  totalInventoryValue: number
  todayPurchases: number
  todaySales: number
}
