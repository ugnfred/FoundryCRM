import { useLocation, useNavigate } from 'react-router-dom'
import { LogOut, User, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'

const titles = {
  '/':                   'Dashboard',
  '/quotations':         'Quotations',
  '/sales-orders':       'Sales Orders',
  '/invoices':           'Invoices',
  '/credit-notes':       'Credit Notes',
  '/proforma':           'Proforma Invoices',
  '/delivery-challans':  'Delivery Challans',
  '/advance-receipts':   'Advance Receipts',
  '/bom':                'Bill of Materials',
  '/work-orders':        'Work Orders',
  '/purchase-orders':    'Purchase Orders',
  '/grns':               'Goods Receipt Notes',
  '/inventory':          'Inventory',
  '/einvoice':           'E-Invoice',
  '/reports':            'Reports',
  '/settings':           'Settings',
}

export default function Header({ onMenuClick }) {
  const { profile, logout } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const base = '/' + pathname.split('/')[1]
  const title = titles[base] ?? 'Foundry ERP'

  async function handleLogout() {
    try { await logout() } catch {}
    navigate('/login', { replace: true })
  }

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-4 md:px-6">
      <div className="flex items-center gap-3">
        {/* Hamburger — only on mobile */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600">
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
