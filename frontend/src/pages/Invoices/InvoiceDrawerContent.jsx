import { DrawerSection, DrawerFields } from '@/components/shared/DetailDrawer'
import { Building2, ArrowRight } from 'lucide-react'

const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })

export default function InvoiceDrawerContent({ inv }) {
  if (!inv) return null
  const items = inv.invoice_items ?? []
  const payments = inv.payments ?? []
  const total = Number(inv.total ?? 0)
  const balanceDue = Number(inv.balance_due ?? 0)
  const paid = total - balanceDue
  const paidPct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0
  const isOverdue = inv.due_date && inv.due_date < new Date().toISOString().slice(0, 10) && inv.status !== 'paid'
  const company = inv.companies

  return (
    <>
      {/* Document chain */}
      {inv.sales_orders?.so_no && (
        <DrawerSection title="Document Chain">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-mono font-semibold bg-blue-50 text-blue-700 border-blue-200">{inv.sales_orders.so_no}</span>
            <ArrowRight className="h-3 w-3 text-slate-400" />
            <span className="inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-mono font-semibold bg-slate-100 text-slate-700 border-slate-200 ring-2 ring-offset-1 ring-slate-300">{inv.inv_no}</span>
          </div>
        </DrawerSection>
      )}

      {/* Customer */}
      {company && (
        <DrawerSection title="Customer">
          <div className="flex items-start gap-3 rounded-lg border bg-slate-50 px-4 py-3">
            <Building2 className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-slate-800">{company.name}</p>
              {company.gstin && <p className="text-slate-500 text-xs mt-0.5">GSTIN: {company.gstin}</p>}
            </div>
          </div>
        </DrawerSection>
      )}

      <DrawerSection title="Details">
        <DrawerFields fields={[
          { label: 'Invoice Date', value: inv.date },
          { label: 'Due Date', value: inv.due_date ? <span className={isOverdue ? 'text-red-600 font-semibold' : ''}>{inv.due_date}{isOverdue ? ' ⚠ Overdue' : ''}</span> : '—' },
          { label: 'Place of Supply', value: inv.place_of_supply || '—' },
          inv.notes ? { label: 'Notes', value: inv.notes } : null,
        ].filter(Boolean)} />
      </DrawerSection>

      {/* Payment progress */}
      {total > 0 && (
        <DrawerSection title="Payment Status">
          <div className="rounded-lg border bg-slate-50 px-4 py-3 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Paid</span>
              <span className="font-mono font-semibold text-green-700">₹{fmt(paid)}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${paidPct}%` }} />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Balance Due</span>
              <span className={`font-mono font-semibold ${balanceDue > 0 ? (isOverdue ? 'text-red-600' : 'text-amber-700') : 'text-green-600'}`}>
                {balanceDue > 0 ? `₹${fmt(balanceDue)}` : 'Paid in Full ✓'}
              </span>
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
                  <th className="px-3 py-2 text-right font-semibold text-gray-500">Qty</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500">Rate (₹)</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500">GST%</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{item.products?.name || item.description}</div>
                      {item.hsn_code && <div className="text-gray-400 text-[10px]">HSN {item.hsn_code} · {item.uom}</div>}
                    </td>
                    <td className="px-3 py-2 text-right">{Number(item.qty).toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(item.rate)}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{item.gst_rate}%</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">{fmt(Number(item.qty) * Number(item.rate))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DrawerSection>
      )}

      {/* Totals */}
      <DrawerSection title="Summary">
        <div className="rounded-lg border bg-slate-50 px-4 py-3 space-y-2 text-sm">
          <div className="flex justify-between text-slate-500"><span>Taxable</span><span className="font-mono">₹{fmt(Number(inv.taxable_amt ?? 0))}</span></div>
          <div className="flex justify-between text-slate-500"><span>CGST</span><span className="font-mono">₹{fmt(Number(inv.cgst ?? 0))}</span></div>
          <div className="flex justify-between text-slate-500"><span>SGST</span><span className="font-mono">₹{fmt(Number(inv.sgst ?? 0))}</span></div>
          {Number(inv.igst ?? 0) > 0 && <div className="flex justify-between text-slate-500"><span>IGST</span><span className="font-mono">₹{fmt(Number(inv.igst))}</span></div>}
          <div className="flex justify-between border-t pt-2 font-bold text-base"><span>Total</span><span className="font-mono">₹{fmt(total)}</span></div>
        </div>
      </DrawerSection>

      {/* Payment history */}
      {payments.length > 0 && (
        <DrawerSection title={`Payment History (${payments.length})`}>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">Date</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">Mode</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">Reference</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {payments.map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2">{p.payment_date}</td>
                    <td className="px-3 py-2 capitalize">{p.payment_mode?.replace('_', ' ') || '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{p.reference || '—'}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-green-700">₹{fmt(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DrawerSection>
      )}
    </>
  )
}
