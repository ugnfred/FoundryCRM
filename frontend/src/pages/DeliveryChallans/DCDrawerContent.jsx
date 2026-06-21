import { DrawerSection, DrawerFields } from '@/components/shared/DetailDrawer'
import { Building2 } from 'lucide-react'

export default function DCDrawerContent({ dc }) {
  if (!dc) return null
  const items = dc.dc_items ?? []
  const company = dc.companies

  return (
    <>
      {company && (
        <DrawerSection title="Customer">
          <div className="flex items-start gap-3 rounded-lg border bg-slate-50 px-4 py-3">
            <Building2 className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-slate-800">{company.name}</p>
              {(company.city || company.state) && (
                <p className="text-slate-500 text-xs">{[company.city, company.state].filter(Boolean).join(', ')}</p>
              )}
            </div>
          </div>
        </DrawerSection>
      )}

      <DrawerSection title="Details">
        <DrawerFields fields={[
          { label: 'Date', value: dc.date },
          { label: 'SO Reference', value: dc.sales_orders?.so_no || '—' },
          { label: 'Vehicle No', value: dc.vehicle_no || '—' },
          { label: 'Transporter', value: dc.transporter_name || '—' },
          { label: 'LR / Consignment No', value: dc.lr_no || '—' },
          dc.notes ? { label: 'Notes', value: dc.notes } : null,
        ].filter(Boolean)} />
      </DrawerSection>

      {items.length > 0 && (
        <DrawerSection title={`Items (${items.length})`}>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">#</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">Description</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">HSN</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500">Qty</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500">UOM</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">{item.description}</td>
                    <td className="px-3 py-2 text-gray-500">{item.hsn_code || '—'}</td>
                    <td className="px-3 py-2 text-right font-mono">{Number(item.qty).toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-right">{item.uom}</td>
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
