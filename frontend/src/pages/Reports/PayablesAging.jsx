import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FileSpreadsheet, Search } from 'lucide-react'

const BUCKETS = ['0-30 days', '31-60 days', '61-90 days', '91-120 days', '120+ days']

const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function PayablesAging() {
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10))
  const [fetching, setFetching] = useState(false)
  const [queryParams, setQueryParams] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['payables-aging', queryParams],
    queryFn: () => reportsApi.payablesAging(queryParams),
    enabled: !!queryParams,
  })

  const rows = data?.rows || []

  const bucketTotals = BUCKETS.reduce((acc, b) => {
    acc[b] = rows.reduce((s, r) => s + (r[b] || 0), 0)
    return acc
  }, {})
  const grandTotal = rows.reduce((s, r) => s + (r.total || 0), 0)

  const handleFetch = () => setQueryParams({ as_of: asOf })

  const handleExcel = async () => {
    setFetching(true)
    try {
      const blob = await reportsApi.payablesAgingXlsx({ as_of: asOf })
      downloadBlob(blob, `Payables_Aging_${asOf}.xlsx`)
    } finally {
      setFetching(false)
    }
  }

  const bucketColors = ['text-green-700', 'text-yellow-700', 'text-orange-700', 'text-red-600', 'text-red-800']

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Payables Aging</h1>
        <p className="text-slate-500 text-sm mt-1">Outstanding supplier purchase orders by age bucket (based on delivery date)</p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-end p-4 bg-white border rounded-lg">
        <div className="space-y-1">
          <label className="text-xs text-slate-500">As of Date</label>
          <Input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} className="w-40" />
        </div>
        <Button onClick={handleFetch} disabled={isLoading}>
          <Search className="h-4 w-4 mr-2" />
          {isLoading ? 'Loading…' : 'Generate'}
        </Button>
        {rows.length > 0 && (
          <Button variant="outline" onClick={handleExcel} disabled={fetching}>
            <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
            Excel
          </Button>
        )}
      </div>

      {data && rows.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg">No outstanding payables as of {data.as_of}</p>
        </div>
      )}

      {rows.length > 0 && (
        <>
          {/* Bucket summary cards */}
          <div className="grid grid-cols-5 gap-3">
            {BUCKETS.map((b, i) => (
              <div key={b} className={`border rounded-lg p-3 ${i >= 3 ? 'bg-red-50 border-red-200' : i === 2 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50'}`}>
                <p className={`text-xs font-medium ${bucketColors[i]}`}>{b}</p>
                <p className={`text-lg font-bold mt-1 ${bucketColors[i]}`}>₹{fmt(bucketTotals[b])}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {grandTotal > 0 ? `${((bucketTotals[b] / grandTotal) * 100).toFixed(1)}%` : '—'}
                </p>
              </div>
            ))}
          </div>

          {/* Data table */}
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="bg-orange-600 text-white px-4 py-3 flex items-center justify-between">
              <h3 className="font-semibold text-sm">Supplier-wise Aging — As of {data.as_of}</h3>
              <span className="text-xs bg-white/20 px-2 py-1 rounded">{rows.length} suppliers</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Supplier</th>
                    <th className="px-3 py-2 text-left font-medium">GSTIN</th>
                    {BUCKETS.map((b, i) => (
                      <th key={b} className={`px-3 py-2 text-right font-medium ${bucketColors[i]}`}>{b}</th>
                    ))}
                    <th className="px-3 py-2 text-right font-medium">Total (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="border-t hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium">{row.supplier_name}</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-500">{row.gstin || '—'}</td>
                      {BUCKETS.map((b, bi) => (
                        <td key={b} className={`px-3 py-2 text-right font-mono ${row[b] > 0 ? bucketColors[bi] : 'text-slate-300'}`}>
                          {row[b] > 0 ? fmt(row[b]) : '—'}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right font-mono font-semibold">₹{fmt(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-300 bg-orange-50 font-semibold">
                  <tr>
                    <td className="px-3 py-3" colSpan={2}>TOTAL ({rows.length} suppliers)</td>
                    {BUCKETS.map((b) => (
                      <td key={b} className="px-3 py-3 text-right font-mono">₹{fmt(bucketTotals[b])}</td>
                    ))}
                    <td className="px-3 py-3 text-right font-mono">₹{fmt(grandTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
