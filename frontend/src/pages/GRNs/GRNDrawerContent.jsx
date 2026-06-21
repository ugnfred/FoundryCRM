import { DrawerSection, DrawerFields } from '@/components/shared/DetailDrawer'
import { ArrowRight } from 'lucide-react'

const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 3 })

export default function GRNDrawerContent({ grn }) {
  if (!grn) return null
  const items = grn.grn_items ?? []
  const po = grn.purchase_orders

  return (
    <>
      {po?.po_no && (
        <DrawerSection title="Document Chain">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-mono font-semibold bg-blue-50 text-blue-700 border-blue-200">{po.po_no}</span>
            <ArrowRight className="h-3 w-3 text-slate-400" />
            <span className="inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-mono font-semibold bg-slate-100 text-slate-700 border-slate-200 ring-2 ring-offset-1 ring-slate-300">{grn.grn_no}</span>
          </div>
        </DrawerSection>
      )}

      <DrawerSection title="Details">
        <DrawerFields fields={[
          { label: 'Received Date', value: grn.received_date },
          { label: 'Supplier', value: po?.companies?.name || '—' },
          { label: 'Purchase Order', value: po?.po_no || '—' },
          grn.notes ? { label: 'Notes', value: grn.notes } : null,
        ].filter(Boolean)} />
      </DrawerSection>

      {items.length > 0 && (
        <DrawerSection title={`Items Received (${items.length})`}>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">#</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">Product</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500">Qty Received</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500">UOM</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">{item.products?.name || item.product_id}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-green-700">{fmt(item.qty_received)}</td>
                    <td className="px-3 py-2 text-right">{item.uom || '—'}</td>
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
