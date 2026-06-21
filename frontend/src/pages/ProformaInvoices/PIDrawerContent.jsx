import { DrawerSection, DrawerFields } from '@/components/shared/DetailDrawer'
import { Building2, ArrowRight, Clock } from 'lucide-react'

const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })

const GST_STATES = {
  '01': 'J&K', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan',
  '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
  '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura',
  '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
  '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '26': 'D&NH', '27': 'Maharashtra', '28': 'Andhra Pradesh (old)',
  '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala',
  '33': 'Tamil Nadu', '34': 'Puducherry', '36': 'Telangana', '37': 'Andhra Pradesh',
}

function ValidityBanner({ status, validityDate }) {
  if (!validityDate || !['draft', 'sent'].includes(status)) return null
  const today = new Date().toISOString().slice(0, 10)
  const expired = validityDate < today
  if (!expired) return null
  return (
    <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
      <Clock className="h-3.5 w-3.5 shrink-0" />
      <span>This proforma expired on <strong>{validityDate}</strong>. Consider reissuing.</span>
    </div>
  )
}

function DocChain({ so, piNo, convertedInv }) {
  const chips = []
  if (so?.so_no) chips.push({ label: so.so_no, color: 'bg-blue-50 text-blue-700 border-blue-200' })
  chips.push({ label: piNo, color: 'bg-slate-100 text-slate-700 border-slate-200', current: true })
  if (convertedInv?.inv_no) chips.push({ label: convertedInv.inv_no, color: 'bg-green-50 text-green-700 border-green-200' })

  if (chips.length < 2) return null
  return (
    <DrawerSection title="Document Chain">
      <div className="flex items-center gap-1.5 flex-wrap">
        {chips.map((chip, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-mono font-semibold ${chip.color} ${chip.current ? 'ring-2 ring-offset-1 ring-slate-300' : ''}`}>
              {chip.label}
            </span>
            {i < chips.length - 1 && <ArrowRight className="h-3 w-3 text-slate-400" />}
          </div>
        ))}
      </div>
    </DrawerSection>
  )
}

export default function PIDrawerContent({ pi }) {
  if (!pi) return null

  const items = pi.proforma_items ?? []

  // Use stored DB values for accuracy (pre-computed by backend)
  const taxableAmt = Number(pi.taxable_amt ?? 0)
  const cgst       = Number(pi.cgst ?? 0)
  const sgst       = Number(pi.sgst ?? 0)
  const igst       = Number(pi.igst ?? 0)
  const total      = Number(pi.total ?? 0)

  const isInterState = igst > 0
  const stateName = GST_STATES[pi.place_of_supply] || pi.place_of_supply
  const company = pi.companies
  const convertedInv = pi.invoices  // joined as invoices!converted_invoice_id(inv_no)

  // Group items by GST rate for the breakdown table
  const gstGroups = items.reduce((acc, it) => {
    const rate = Number(it.gst_rate)
    if (!acc[rate]) acc[rate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0 }
    const taxable = Number(it.qty) * Number(it.rate)
    acc[rate].taxable += taxable
    if (isInterState) {
      acc[rate].igst += taxable * rate / 100
    } else {
      acc[rate].cgst += taxable * rate / 200
      acc[rate].sgst += taxable * rate / 200
    }
    return acc
  }, {})

  // Activity log — scaffolded from created_at; full log table is P2
  const createdAt = pi.created_at ? new Date(pi.created_at) : null
  const createdLabel = createdAt
    ? createdAt.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <>
      {/* Validity expiry banner — shown when draft/sent but past validity date */}
      <ValidityBanner status={pi.status} validityDate={pi.validity_date} />

      {/* Document Chain: SO → PI → Invoice */}
      <DocChain so={pi.sales_orders} piNo={pi.pi_no} convertedInv={convertedInv} />

      {/* Customer Info */}
      {company && (
        <DrawerSection title="Customer">
          <div className="flex items-start gap-3 rounded-lg border bg-slate-50 px-4 py-3">
            <Building2 className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-slate-800">{company.name}</p>
              {company.gstin && (
                <p className="text-slate-500 text-xs mt-0.5">GSTIN: {company.gstin}</p>
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
          pi.notes ? { label: 'Notes', value: pi.notes } : null,
        ].filter(Boolean)} />
      </DrawerSection>

      {/* Line Items table */}
      <DrawerSection title={`Line Items${items.length ? ` (${items.length})` : ''}`}>
        {items.length > 0 ? (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide w-6">#</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide">Item</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-500 uppercase tracking-wide">Qty</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-500 uppercase tracking-wide">Rate (₹)</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-500 uppercase tracking-wide">GST%</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-500 uppercase tracking-wide">Amount (₹)</th>
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
                        <div className="text-gray-400 text-[10px] leading-tight mt-0.5">{item.description}</div>
                      )}
                      <div className="flex gap-2 text-[10px] text-gray-400 mt-0.5">
                        {item.hsn_code && <span>HSN {item.hsn_code}</span>}
                        <span>{item.uom}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">{Number(item.qty).toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{fmt(item.rate)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-500">{item.gst_rate}%</td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold">
                      {fmt(Number(item.qty) * Number(item.rate))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-400 italic">No items added.</p>
        )}
      </DrawerSection>

      {/* Tax Breakdown — only if we have computed values */}
      {(cgst > 0 || sgst > 0 || igst > 0) && (
        <DrawerSection title="Tax Breakdown">
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">Slab</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500">Taxable</th>
                  {isInterState ? (
                    <th className="px-3 py-2 text-right font-semibold text-gray-500">IGST</th>
                  ) : (
                    <>
                      <th className="px-3 py-2 text-right font-semibold text-gray-500">CGST</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-500">SGST</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {Object.entries(gstGroups).map(([rate, vals]) => (
                  <tr key={rate}>
                    <td className="px-3 py-2 font-medium">{rate}%</td>
                    <td className="px-3 py-2 text-right font-mono">₹{fmt(vals.taxable)}</td>
                    {isInterState ? (
                      <td className="px-3 py-2 text-right font-mono">₹{fmt(vals.igst)}</td>
                    ) : (
                      <>
                        <td className="px-3 py-2 text-right font-mono">₹{fmt(vals.cgst)}</td>
                        <td className="px-3 py-2 text-right font-mono">₹{fmt(vals.sgst)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DrawerSection>
      )}

      {/* Totals Summary */}
      <DrawerSection title="Summary">
        <div className="rounded-lg border bg-slate-50 px-4 py-3 space-y-2 text-sm">
          <div className="flex justify-between text-slate-500">
            <span>Taxable Amount</span>
            <span className="font-mono">₹{fmt(taxableAmt)}</span>
          </div>
          {isInterState ? (
            <div className="flex justify-between text-slate-500">
              <span>IGST</span>
              <span className="font-mono">₹{fmt(igst)}</span>
            </div>
          ) : (
            <>
              <div className="flex justify-between text-slate-500">
                <span>CGST</span>
                <span className="font-mono">₹{fmt(cgst)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>SGST</span>
                <span className="font-mono">₹{fmt(sgst)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between border-t pt-2 font-bold text-base text-slate-900">
            <span>Total</span>
            <span className="font-mono">₹{fmt(total)}</span>
          </div>
        </div>
      </DrawerSection>

      {/* Activity Log — scaffolded from created_at; full audit trail is a future enhancement */}
      {createdLabel && (
        <DrawerSection title="History">
          <div className="relative pl-5 border-l-2 border-slate-100 space-y-3">
            <div className="relative">
              <div className="absolute -left-[1.3rem] top-1 h-2.5 w-2.5 rounded-full bg-slate-200 border-2 border-white" />
              <p className="text-xs text-slate-500">
                <span className="font-medium text-slate-700">Document created</span>
                <span className="mx-1.5 text-slate-300">·</span>
                {createdLabel}
              </p>
            </div>
          </div>
        </DrawerSection>
      )}
    </>
  )
}
