import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invoicesApi, advanceReceiptsApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'

const pn = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n }

export default function PaymentModal({ open, onClose, invoice }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const balanceDue = pn(invoice.balance_due ?? invoice.total)

  const { data: advanceData } = useQuery({
    queryKey: ['advance-balance', invoice.company_id],
    queryFn: () => advanceReceiptsApi.availableBalance(invoice.company_id),
    enabled: !!invoice.company_id,
  })
  const advanceBalance = pn(advanceData?.available_balance)

  const { register, handleSubmit, watch } = useForm({
    defaultValues: {
      amount: balanceDue,
      date: new Date().toISOString().slice(0, 10),
      mode: 'bank_transfer',
      reference: '',
      advance_amount: 0,
    },
  })

  const advanceApplied = pn(watch('advance_amount'))
  const cashNeeded = Math.max(0, balanceDue - advanceApplied)

  const mutation = useMutation({
    mutationFn: (d) => invoicesApi.recordPayment(invoice.id, {
      ...d,
      amount: pn(d.amount),
      advance_amount: pn(d.advance_amount),
    }),
    onSuccess: () => {
      toast({ title: 'Payment recorded' })
      qc.invalidateQueries(['invoices'])
      qc.invalidateQueries(['advance-receipts'])
      onClose()
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
        <DialogBody>
          <p className="text-sm text-muted-foreground mb-4">
            Invoice <strong>{invoice.inv_no}</strong> · Balance: <strong>{formatCurrency(balanceDue)}</strong>
          </p>

          {advanceBalance > 0 && (
            <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200 text-sm">
              <p className="font-medium text-green-800">Advance Credit Available: {formatCurrency(advanceBalance)}</p>
              <div className="mt-2 space-y-1">
                <Label className="text-xs">Apply Advance (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max={Math.min(advanceBalance, balanceDue)}
                  {...register('advance_amount')}
                  className="h-8 text-sm"
                />
              </div>
              {advanceApplied > 0 && (
                <p className="mt-1 text-xs text-green-700">
                  Cash payment needed: {formatCurrency(cashNeeded)}
                </p>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Cash / Bank Amount</Label>
              <Input type="number" step="0.01" {...register('amount', { required: true })} />
            </div>
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
