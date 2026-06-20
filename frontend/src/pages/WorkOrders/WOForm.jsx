import { useForm, Controller, useWatch } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { workOrdersApi, settingsApi, ordersApi } from '@/lib/api'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'

export default function WOForm({ open, onClose }) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const { register, control, handleSubmit, setValue } = useForm({
    defaultValues: {
      product_id: '',
      so_id: null,
      qty: 1,
      start_date: '',
      target_date: '',
      notes: '',
    }
  })

  const selectedSoId = useWatch({ control, name: 'so_id' })

  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: settingsApi.listProducts })
  const { data: orders = [] } = useQuery({ queryKey: ['orders'], queryFn: ordersApi.list })

  // Prefill product + qty when SO is selected
  useEffect(() => {
    if (!selectedSoId) return
    const so = orders.find(o => o.id === selectedSoId)
    const firstItem = so?.so_items?.[0]
    if (firstItem) {
      if (firstItem.product_id) setValue('product_id', firstItem.product_id)
      if (firstItem.qty)        setValue('qty', firstItem.qty)
    }
  }, [selectedSoId, orders, setValue])

  const mutation = useMutation({
    mutationFn: (data) => workOrdersApi.create(data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['work-orders'] })
      toast({ title: `Work Order ${data.wo_no} created` })
      onClose()
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  const onSubmit = (data) => {
    mutation.mutate({
      ...data,
      qty: parseFloat(data.qty) || 1,
      so_id: data.so_id || null,
      start_date: data.start_date || null,
      target_date: data.target_date || null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Work Order</DialogTitle>
          <p className="text-xs text-slate-500">A BOM will be auto-linked if one exists for the selected product.</p>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Product <span className="text-red-500">*</span></label>
            <Controller control={control} name="product_id" rules={{ required: true }}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Select finished product" /></SelectTrigger>
                  <SelectContent>
                    {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Qty <span className="text-red-500">*</span></label>
              <Input type="number" step="0.001" {...register('qty', { required: true, min: 0.001 })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Sales Order (optional)</label>
              <Controller control={control} name="so_id"
                render={({ field }) => (
                  <Select value={field.value || ''} onValueChange={v => field.onChange(v || null)}>
                    <SelectTrigger><SelectValue placeholder="Link to SO" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">— None —</SelectItem>
                      {orders.filter(o => o.status !== 'cancelled').map(o => (
                        <SelectItem key={o.id} value={o.id}>{o.so_no} — {o.companies?.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Start Date</label>
              <Input type="date" {...register('start_date')} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Target Date</label>
              <Input type="date" {...register('target_date')} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Notes</label>
            <Input {...register('notes')} placeholder="Optional instructions" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating…' : 'Create Work Order'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
