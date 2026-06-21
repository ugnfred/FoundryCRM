import { DrawerSection, DrawerFields } from '@/components/shared/DetailDrawer'
import { Building2, ArrowRight } from 'lucide-react'

const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })

export default function CNDrawerContent({ cn }) {
  if (!cn) return null
  const items = cn.cn_items ?? []
  const company = cn.companies

  return (
    <>
      {/* Document chain: Invoice → CN */}
      {cn.invoices?.inv_no && (
        <DrawerSection title="Document Chain">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-mono font-semibold bg-blue-50 text-blue-700 border-blue-200">{cn.invoices.inv_no}</span>
            <ArrowRight className="h-3 w-3 text-slate-400" />
            <span className="inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-mono font-semibold bg-red-50 text-red-700 border-red-200 ring-2 ring-offset-1 ring-red-200">{cn.cn_no}</span>
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
            </div>
          </div>
        </DrawerSection>
      )}

      <DrawerSection title="Details">
        <DrawerFields fields={[
          { label: 'Date', value: cn.date },
          { label: 'Against Invoice', value: cn.invoices?.inv_no || '—' },
          { label: 'Reason', value: cn.reason || '—' },
        ]} />
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
                  <th className="px-3 py-2 text-right font-semibold text-gray-500">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">{item.description}</td>
                    <td className="px-3 py-2 text-right">{Number(item.qty).toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(item.rate)}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">{fmt(Number(item.qty) * Number(item.rate))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DrawerSection>
      )}

      <DrawerSection title="Summary">
        <div className="rounded-lg border bg-red-50 px-4 py-3 space-y-2 text-sm">
          <div className="flex justify-between border-t pt-2 font-bold text-base text-red-800">
            <span>Credit Amount</span><span className="font-mono">₹{fmt(cn.total)}</span>
          </div>
        </div>
      </DrawerSection>
    </>
  )
}
