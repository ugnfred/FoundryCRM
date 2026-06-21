import { DrawerSection, DrawerFields } from '@/components/shared/DetailDrawer'
import { Building2, ArrowRight } from 'lucide-react'

const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })

export default function SODrawerContent({ so }) {
  if (!so) return null
  const items = so.order_items ?? []
  const company = so.companies
  const invoices = so.invoices ?? []

  return (
    <>
      {/* Document chain — show invoices if any */}
      {invoices.length > 0 && (
        <DrawerSection title="Document Chain">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-mono font-semibold bg-slate-100 text-slate-700 border-slate-200 ring-2 ring-offset-1 ring-slate-300">
              {so.so_no}
            </span>
            {invoices.map((inv) => (
              <div key={inv.id} className="flex items-center gap-1.5">
                <ArrowRight className="h-3 w-3 text-slate-400" />
                <span className="inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-mono font-semibold bg-green-50 text-green-700 border-green-200">
                  {inv.inv_no}
                </span>
              </div>
            ))}
          </div>
        </DrawerSection>
      )}

      {company && (
        <DrawerSection title="Customer">
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
          { label: 'Order Date', value: so.date },
          { label: 'Delivery Date', value: so.delivery_date || '—' },
          { label: 'Customer PO Ref', value: so.po_reference || '—' },
          so.notes ? { label: 'Notes', value: so.notes } : null,
        ].filter(Boolean)} />
      </DrawerSection>

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
                    <td className="px-3 py-2 text-right font-mono">{Number(item.qty).toLocaleString('en-IN')}</td>
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

      <DrawerSection title="Summary">
        <div className="rounded-lg border bg-slate-50 px-4 py-3 space-y-2 text-sm">
          <div className="flex justify-between text-slate-500"><span>Taxable</span><span className="font-mono">₹{fmt(Number(so.taxable_amt ?? 0))}</span></div>
          <div className="flex justify-between text-slate-500"><span>Tax</span><span className="font-mono">₹{fmt(Number(so.tax_amt ?? 0))}</span></div>
          <div className="flex justify-between border-t pt-2 font-bold text-base"><span>Total</span><span className="font-mono">₹{fmt(so.total)}</span></div>
        </div>
      </DrawerSection>
    </>
  )
}
