import { useLocation, useNavigate } from 'react-router-dom'
import { LogOut, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'

const titles = {
  '/':                'Dashboard',
  '/quotations':      'Quotations',
  '/sales-orders':    'Sales Orders',
  '/invoices':        'Invoices',
  '/purchase-orders': 'Purchase Orders',
  '/inventory':       'Inventory',
  '/einvoice':        'E-Invoice',
  '/settings':        'Settings',
}

export default function Header() {
  const { profile, logout } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const base = '/' + pathname.split('/')[1]
  const title = titles[base] ?? 'Foundry ERP'

  async function handleLogout() {
    try {
      await logout()
    } catch {
      // signOut network errors are non-fatal — state is cleared in finally
    }
    navigate('/login', { replace: true })
  }

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <User className="h-4 w-4" />
          <span>{profile?.name}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
