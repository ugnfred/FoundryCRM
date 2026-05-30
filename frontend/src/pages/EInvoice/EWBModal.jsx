import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { einvoiceApi } from '@/lib/api'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'

export default function EWBModal({ open, onClose, invoice }) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { mode_of_trans: 'road', distance_km: '' },
  })

  const mutation = useMutation({
    mutationFn: (d) => einvoiceApi.ewaybill({
      invoice_id: invoice.id,
      vehicle_no: d.vehicle_no,
      transporter_id: d.transporter_id || null,
      distance_km: d.distance_km ? Number(d.distance_km) : null,
      mode_of_trans: d.mode_of_trans,
    }),
    onSuccess: (data) => {
      toast({ title: 'E-Way Bill generated', description: `EWB No: ${data.ewb_no}` })
      qc.invalidateQueries(['invoices'])
      onClose()
    },
    onError: (e) => toast({ title: 'EWB Error', description: e.message, variant: 'destructive' }),
  })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Generate E-Way Bill — {invoice?.inv_no}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Vehicle Number *</Label>
            <Input placeholder="MH12AB1234" {...register('vehicle_no', { required: 'Required' })} />
            {errors.vehicle_no && <p className="text-xs text-destructive">{errors.vehicle_no.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Transporter ID</Label>
            <Input placeholder="GSTIN of transporter" {...register('transporter_id')} />
          </div>
          <div className="space-y-1.5">
            <Label>Distance (km)</Label>
            <Input type="number" {...register('distance_km')} />
          </div>
          <div className="space-y-1.5">
            <Label>Mode of Transport</Label>
            <select {...register('mode_of_trans')} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
              <option value="road">Road</option>
              <option value="rail">Rail</option>
              <option value="air">Air</option>
              <option value="ship">Ship</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Generating…' : 'Generate EWB'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
