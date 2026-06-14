import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { FileSpreadsheet, FileJson, Search, ChevronDown, ChevronRight } from 'lucide-react'

const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function SectionCard({ title, color = 'blue', children }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border rounded-lg overflow-hidden mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-4 py-3 bg-${color}-50 border-b text-left`}
      >
        <span className="font-semibold text-sm">{title}</span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  )
}

function AmtTable({ headers, rows, totals }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-100">
            {headers.map(h => (
              <th key={h} className="px-3 py-2 text-left font-medium text-slate-700">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t hover:bg-slate-50">
              {row.map((cell, j) => (
                <td key={j} className={`px-3 py-2 ${j >= 3 ? 'text-right font-mono' : ''}`}>{cell}</td>
              ))}
            </tr>
          ))}
          {totals && (
            <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
              {totals.map((cell, j) => (
                <td key={j} className={`px-3 py-2 ${j >= 3 ? 'text-right font-mono' : ''}`}>{cell}</td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="text-center text-slate-400 py-6 text-sm">No data for this period</p>
      )}
    </div>
  )
}

export default function GSTR1() {
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10)

  const [fromDate, setFromDate] = useState(firstDay)
  const [toDate, setToDate] = useState(lastDay)
  const [fetching, setFetching] = useState(false)
  const [queryParams, setQueryParams] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['gstr1', queryParams],
    queryFn: () => reportsApi.gstr1(queryParams),
    enabled: !!queryParams,
  })

  const handleFetch = () => setQueryParams({ from_date: fromDate, to_date: toDate })

  const handleDownloadExcel = async () => {
    setFetching(true)
    try {
      const blob = await reportsApi.gstr1Excel({ from_date: fromDate, to_date: toDate })
      downloadBlob(blob, `GSTR-1_${fromDate}_${toDate}.xlsx`)
    } finally {
      setFetching(false)
    }
  }

  const handleDownloadJson = async () => {
    setFetching(true)
    try {
      const blob = await reportsApi.gstr1Json({ from_date: fromDate, to_date: toDate })
      downloadBlob(blob, `GSTR-1_${fromDate}_${toDate}.json`)
    } finally {
      setFetching(false)
    }
  }

  // Compute totals
  const b2bTotal = data?.b2b?.reduce((acc, e) => {
    e.invoices?.forEach(inv => {
      acc.taxable += inv.taxable_amt || 0
      acc.cgst += inv.cgst || 0
      acc.sgst += inv.sgst || 0
      acc.igst += inv.igst || 0
      acc.total += inv.total || 0
    })
    return acc
  }, { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 })

  const b2csTotal = data?.b2cs?.reduce((acc, r) => ({
    taxable: acc.taxable + (r.taxable_amt || 0),
    cgst: acc.cgst + (r.cgst || 0),
    sgst: acc.sgst + (r.sgst || 0),
    igst: acc.igst + (r.igst || 0),
    total: acc.total + (r.total || 0),
  }), { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 })

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">GSTR-1</h1>
        <p className="text-slate-500 text-sm mt-1">Outward supplies — B2B, B2CS, Credit Notes, HSN Summary</p>
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
          <>
            <Button variant="outline" onClick={handleDownloadExcel} disabled={fetching}>
              <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
              Excel
            </Button>
            <Button variant="outline" onClick={handleDownloadJson} disabled={fetching}>
              <FileJson className="h-4 w-4 mr-2 text-blue-600" />
              NIC JSON
            </Button>
          </>
        )}
      </div>

      {data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'B2B Invoices', value: data.b2b?.reduce((a, e) => a + (e.invoices?.length || 0), 0) || 0, sub: `₹${fmt(b2bTotal?.total)}` },
              { label: 'B2CS Transactions', value: data.b2cs?.length || 0, sub: `₹${fmt(b2csTotal?.total)}` },
              { label: 'Credit Notes', value: data.cdnr?.reduce((a, e) => a + (e.notes?.length || 0), 0) + (data.cdns?.length || 0), sub: '' },
              { label: 'HSN Lines', value: data.hsn?.length || 0, sub: '' },
            ].map(card => (
              <div key={card.label} className="bg-white border rounded-lg p-4">
                <p className="text-xs text-slate-500">{card.label}</p>
                <p className="text-2xl font-bold mt-1">{card.value}</p>
                {card.sub && <p className="text-xs text-slate-500 mt-1">{card.sub}</p>}
              </div>
            ))}
          </div>

          {/* B2B Section */}
          <SectionCard title={`3A — B2B Supplies (${data.b2b?.reduce((a, e) => a + (e.invoices?.length || 0), 0)} invoices)`}>
            {data.b2b?.map((entry, i) => (
              <div key={i} className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium text-sm">{entry.name}</span>
                  <Badge variant="outline" className="font-mono text-xs">{entry.invoices?.[0]?.gstin}</Badge>
                </div>
                <AmtTable
                  headers={['Invoice No', 'Date', 'Place of Supply', 'Taxable (₹)', 'CGST (₹)', 'SGST (₹)', 'IGST (₹)', 'Total (₹)']}
                  rows={entry.invoices?.map(inv => [
                    inv.inv_no, inv.date, inv.place_of_supply,
                    fmt(inv.taxable_amt), fmt(inv.cgst), fmt(inv.sgst), fmt(inv.igst), fmt(inv.total),
                  ])}
                />
              </div>
            ))}
            {b2bTotal && (
              <div className="flex justify-end mt-2">
                <div className="bg-blue-50 rounded px-4 py-2 text-sm font-semibold">
                  Total Taxable: ₹{fmt(b2bTotal.taxable)} &nbsp;|&nbsp; Total: ₹{fmt(b2bTotal.total)}
                </div>
              </div>
            )}
          </SectionCard>

          {/* B2CS Section */}
          <SectionCard title={`3B — B2CS Supplies (Unregistered)`} color="green">
            <AmtTable
              headers={['Place of Supply', 'Taxable (₹)', 'CGST (₹)', 'SGST (₹)', 'IGST (₹)', 'Total (₹)']}
              rows={data.b2cs?.map(r => [r.place_of_supply, fmt(r.taxable_amt), fmt(r.cgst), fmt(r.sgst), fmt(r.igst), fmt(r.total)])}
              totals={b2csTotal ? ['Total', fmt(b2csTotal.taxable), fmt(b2csTotal.cgst), fmt(b2csTotal.sgst), fmt(b2csTotal.igst), fmt(b2csTotal.total)] : null}
            />
          </SectionCard>

          {/* CDNR */}
          <SectionCard title={`4 — Credit Notes (${data.cdnr?.reduce((a, e) => a + (e.notes?.length || 0), 0) + (data.cdns?.length || 0)} notes)`} color="red">
            {(data.cdnr?.length > 0 || data.cdns?.length > 0) ? (
              <AmtTable
                headers={['CN No', 'Date', 'Customer', 'Linked Invoice', 'Reason', 'Taxable (₹)', 'CGST (₹)', 'SGST (₹)', 'IGST (₹)']}
                rows={[
                  ...(data.cdnr?.flatMap(e => e.notes?.map(cn => [cn.cn_no, cn.date, cn.customer, cn.linked_inv, cn.reason, fmt(cn.taxable_amt), fmt(cn.cgst), fmt(cn.sgst), fmt(cn.igst)])) || []),
                  ...(data.cdns?.map(cn => [cn.cn_no, cn.date, cn.customer, cn.linked_inv, cn.reason, fmt(cn.taxable_amt), fmt(cn.cgst), fmt(cn.sgst), fmt(cn.igst)]) || []),
                ]}
              />
            ) : <p className="text-slate-400 text-sm">No credit notes for this period</p>}
          </SectionCard>

          {/* HSN Summary */}
          <SectionCard title={`12 — HSN Summary (${data.hsn?.length} lines)`} color="purple">
            <AmtTable
              headers={['HSN Code', 'Description', 'UOM', 'GST Rate %', 'Qty', 'Taxable (₹)', 'CGST (₹)', 'SGST (₹)', 'IGST (₹)']}
              rows={data.hsn?.map(h => [h.hsn_code, h.description, h.uom, h.gst_rate, h.qty, fmt(h.taxable_amt), fmt(h.cgst), fmt(h.sgst), fmt(h.igst)])}
            />
          </SectionCard>
        </>
      )}
    </div>
  )
}
