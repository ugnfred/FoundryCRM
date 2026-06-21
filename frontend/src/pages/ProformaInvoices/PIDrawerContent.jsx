import { DrawerSection, DrawerFields } from '@/components/shared/DetailDrawer'

const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })

export default function PIDrawerContent({ pi }) {
  if (!pi) return null

  const subtotal = pi.proforma_items?.reduce((s, it) => s + (it.qty * it.rate), 0) ?? 0
  const totalGst = (pi.total ?? 0) - subtotal

  return (
    <>
      <DrawerSection title="Details">
        <DrawerFields fields={[
          { label: 'Date', value: pi.date },
          { label: 'Valid Until', value: pi.validity_date || '—' },
          { label: 'Sales Order', value: pi.sales_orders?.so_no || '—' },
          { label: 'Place of Supply', value: pi.place_of_supply || '—' },
          { label: 'Notes', value: pi.notes || '—' },
        ]} />
      </DrawerSection>

      {pi.proforma_items?.length > 0 && (
        <DrawerSection title="Line Items">
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">Item</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500">Qty</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500">Rate</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500">GST%</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pi.proforma_items.map((item, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <div className="font-medium">{item.description}</div>
                      {item.hsn_code && <div className="text-gray-400">HSN: {item.hsn_code}</div>}
                    </td>
                    <td className="px-3 py-2 text-right">{item.qty} {item.uom}</td>
                    <td className="px-3 py-2 text-right font-mono">₹{fmt(item.rate)}</td>
                    <td className="px-3 py-2 text-right">{item.gst_rate}%</td>
                    <td className="px-3 py-2 text-right font-mono">₹{fmt(item.qty * item.rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DrawerSection>
      )}

      <DrawerSection title="Totals">
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Subtotal</span>
            <span className="font-mono">₹{fmt(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">GST</span>
            <span className="font-mono">₹{fmt(totalGst)}</span>
          </div>
          <div className="flex justify-between border-t pt-1.5 font-semibold text-base">
            <span>Total</span>
            <span className="font-mono">₹{fmt(pi.total)}</span>
          </div>
        </div>
      </DrawerSection>
    </>
  )
}
