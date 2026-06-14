import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from '@/store/authStore'
import Layout from '@/components/layout/Layout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Quotations from '@/pages/Quotations'
import SalesOrders from '@/pages/SalesOrders'
import Invoices from '@/pages/Invoices'
import PurchaseOrders from '@/pages/PurchaseOrders'
import Inventory from '@/pages/Inventory'
import EInvoice from '@/pages/EInvoice'
import Settings from '@/pages/Settings'
import GRNs from '@/pages/GRNs'
import CreditNotes from '@/pages/CreditNotes'
import ProformaInvoices from '@/pages/ProformaInvoices'
import DeliveryChallans from '@/pages/DeliveryChallans'
import AdvanceReceipts from '@/pages/AdvanceReceipts'
import BOM from '@/pages/BOM'
import WorkOrders from '@/pages/WorkOrders'
import Reports from '@/pages/Reports'
import GSTR1 from '@/pages/Reports/GSTR1'
import GSTR3B from '@/pages/Reports/GSTR3B'
import ReceivablesAging from '@/pages/Reports/ReceivablesAging'
import PayablesAging from '@/pages/Reports/PayablesAging'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuthStore()
  if (loading) return <div className="flex h-screen items-center justify-center text-muted-foreground text-sm">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const init = useAuthStore((s) => s.init)
  useEffect(() => {
    let cleanup
    init().then(fn => { cleanup = fn })
    return () => { cleanup?.() }
  }, [init])

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="quotations" element={<Quotations />} />
        <Route path="sales-orders" element={<SalesOrders />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="purchase-orders" element={<PurchaseOrders />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="einvoice" element={<EInvoice />} />
        <Route path="grns" element={<GRNs />} />
        <Route path="credit-notes" element={<CreditNotes />} />
        <Route path="proforma" element={<ProformaInvoices />} />
        <Route path="delivery-challans" element={<DeliveryChallans />} />
        <Route path="work-orders" element={<WorkOrders />} />
        <Route path="advance-receipts" element={<AdvanceReceipts />} />
        <Route path="bom" element={<BOM />} />
        <Route path="reports" element={<Reports />} />
        <Route path="reports/gstr1" element={<GSTR1 />} />
        <Route path="reports/gstr3b" element={<GSTR3B />} />
        <Route path="reports/receivables-aging" element={<ReceivablesAging />} />
        <Route path="reports/payables-aging" element={<PayablesAging />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
