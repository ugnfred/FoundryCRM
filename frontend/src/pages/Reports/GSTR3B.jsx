import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FileSpreadsheet, Search, TrendingUp, TrendingDown, DollarSign } from 'lucide-react'

const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function SummaryRow({ table, description, cgst, sgst, igst, bold }) {
  return (
    <tr className={`border-t ${bold ? 'bg-blue-50 font-bold' : 'hover:bg-slate-50'}`}>
      <td className="px-4 py-3 font-mono text-xs text-slate-600">{table}</td>
      <td className="px-4 py-3 text-sm">{description}</td>
      <td className="px-4 py-3 text-right font-mono text-sm">₹{fmt(cgst)}</td>
      <td className="px-4 py-3 text-right font-mono text-sm">₹{fmt(sgst)}</td>
      <td className="px-4 py-3 text-right font-mono text-sm">₹{fmt(igst)}</td>
      <td className="px-4 py-3 text-right font-mono text-sm font-semibold">
        ₹{fmt((cgst || 0) + (sgst || 0) + (igst || 0))}
      </td>
    </tr>
  )
}

export default function GSTR3B() {
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10)

  const [fromDate, setFromDate] = useState(firstDay)
  const [toDate, setToDate] = useState(lastDay)
  const [fetching, setFetching] = useState(false)
  const [queryParams, setQueryParams] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['gstr3b', queryParams],
    queryFn: () => reportsApi.gstr3b(queryParams),
    enabled: !!queryParams,
  })

  const handleFetch = () => setQueryParams({ from_date: fromDate, to_date: toDate })

  const handleExcel = async () => {
    setFetching(true)
    try {
      const blob = await reportsApi.gstr3bExcel({ from_date: fromDate, to_date: toDate })
      downloadBlob(blob, `GSTR-3B_${fromDate}_${toDate}.xlsx`)
    } finally {
      setFetching(false)
    }
  }

  const s31 = data?.['3_1']
  const s4 = data?.['4']
  const s5 = data?.['5']

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">GSTR-3B</h1>
        <p className="text-slate-500 text-sm mt-1">Monthly summary return — outward supplies, ITC, and net tax payable</p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-end p-4 bg-white border rounded-lg">
        <div className="space-y-1">
          <label className="text-xs text-slate-500">From Date</label>
          <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-500">To Date</label>
          <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-40" />
        </div>
        <Button onClick={handleFetch} disabled={isLoading}>
          <Search className="h-4 w-4 mr-2" />
          {isLoading ? 'Loading…' : 'Generate'}
        </Button>
        {data && (
          <Button variant="outline" onClick={handleExcel} disabled={fetching}>
            <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
            Excel
          </Button>
        )}
      </div>

      {data && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-blue-700 mb-2">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs font-medium">Outward GST Collected</span>
              </div>
              <p className="text-2xl font-bold text-blue-800">
                ₹{fmt((s31?.a_cgst || 0) + (s31?.a_sgst || 0) + (s31?.a_igst || 0))}
              </p>
              <p className="text-xs text-blue-600 mt-1">Taxable: ₹{fmt(s31?.a_taxable)}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-700 mb-2">
                <TrendingDown className="h-4 w-4" />
                <span className="text-xs font-medium">Input Tax Credit (ITC)</span>
              </div>
              <p className="text-2xl font-bold text-green-800">₹{fmt(s4?.itc_total)}</p>
              <p className="text-xs text-green-600 mt-1">From purchases</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-amber-700 mb-2">
                <DollarSign className="h-4 w-4" />
                <span className="text-xs font-medium">Net Tax Payable</span>
              </div>
              <p className="text-2xl font-bold text-amber-800">₹{fmt(s5?.total)}</p>
              <p className="text-xs text-amber-600 mt-1">After ITC setoff</p>
            </div>
          </div>

          {/* 3.1 — Outward supplies */}
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="bg-blue-600 text-white px-4 py-3">
              <h3 className="font-semibold text-sm">Table 3.1 — Details of Outward Supplies and Inward Supplies liable to Reverse Charge</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Nature of Supply</th>
                  <th className="px-4 py-2 text-left font-medium">Table</th>
                  <th className="px-4 py-2 text-right font-medium">CGST (₹)</th>
                  <th className="px-4 py-2 text-right font-medium">SGST (₹)</th>
                  <th className="px-4 py-2 text-right font-medium">IGST (₹)</th>
                  <th className="px-4 py-2 text-right font-medium">Total (₹)</th>
                </tr>
              </thead>
              <tbody>
                <SummaryRow table="3.1(a)" description="Outward taxable supplies (other than zero-rated, nil-rated, exempt)" cgst={s31?.a_cgst} sgst={s31?.a_sgst} igst={s31?.a_igst} />
                <SummaryRow table="3.1(b)" description="Outward taxable supplies (nil-rated)" cgst={0} sgst={0} igst={0} />
                <SummaryRow table="3.1(c)" description="Other outward supplies (exempt)" cgst={0} sgst={0} igst={0} />
                <SummaryRow table="3.1(d)" description="Inward supplies (liable to reverse charge)" cgst={0} sgst={0} igst={0} />
                <SummaryRow table="3.1(e)" description="Non-GST outward supplies" cgst={0} sgst={0} igst={0} />
              </tbody>
            </table>
          </div>

          {/* 4 — ITC */}
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="bg-green-600 text-white px-4 py-3">
              <h3 className="font-semibold text-sm">Table 4 — Eligible ITC</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Table</th>
                  <th className="px-4 py-2 text-left font-medium">Description</th>
                  <th className="px-4 py-2 text-right font-medium">CGST (₹)</th>
                  <th className="px-4 py-2 text-right font-medium">SGST (₹)</th>
                  <th className="px-4 py-2 text-right font-medium">IGST (₹)</th>
                  <th className="px-4 py-2 text-right font-medium">Total (₹)</th>
                </tr>
              </thead>
              <tbody>
                <SummaryRow table="4(A)" description="ITC Available — all other ITC (from purchase orders)" cgst={s4?.itc_cgst} sgst={s4?.itc_sgst} igst={s4?.itc_igst} />
              </tbody>
            </table>
          </div>

          {/* 5 — Net Tax */}
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="bg-amber-600 text-white px-4 py-3">
              <h3 className="font-semibold text-sm">Table 5 — Net Tax Payable</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Table</th>
                  <th className="px-4 py-2 text-left font-medium">Description</th>
                  <th className="px-4 py-2 text-right font-medium">CGST (₹)</th>
                  <th className="px-4 py-2 text-right font-medium">SGST (₹)</th>
                  <th className="px-4 py-2 text-right font-medium">IGST (₹)</th>
                  <th className="px-4 py-2 text-right font-medium">Total (₹)</th>
                </tr>
              </thead>
              <tbody>
                <SummaryRow table="5(A)" description="Tax payable after ITC setoff" cgst={s5?.cgst} sgst={s5?.sgst} igst={s5?.igst} bold />
              </tbody>
            </table>
          </div>

          <p className="text-xs text-slate-400">
            * ITC values are estimated from purchase orders. Actual ITC depends on supplier GSTR-2A reconciliation.
            Always verify with your CA before filing.
          </p>
        </>
      )}
    </div>
  )
}
