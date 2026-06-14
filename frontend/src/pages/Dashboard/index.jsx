import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { FileText, ShoppingCart, Receipt, AlertCircle, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { invoicesApi, quotationsApi, ordersApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

function StatCard({ title, value, icon: Icon, sub, color = 'text-primary', onClick }) {
  return (
    <Card className={onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} onClick={onClick}>
      <CardContent className="flex items-center gap-4 pt-6">
        <div className={`rounded-lg bg-primary/10 p-3 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: invoicesApi.list })
  const { data: quotations = [] } = useQuery({ queryKey: ['quotations'], queryFn: quotationsApi.list })
  const { data: orders = [] } = useQuery({ queryKey: ['orders'], queryFn: ordersApi.list })

  const totalRevenue = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + Number(i.total), 0)
  const totalOutstanding = invoices
    .filter((i) => ['sent', 'partially_paid', 'overdue'].includes(i.status))
    .reduce((s, i) => s + Number(i.balance_due ?? i.total), 0)
  const openQuotations = quotations.filter((q) => ['draft', 'sent'].includes(q.status)).length
  const activeOrders = orders.filter((o) => ['confirmed', 'dispatched'].includes(o.status)).length
  const overdueCount = invoices.filter((i) => i.status === 'overdue').length

  // Revenue by YYYY-MM key to avoid different years merging
  const revenueByMonth = invoices
    .filter((i) => i.status === 'paid' && i.date)
    .reduce((acc, inv) => {
      const d = new Date(inv.date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      acc[key] = (acc[key] ?? 0) + Number(inv.total)
      return acc
    }, {})

  const revenueData = Object.entries(revenueByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([key, revenue]) => ({
      month: new Date(key + '-01').toLocaleString('en-IN', { month: 'short', year: '2-digit' }),
      revenue,
    }))

  // Top 5 customers by total billed
  const customerMap = {}
  invoices.forEach((inv) => {
    const name = inv.companies?.name ?? 'Unknown'
    if (!customerMap[name]) customerMap[name] = { name, billed: 0, paid: 0, outstanding: 0 }
    customerMap[name].billed += Number(inv.total ?? 0)
    if (inv.status === 'paid') customerMap[name].paid += Number(inv.total ?? 0)
    if (['sent', 'partially_paid', 'overdue'].includes(inv.status))
      customerMap[name].outstanding += Number(inv.balance_due ?? inv.total ?? 0)
  })
  const topCustomers = Object.values(customerMap).sort((a, b) => b.billed - a.billed).slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard title="Total Revenue" value={formatCurrency(totalRevenue)} icon={Receipt} sub="Paid invoices" />
        <StatCard title="Outstanding" value={formatCurrency(totalOutstanding)} icon={AlertCircle} color="text-orange-500" sub="Pending collection" />
        <StatCard title="Open Quotations" value={openQuotations} icon={FileText} sub="Draft + Sent" />
        <StatCard title="Active Orders" value={activeOrders} icon={ShoppingCart} sub="Confirmed + Dispatched" />
        <StatCard
          title="Overdue Invoices"
          value={overdueCount}
          icon={AlertTriangle}
          color="text-red-600"
          sub="Click to view"
          onClick={overdueCount > 0 ? () => navigate('/invoices') : undefined}
        />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Revenue Trend (Last 6 Months)</CardTitle></CardHeader>
        <CardContent>
          {revenueData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No paid invoices yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Area type="monotone" dataKey="revenue" stroke="#2563eb" fill="url(#rev)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Top Customers by Revenue</CardTitle></CardHeader>
          <CardContent>
            {topCustomers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invoice data yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="pb-2 text-left font-medium">Customer</th>
                    <th className="pb-2 text-right font-medium">Billed</th>
                    <th className="pb-2 text-right font-medium">Paid</th>
                    <th className="pb-2 text-right font-medium">Outstanding</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {topCustomers.map((c) => (
                    <tr key={c.name}>
                      <td className="py-2 font-medium">{c.name}</td>
                      <td className="py-2 text-right">{formatCurrency(c.billed)}</td>
                      <td className="py-2 text-right text-green-700">{formatCurrency(c.paid)}</td>
                      <td className="py-2 text-right text-orange-600">{formatCurrency(c.outstanding)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Recent Invoices</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {invoices.slice(0, 6).map((inv) => (
                <div key={inv.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium w-20">{inv.inv_no}</span>
                  <span className="text-muted-foreground flex-1 truncate px-2">{inv.companies?.name}</span>
                  <span className="font-semibold">{formatCurrency(inv.total)}</span>
                </div>
              ))}
              {invoices.length === 0 && <p className="text-sm text-muted-foreground">No invoices yet.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
