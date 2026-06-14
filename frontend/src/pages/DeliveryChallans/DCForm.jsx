import { useEffect } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { deliveryChallansApi, settingsApi, ordersApi } from '@/lib/api'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trash2, Plus } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

const EMPTY_ITEM = { description: '', hsn_code: '', uom: 'NOS', qty: 1, product_id: null }

export default function DCForm({ open, onClose, editDC }) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const isEdit = !!editDC

  const { register, control, handleSubmit, setValue, reset } = useForm({
    defaultValues: {
      company_id: '',
      so_id: null,
      date: new Date().toISOString().slice(0, 10),
      vehicle_no: '',
      transporter_name: '',
      notes: '',
      items: [{ ...EMPTY_ITEM }],
    }
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  const { data: customers = [] } = useQuery({ queryKey: ['companies'], queryFn: settingsApi.listCompanies })
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: settingsApi.listProducts })
  const { data: orders = [] } = useQuery({ queryKey: ['orders'], queryFn: ordersApi.list })

  useEffect(() => {
    if (editDC) {
      reset({
        company_id: editDC.company_id || '',
        so_id: editDC.so_id || null,
        date: editDC.date || '',
        vehicle_no: editDC.vehicle_no || '',
        transporter_name: editDC.transporter_name || '',
        notes: editDC.notes || '',
        items: editDC.dc_items?.length
          ? editDC.dc_items.map(it => ({
              product_id: it.product_id || null,
              description: it.description,
              hsn_code: it.hsn_code || '',
              uom: it.uom || 'NOS',
              qty: it.qty,
            }))
          : [{ ...EMPTY_ITEM }],
      })
    }
  }, [editDC, reset])

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? deliveryChallansApi.update(editDC.id, data) : deliveryChallansApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delivery-challans'] })
      toast({ title: isEdit ? 'Challan updated' : 'Challan created' })
      onClose()
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  const onSubmit = (data) => {
    mutation.mutate({
      ...data,
      so_id: data.so_id || null,
      items: data.items.map(it => ({
        ...it,
        qty: parseFloat(it.qty) || 0,
        product_id: it.product_id || null,
      })),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${editDC.dc_no}` : 'New Delivery Challan'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
              <label className="text-sm font-medium">Date <span className="text-red-500">*</span></label>
              <Input type="date" {...register('date', { required: true })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Vehicle No</label>
              <Input {...register('vehicle_no')} placeholder="MH01AB1234" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Transporter</label>
              <Input {...register('transporter_name')} placeholder="Transporter name" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Notes</label>
              <Input {...register('notes')} placeholder="Optional" />
            </div>
          </div>

          {/* Line items — NO price/GST columns */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">Items (no pricing)</h3>
              <Button type="button" variant="outline" size="sm" onClick={() => append({ ...EMPTY_ITEM })}>
                <Plus className="h-3 w-3 mr-1" />Add Item
              </Button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  {['Product', 'Description', 'HSN', 'UOM', 'Qty', ''].map(h => (
                    <th key={h} className="px-2 py-1.5 text-left font-medium text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fields.map((field, i) => (
                  <tr key={field.id} className="border-t">
                    <td className="px-1 py-1">
                      <Controller control={control} name={`items.${i}.product_id`}
                        render={({ field: f }) => (
                          <Select value={f.value || ''} onValueChange={v => {
                            f.onChange(v || null)
                            const prod = products.find(p => p.id === v)
                            if (prod) {
                              setValue(`items.${i}.description`, prod.name)
                              setValue(`items.${i}.hsn_code`, prod.hsn_code || '')
                              setValue(`items.${i}.uom`, prod.uom || 'NOS')
                            }
                          }}>
                            <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">— Manual —</SelectItem>
                              {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </td>
                    <td className="px-1 py-1"><Input className="h-8 text-xs w-40" {...register(`items.${i}.description`)} /></td>
                    <td className="px-1 py-1"><Input className="h-8 text-xs w-20" {...register(`items.${i}.hsn_code`)} /></td>
                    <td className="px-1 py-1"><Input className="h-8 text-xs w-16" {...register(`items.${i}.uom`)} /></td>
                    <td className="px-1 py-1"><Input className="h-8 text-xs w-16" type="number" step="0.001" {...register(`items.${i}.qty`)} /></td>
                    <td className="px-1 py-1">
                      <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => remove(i)}>
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : isEdit ? 'Update' : 'Create Challan'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
