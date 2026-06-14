import { useForm, useFieldArray } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { purchaseOrdersApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'

export default function GRNForm({ open, onClose, po }) {
  const qc = useQueryClient()
  const { toast } = useToast()

  const defaultItems = (po.po_items ?? []).map((item) => ({
    po_item_id: item.id,
    product_id: item.product_id,
    description: item.description,
    qty_ordered: item.qty,
    qty_received: item.qty - (item.received_qty ?? 0),
    rate: item.rate,
  }))

  const { register, control, handleSubmit } = useForm({
    defaultValues: { received_date: new Date().toISOString().slice(0, 10), notes: '', items: defaultItems },
  })
  const { fields } = useFieldArray({ control, name: 'items' })

  const mutation = useMutation({
    mutationFn: (d) => purchaseOrdersApi.createGRN(po.id, d),
    onSuccess: (res) => { toast({ title: 'GRN Created', description: `GRN ${res.grn_no} recorded.` }); qc.invalidateQueries(['purchase-orders']); qc.invalidateQueries(['grns']); onClose() },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Goods Receipt Note — {po.po_no}</DialogTitle></DialogHeader>
        <DialogBody>
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Received Date</Label><Input type="date" {...register('received_date', { required: true })} /></div>
              <div className="space-y-1.5"><Label>Notes</Label><Input placeholder="Optional" {...register('notes')} /></div>
            </div>
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b"><tr>{['Item','Ordered','Qty to Receive','Rate'].map((h) => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600">{h}</th>)}</tr></thead>
                <tbody className="divide-y">
                  {fields.map((field, i) => (
                    <tr key={field.id}>
                      <td className="px-3 py-2 text-sm">{field.description}</td>
                      <td className="px-3 py-2 text-sm">{field.qty_ordered}</td>
                      <td className="px-2 py-1.5"><Input type="number" step="0.001" className="h-8 text-xs w-24" {...register(`items.${i}.qty_received`)} /></td>
                      <td className="px-3 py-2 text-sm">₹{Number(field.rate).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Record GRN'}</Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
