import { DrawerSection, DrawerFields } from '@/components/shared/DetailDrawer'
import { Building2, ExternalLink } from 'lucide-react'

const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })

const GST_STATES = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
  '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi',
  '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim',
  '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
  '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
  '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
  '24': 'Gujarat', '26': 'Dadra & Nagar Haveli', '27': 'Maharashtra',
  '28': 'Andhra Pradesh (old)', '29': 'Karnataka', '30': 'Goa',
  '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry',
  '36': 'Telangana', '37': 'Andhra Pradesh',
}

export default function PIDrawerContent({ pi }) {
  if (!pi) return null

  const items = pi.proforma_items ?? []
  const subtotal = items.reduce((s, it) => s + (Number(it.qty) * Number(it.rate)), 0)
  const totalAmount = Number(pi.total ?? 0)
  const totalGst = totalAmount - subtotal

  // Determine inter-state vs intra-state (Maharashtra = 27)
  const isInterState = pi.place_of_supply && pi.place_of_supply !== '27'
  const stateName = GST_STATES[pi.place_of_supply] || pi.place_of_supply

  // Group items by GST rate for tax breakdown
  const gstGroups = items.reduce((acc, it) => {
    const rate = Number(it.gst_rate)
    if (!acc[rate]) acc[rate] = { taxable: 0, gst: 0 }
    const taxable = Number(it.qty) * Number(it.rate)
    acc[rate].taxable += taxable
    acc[rate].gst += taxable * rate / 100
    return acc
  }, {})

  const company = pi.companies

  return (
    <>
      {/* Customer Info */}
      {company && (
        <DrawerSection title="Customer">
          <div className="flex items-start gap-2.5 rounded-lg border bg-slate-50 px-4 py-3">
            <Building2 className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-slate-800">{company.name}</p>
              {company.gstin && (
                <p className="text-slate-500 text-xs mt-0.5">GST: {company.gstin}</p>
              )}
              {(company.city || company.state) && (
                <p className="text-slate-500 text-xs">{[company.city, company.state].filter(Boolean).join(', ')}</p>
              )}
            </div>
          </div>
        </DrawerSection>
      )}

      {/* Document Details */}
      <DrawerSection title="Details">
        <DrawerFields fields={[
          { label: 'Date', value: pi.date },
          { label: 'Valid Until', value: pi.validity_date || '—' },
          { label: 'Place of Supply', value: `${pi.place_of_supply} — ${stateName}` },
          { label: 'Tax Type', value: isInterState ? 'IGST (Inter-state)' : 'CGST + SGST (Intra-state)' },
          pi.sales_orders?.so_no && { label: 'Sales Order Ref', value: pi.sales_orders.so_no },
          pi.notes && { label: 'Notes', value: pi.notes },
        ].filter(Boolean)} />
      </DrawerSection>

      {/* Line Items */}
      {items.length > 0 ? (
        <DrawerSection title={`Line Items (${items.length})`}>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide">#</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-500 uppercase tracking-wide">Qty</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-500 uppercase tracking-wide">Rate</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-500 uppercase tracking-wide">GST</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-gray-400">{i + 1}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-slate-800">
                        {item.products?.name || item.description}
                      </div>
                      {item.products?.name && item.description !== item.products.name && (
                        <div className="text-gray-400 text-[10px] mt-0.5">{item.description}</div>
                      )}
                      <div className="flex gap-2 text-[10px] text-gray-400 mt-0.5">
                        {item.hsn_code && <span>HSN: {item.hsn_code}</span>}
                        <span>{item.uom}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">{Number(item.qty).toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2.5 text-right font-mono">₹{fmt(item.rate)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-500">{item.gst_rate}%</td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold">
                      ₹{fmt(Number(item.qty) * Number(item.rate))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DrawerSection>
      ) : (
        <DrawerSection title="Line Items">
          <p className="text-sm text-slate-400 italic">No items found.</p>
        </DrawerSection>
      )}

      {/* Tax Breakdown */}
      {Object.keys(gstGroups).length > 0 && (
        <DrawerSection title="Tax Breakdown">
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">GST Rate</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500">Taxable</th>
                  {isInterState ? (
                    <th className="px-3 py-2 text-right font-semibold text-gray-500">IGST</th>
                  ) : (
                    <>
                      <th className="px-3 py-2 text-right font-semibold text-gray-500">CGST</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-500">SGST</th>
                    </>
                  )}
                  <th className="px-3 py-2 text-right font-semibold text-gray-500">Total Tax</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {Object.entries(gstGroups).map(([rate, vals]) => (
                  <tr key={rate}>
                    <td className="px-3 py-2 font-medium">{rate}%</td>
                    <td className="px-3 py-2 text-right font-mono">₹{fmt(vals.taxable)}</td>
                    {isInterState ? (
                      <td className="px-3 py-2 text-right font-mono">₹{fmt(vals.gst)}</td>
                    ) : (
                      <>
                        <td className="px-3 py-2 text-right font-mono">₹{fmt(vals.gst / 2)}</td>
                        <td className="px-3 py-2 text-right font-mono">₹{fmt(vals.gst / 2)}</td>
                      </>
                    )}
                    <td className="px-3 py-2 text-right font-mono font-semibold">₹{fmt(vals.gst)}</td>
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
          <div className="flex justify-between text-slate-500">
            <span>Subtotal</span>
            <span className="font-mono">₹{fmt(subtotal)}</span>
          </div>
          {isInterState ? (
            <div className="flex justify-between text-slate-500">
              <span>IGST</span>
              <span className="font-mono">₹{fmt(totalGst)}</span>
            </div>
          ) : (
            <>
              <div className="flex justify-between text-slate-500">
                <span>CGST</span>
                <span className="font-mono">₹{fmt(totalGst / 2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>SGST</span>
                <span className="font-mono">₹{fmt(totalGst / 2)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between border-t pt-2 font-bold text-base text-slate-900">
            <span>Total</span>
            <span className="font-mono">₹{fmt(totalAmount)}</span>
          </div>
        </div>
      </DrawerSection>
    </>
  )
}
