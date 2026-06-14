import { useQuery } from '@tanstack/react-query'
import { workOrdersApi } from '@/lib/api'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, CheckCircle } from 'lucide-react'

const STATUS_COLORS = { open: 'secondary', in_progress: 'default', done: 'outline', cancelled: 'destructive' }

export default function WODetail({ woId, onClose, onComplete }) {
  const { data: wo, isLoading } = useQuery({
    queryKey: ['work-order-detail', woId],
    queryFn: () => workOrdersApi.get(woId),
  })

  if (isLoading) return null

  const bom = wo?.bom_headers
  const canComplete = wo?.status === 'open' || wo?.status === 'in_progress'
  const hasShortage = bom?.bom_items?.some(i => i.shortage > 0)

  return (
    <Dialog open={!!woId} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle>{wo?.wo_no}</DialogTitle>
            <Badge variant={STATUS_COLORS[wo?.status] || 'secondary'} className="capitalize">
              {wo?.status?.replace('_', ' ')}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-slate-500">Product:</span> <span className="font-medium">{wo?.products?.name}</span></div>
            <div><span className="text-slate-500">Qty:</span> <span className="font-mono font-semibold">{parseFloat(wo?.qty).toFixed(2)} {wo?.products?.uom}</span></div>
            <div><span className="text-slate-500">SO Ref:</span> <span>{wo?.sales_orders?.so_no || '—'}</span></div>
            <div><span className="text-slate-500">Target Date:</span> <span>{wo?.target_date || '—'}</span></div>
            <div><span className="text-slate-500">BOM Version:</span> <span>{bom ? `v${bom.version}` : '—'}</span></div>
            <div><span className="text-slate-500">Notes:</span> <span className="text-slate-600">{wo?.notes || '—'}</span></div>
          </div>

          {bom?.bom_items?.length > 0 ? (
            <div>
              <h3 className="font-semibold text-sm mb-2">BOM Requirements & Stock Status</h3>
              {hasShortage && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-3">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-sm text-red-700 font-medium">Material shortage detected — cannot complete until stock is available</span>
                </div>
              )}
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Component</th>
                    <th className="px-3 py-2 text-right font-medium">Required</th>
                    <th className="px-3 py-2 text-right font-medium">On Hand</th>
                    <th className="px-3 py-2 text-right font-medium">Shortage</th>
                    <th className="px-3 py-2 text-center font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bom.bom_items.map((item, i) => (
                    <tr key={item.id} className={`border-t ${item.shortage > 0 ? 'bg-red-50' : ''}`}>
                      <td className="px-3 py-2">{item.products?.name || item.component_id}</td>
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
          ) : (
            <div className="text-center py-8 text-slate-400">
              <p className="text-sm">No BOM linked to this work order</p>
              <p className="text-xs mt-1">Stock deduction will only record the finished product output</p>
            </div>
          )}

          {canComplete && (
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={onClose}>Close</Button>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                disabled={hasShortage}
                onClick={() => {
                  if (confirm('Mark this work order as complete? Stock will be updated.')) {
                    onComplete()
                    onClose()
                  }
                }}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {hasShortage ? 'Cannot Complete (Shortage)' : 'Mark Complete'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
