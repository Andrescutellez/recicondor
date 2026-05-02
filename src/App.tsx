import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from './hooks/useAuth'
import { Layout } from './components/layout/Layout'

// Pages
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { CashList } from './pages/cash/CashList'
import { CashDetail } from './pages/cash/CashDetail'
import { PurchaseList } from './pages/purchases/PurchaseList'
import { NewPurchase } from './pages/purchases/NewPurchase'
import { InventoryList } from './pages/inventory/InventoryList'
import { Kardex } from './pages/inventory/Kardex'
import { AdjustmentForm } from './pages/inventory/AdjustmentForm'
import { SaleList } from './pages/sales/SaleList'
import { NewSale } from './pages/sales/NewSale'
import { ExpenseList } from './pages/expenses/ExpenseList'
import { MaterialList } from './pages/materials/MaterialList'
import { Reports } from './pages/reports/Reports'
import { UserList } from './pages/users/UserList'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function AppRoutes() {
  const { user } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <Login />}
      />

      <Route
        path="/"
        element={
          <AuthGuard>
            <Layout>
              <Navigate to="/dashboard" replace />
            </Layout>
          </AuthGuard>
        }
      />

      <Route
        path="/dashboard"
        element={
          <AuthGuard>
            <Layout>
              <Dashboard />
            </Layout>
          </AuthGuard>
        }
      />

      {/* Cash */}
      <Route path="/cash" element={<AuthGuard><Layout><CashList /></Layout></AuthGuard>} />
      <Route path="/cash/:id" element={<AuthGuard><Layout><CashDetail /></Layout></AuthGuard>} />

      {/* Purchases */}
      <Route path="/purchases" element={<AuthGuard><Layout><PurchaseList /></Layout></AuthGuard>} />
      <Route path="/purchases/new" element={<AuthGuard><Layout><NewPurchase /></Layout></AuthGuard>} />

      {/* Inventory */}
      <Route path="/inventory" element={<AuthGuard><Layout><InventoryList /></Layout></AuthGuard>} />
      <Route path="/inventory/kardex/:materialId" element={<AuthGuard><Layout><Kardex /></Layout></AuthGuard>} />
      <Route path="/inventory/adjustments" element={<AuthGuard><Layout><AdjustmentForm /></Layout></AuthGuard>} />

      {/* Sales */}
      <Route path="/sales" element={<AuthGuard><Layout><SaleList /></Layout></AuthGuard>} />
      <Route path="/sales/new" element={<AuthGuard><Layout><NewSale /></Layout></AuthGuard>} />

      {/* Other */}
      <Route path="/expenses" element={<AuthGuard><Layout><ExpenseList /></Layout></AuthGuard>} />
      <Route path="/materials" element={<AuthGuard><Layout><MaterialList /></Layout></AuthGuard>} />
      <Route path="/reports" element={<AuthGuard><Layout><Reports /></Layout></AuthGuard>} />
      <Route path="/users" element={<AuthGuard><Layout><UserList /></Layout></AuthGuard>} />

      {/* 404 */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
