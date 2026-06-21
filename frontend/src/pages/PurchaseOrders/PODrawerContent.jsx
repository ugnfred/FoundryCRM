import { DrawerSection, DrawerFields } from '@/components/shared/DetailDrawer'
import { Building2 } from 'lucide-react'

const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })

export default function PODrawerContent({ po }) {
  if (!po) return null
  const items = po.po_items ?? []
  const company = po.companies
  const totalOrdered = items.reduce((s, i) => s + Number(i.qty ?? 0), 0)
  const totalReceived = items.reduce((s, i) => s + Number(i.received_qty ?? 0), 0)
  const receivedPct = totalOrdered > 0 ? Math.min(100, Math.round((totalReceived / totalOrdered) * 100)) : 0

  return (
    <>
      {company && (
        <DrawerSection title="Supplier">
          <div className="flex items-start gap-3 rounded-lg border bg-slate-50 px-4 py-3">
            <Building2 className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-slate-800">{company.name}</p>
              {company.gstin && <p className="text-slate-500 text-xs mt-0.5">GSTIN: {company.gstin}</p>}
              {(company.city || company.state) && (
                <p className="text-slate-500 text-xs">{[company.city, company.state].filter(Boolean).join(', ')}</p>
              )}
            </div>
          </div>
        </DrawerSection>
      )}

      <DrawerSection title="Details">
        <DrawerFields fields={[
          { label: 'PO Date', value: po.date },
          { label: 'Expected Delivery', value: po.delivery_date || '—' },
          { label: 'Payment Terms', value: po.payment_terms || '—' },
          po.notes ? { label: 'Notes', value: po.notes } : null,
        ].filter(Boolean)} />
      </DrawerSection>

      {/* Received progress */}
      {totalOrdered > 0 && (
        <DrawerSection title="Receipt Progress">
          <div className="rounded-lg border bg-slate-50 px-4 py-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Received</span>
              <span className="font-mono font-semibold">{totalReceived} / {totalOrdered} units ({receivedPct}%)</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className={`h-2 rounded-full transition-all ${receivedPct === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                style={{ width: `${receivedPct}%` }} />
            </div>
          </div>
        </DrawerSection>
      )}

      {items.length > 0 && (
        <DrawerSection title={`Line Items (${items.length})`}>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">#</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">Item</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500">Ordered</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500">Received</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500">Rate (₹)</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item, i) => {
                  const isPending = Number(item.received_qty ?? 0) < Number(item.qty ?? 0)
                  return (
                    <tr key={i} className={isPending ? 'hover:bg-amber-50' : 'hover:bg-gray-50'}>
                      <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{item.products?.name || item.description}</div>
                        {item.hsn_code && <div className="text-gray-400 text-[10px]">HSN {item.hsn_code} · {item.uom}</div>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{Number(item.qty).toLocaleString('en-IN')}</td>
                      <td className={`px-3 py-2 text-right font-mono font-semibold ${isPending ? 'text-amber-700' : 'text-green-700'}`}>
                        {Number(item.received_qty ?? 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(item.rate)}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(Number(item.qty) * Number(item.rate))}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </DrawerSection>
      )}

      <DrawerSection title="Summary">
        <div className="rounded-lg border bg-slate-50 px-4 py-3 space-y-2 text-sm">
          <div className="flex justify-between border-t pt-2 font-bold text-base">
            <span>Total</span><span className="font-mono">₹{fmt(po.total)}</span>
          </div>
        </div>
      </DrawerSection>
    </>
  )
}
