import { DrawerSection, DrawerFields } from '@/components/shared/DetailDrawer'
import { AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export default function WODrawerContent({ wo }) {
  if (!wo) return null
  const bom = wo.bom_headers
  const hasShortage = bom?.bom_items?.some(i => i.shortage > 0)

  return (
    <>
      <DrawerSection title="Job Details">
        <DrawerFields fields={[
          { label: 'Product', value: wo.products?.name },
          { label: 'Qty to Produce', value: `${parseFloat(wo.qty).toFixed(3)} ${wo.products?.uom || ''}` },
          { label: 'Target Date', value: wo.target_date || '—' },
          { label: 'Start Date', value: wo.start_date || '—' },
          { label: 'SO Reference', value: wo.sales_orders?.so_no || '—' },
          { label: 'BOM Version', value: bom ? `v${bom.version}` : '—' },
          wo.notes ? { label: 'Notes', value: wo.notes } : null,
        ].filter(Boolean)} />
      </DrawerSection>

      {bom?.bom_items?.length > 0 ? (
        <DrawerSection title="BOM Requirements & Stock Status">
          {hasShortage && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 mb-3">
              <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
              <div className="text-sm text-red-700">
                <p className="font-semibold">Material shortage detected</p>
                <p className="text-xs mt-0.5">Cannot complete until stock is replenished. Raise a Purchase Order for short items.</p>
              </div>
            </div>
          )}
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">Component</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500">Required</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500">On Hand</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500">Shortage</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {bom.bom_items.map((item) => (
                  <tr key={item.id} className={item.shortage > 0 ? 'bg-red-50' : 'hover:bg-gray-50'}>
                    <td className="px-3 py-2 font-medium">{item.products?.name || item.component_id}</td>
                    <td className="px-3 py-2 text-right font-mono">{parseFloat(item.required_qty || 0).toFixed(3)} {item.uom}</td>
                    <td className="px-3 py-2 text-right font-mono">{parseFloat(item.on_hand || 0).toFixed(3)}</td>
                    <td className={`px-3 py-2 text-right font-mono font-semibold ${item.shortage > 0 ? 'text-red-600' : 'text-slate-300'}`}>
                      {item.shortage > 0 ? parseFloat(item.shortage).toFixed(3) : '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {item.shortage > 0
                        ? <Badge variant="destructive" className="text-xs">Short</Badge>
                        : <Badge variant="outline" className="text-xs text-green-700 border-green-300">OK</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DrawerSection>
      ) : (
        <DrawerSection title="BOM">
          <p className="text-sm text-slate-400 italic text-center py-4">No BOM linked — stock deduction will only record finished product output.</p>
        </DrawerSection>
      )}
    </>
  )
}
