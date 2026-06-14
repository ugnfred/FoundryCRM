import { useForm, Controller } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { advanceReceiptsApi, settingsApi } from '@/lib/api'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/components/ui/toast'

const MODES = ['bank_transfer', 'cheque', 'cash', 'upi', 'neft', 'rtgs', 'demand_draft']

export default function ARForm({ open, onClose }) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const { register, control, handleSubmit, watch } = useForm({
    defaultValues: {
      company_id: '',
      date: new Date().toISOString().slice(0, 10),
      amount: '',
      payment_mode: 'bank_transfer',
      reference: '',
      notes: '',
      is_pdc: false,
      pdc_date: '',
    }
  })
  const isPDC = watch('is_pdc')

  const { data: customers = [] } = useQuery({ queryKey: ['companies'], queryFn: settingsApi.listCompanies })

  const mutation = useMutation({
    mutationFn: (data) => advanceReceiptsApi.create(data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['advance-receipts'] })
      toast({ title: `Advance receipt ${data.ar_no} created` })
      onClose()
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  const onSubmit = (data) => {
    mutation.mutate({
      ...data,
      amount: parseFloat(data.amount),
      pdc_date: data.is_pdc ? (data.pdc_date || null) : null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Advance Receipt</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Customer <span className="text-red-500">*</span></label>
            <Controller control={control} name="company_id" rules={{ required: true }}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Date <span className="text-red-500">*</span></label>
              <Input type="date" {...register('date', { required: true })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Amount (₹) <span className="text-red-500">*</span></label>
              <Input type="number" step="0.01" placeholder="0.00" {...register('amount', { required: true, min: 0.01 })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Payment Mode</label>
              <Controller control={control} name="payment_mode"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MODES.map(m => <SelectItem key={m} value={m}>{m.replace('_', ' ').toUpperCase()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Reference / Cheque No</label>
              <Input {...register('reference')} placeholder="Optional" />
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
            <Controller control={control} name="is_pdc"
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
            <div>
              <label className="text-sm font-medium">Post-Dated Cheque (PDC)</label>
              <p className="text-xs text-slate-500">Enable if this cheque is dated in the future</p>
            </div>
          </div>

          {isPDC && (
            <div className="space-y-1">
              <label className="text-sm font-medium">PDC Date</label>
              <Input type="date" {...register('pdc_date')} />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium">Notes</label>
            <Input {...register('notes')} placeholder="Optional notes" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Create Advance Receipt'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
