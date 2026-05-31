import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, FileText, ShoppingCart, Receipt,
  Package, Warehouse, Zap, Settings, ChevronRight,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { settingsApi } from '@/lib/api'

const nav = [
  { to: '/',                  label: 'Dashboard',       icon: LayoutDashboard, roles: ['admin','sales','accounts','dispatch'] },
  { to: '/quotations',        label: 'Quotations',      icon: FileText,        roles: ['admin','sales','accounts'] },
  { to: '/sales-orders',      label: 'Sales Orders',    icon: ShoppingCart,    roles: ['admin','sales','accounts'] },
  { to: '/invoices',          label: 'Invoices',        icon: Receipt,         roles: ['admin','sales','accounts'] },
  { to: '/purchase-orders',   label: 'Purchase Orders', icon: Package,         roles: ['admin','accounts'] },
  { to: '/inventory',         label: 'Inventory',       icon: Warehouse,       roles: ['admin','sales','accounts','dispatch'] },
  { to: '/einvoice',          label: 'E-Invoice',       icon: Zap,             roles: ['admin','accounts'] },
  { to: '/settings',          label: 'Settings',        icon: Settings,        roles: ['admin'] },
]

export default function Sidebar() {
  const { role } = useAuth()
  const { data: company } = useQuery({ queryKey: ['company-settings'], queryFn: settingsApi.getCompany })

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-white">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2 border-b px-5">
        {company?.logo_url
          ? <img src={company.logo_url} alt="Logo" className="h-8 w-8 rounded-lg object-contain" />
          : <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white font-bold text-sm">F</div>
        }
        <span className="font-semibold text-gray-900">{company?.name || 'Foundry ERP'}</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {nav
          .filter((item) => item.roles.includes(role))
          .map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
      </nav>

      {/* Role badge */}
      <div className="border-t p-4">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium capitalize text-secondary-foreground">
          <ChevronRight className="h-3 w-3" /> {role}
        </span>
      </div>
    </aside>
  )
}
