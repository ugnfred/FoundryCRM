import { useNavigate } from 'react-router-dom'
import { FileText, TrendingDown, TrendingUp, BarChart3 } from 'lucide-react'

const reports = [
  {
    title: 'GSTR-1',
    description: 'Outward supplies — B2B, B2CS, credit notes, HSN summary. Export as Excel or NIC JSON.',
    icon: FileText,
    color: 'blue',
    path: '/reports/gstr1',
    badge: 'Monthly',
  },
  {
    title: 'GSTR-3B',
    description: 'Monthly summary return with net tax payable after ITC setoff.',
    icon: BarChart3,
    color: 'indigo',
    path: '/reports/gstr3b',
    badge: 'Monthly',
  },
  {
    title: 'Receivables Aging',
    description: 'Outstanding customer balances aged into 0-30, 31-60, 61-90, 91-120, and 120+ day buckets.',
    icon: TrendingUp,
    color: 'green',
    path: '/reports/receivables-aging',
    badge: 'As-of Date',
  },
  {
    title: 'Payables Aging',
    description: 'Outstanding supplier purchase orders aged into buckets based on delivery date.',
    icon: TrendingDown,
    color: 'orange',
    path: '/reports/payables-aging',
    badge: 'As-of Date',
  },
]

const colorMap = {
  blue: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100',
  indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100',
  green: 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100',
  orange: 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100',
}

const iconBg = {
  blue: 'bg-blue-100 text-blue-600',
  indigo: 'bg-indigo-100 text-indigo-600',
  green: 'bg-green-100 text-green-600',
  orange: 'bg-orange-100 text-orange-600',
}

export default function Reports() {
  const navigate = useNavigate()
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-slate-500 text-sm mt-1">GST returns and financial aging reports</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((r) => {
          const Icon = r.icon
          return (
            <button
              key={r.path}
              onClick={() => navigate(r.path)}
              className={`flex gap-4 items-start p-5 border rounded-xl text-left transition-colors ${colorMap[r.color]}`}
            >
              <div className={`rounded-lg p-3 ${iconBg[r.color]}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-base">{r.title}</h3>
                  <span className="text-xs bg-white/60 border rounded px-2 py-0.5">{r.badge}</span>
                </div>
                <p className="text-sm mt-1 text-slate-600">{r.description}</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
