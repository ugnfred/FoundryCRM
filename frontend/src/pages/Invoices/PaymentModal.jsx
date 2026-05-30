import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invoicesApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'

export default function PaymentModal({ open, onClose, invoice }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const { register, handleSubmit } = useForm({
    defaultValues: { amount: invoice.balance_due ?? invoice.total, date: new Date().toISOString().slice(0, 10), mode: 'bank_transfer', reference: '' },
  })

  const mutation = useMutation({
    mutationFn: (d) => invoicesApi.recordPayment(invoice.id, d),
    onSuccess: () => { toast({ title: 'Payment recorded' }); qc.invalidateQueries(['invoices']); onClose() },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
        <DialogBody>
          <p className="text-sm text-muted-foreground mb-4">
            Invoice <strong>{invoice.inv_no}</strong> · Balance: <strong>{formatCurrency(invoice.balance_due ?? invoice.total)}</strong>
          </p>
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <div className="space-y-1.5"><Label>Amount</Label><Input type="number" step="0.01" {...register('amount', { required: true })} /></div>
            <div className="space-y-1.5"><Label>Date</Label><Input type="date" {...register('date', { required: true })} /></div>
            <div className="space-y-1.5">
              <Label>Mode</Label>
              <select {...register('mode')} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
              </select>
            </div>
            <div className="space-y-1.5"><Label>Reference</Label><Input placeholder="UTR / cheque no." {...register('reference')} /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Record Payment'}</Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
