import { useQuery } from '@tanstack/react-query'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { FileText, ShoppingCart, Receipt, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { invoicesApi, quotationsApi, ordersApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

function StatCard({ title, value, icon: Icon, sub, color = 'text-primary' }) {
  return (
    <Card>
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
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: invoicesApi.list })
  const { data: quotations = [] } = useQuery({ queryKey: ['quotations'], queryFn: quotationsApi.list })
  const { data: orders = [] } = useQuery({ queryKey: ['orders'], queryFn: ordersApi.list })

  const totalRevenue = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + Number(i.total), 0)
  const totalOutstanding = invoices.filter((i) => ['sent', 'partially_paid', 'overdue'].includes(i.status)).reduce((s, i) => s + Number(i.balance_due ?? i.total), 0)
  const openQuotations = quotations.filter((q) => ['draft', 'sent'].includes(q.status)).length
  const activeOrders = orders.filter((o) => ['confirmed', 'dispatched'].includes(o.status)).length

  // Last 6 months revenue (mock structure — replace with real aggregation)
  const revenueData = invoices
    .filter((i) => i.status === 'paid')
    .reduce((acc, inv) => {
      const month = new Date(inv.date).toLocaleString('en-IN', { month: 'short' })
      const existing = acc.find((a) => a.month === month)
      if (existing) existing.revenue += Number(inv.total)
      else acc.push({ month, revenue: Number(inv.total) })
      return acc
    }, [])
    .slice(-6)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Total Revenue" value={formatCurrency(totalRevenue)} icon={Receipt} sub="Paid invoices" />
        <StatCard title="Outstanding" value={formatCurrency(totalOutstanding)} icon={AlertCircle} color="text-orange-500" sub="Pending collection" />
        <StatCard title="Open Quotations" value={openQuotations} icon={FileText} sub="Draft + Sent" />
        <StatCard title="Active Orders" value={activeOrders} icon={ShoppingCart} sub="Confirmed + Dispatched" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Revenue Trend</CardTitle></CardHeader>
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
          <CardHeader><CardTitle className="text-base">Recent Invoices</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {invoices.slice(0, 5).map((inv) => (
                <div key={inv.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{inv.inv_no}</span>
                  <span className="text-muted-foreground">{inv.companies?.name}</span>
                  <span className="font-semibold">{formatCurrency(inv.total)}</span>
                </div>
              ))}
              {invoices.length === 0 && <p className="text-sm text-muted-foreground">No invoices yet.</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Recent Quotations</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {quotations.slice(0, 5).map((q) => (
                <div key={q.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{q.quot_no}</span>
                  <span className="text-muted-foreground">{q.companies?.name}</span>
                  <span className="capitalize text-muted-foreground">{q.status}</span>
                </div>
              ))}
              {quotations.length === 0 && <p className="text-sm text-muted-foreground">No quotations yet.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
