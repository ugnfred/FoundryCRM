import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { inventoryApi } from '@/lib/api'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'

export default function StockAdjustModal({ open, onClose, product }) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: { qty: 0, notes: '', txn_type: 'opening' },
  })

  const mutation = useMutation({
    mutationFn: (d) => inventoryApi.adjust({ ...d, product_id: product.id, qty: Number(d.qty) }),
    onSuccess: (data) => {
      toast({ title: 'Stock updated', description: `New balance: ${data.balance}` })
      qc.invalidateQueries(['stock'])
      qc.invalidateQueries(['ledger', product.id])
      reset()
      onClose()
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Adjust Stock — {product?.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <select {...register('txn_type')} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
              <option value="opening">Opening Stock</option>
              <option value="adjustment">Manual Adjustment</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Quantity <span className="text-muted-foreground text-xs">(negative to deduct)</span></Label>
            <Input type="number" step="0.001" {...register('qty', {
              required: 'Required',
              validate: (v) => Number(v) !== 0 || 'Quantity cannot be zero',
            })} />
            {errors.qty && <p className="text-xs text-destructive">{errors.qty.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input {...register('notes')} placeholder="Reason for adjustment…" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
