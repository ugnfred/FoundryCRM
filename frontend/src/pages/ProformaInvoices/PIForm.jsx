import { useEffect } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { proformaApi, settingsApi, ordersApi } from '@/lib/api'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trash2, Plus } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

const pn = (v) => { const f = parseFloat(v); return isNaN(f) ? 0 : f }

const EMPTY_ITEM = { description: '', hsn_code: '', uom: 'NOS', qty: 1, rate: 0, gst_rate: 18, product_id: null }

export default function PIForm({ open, onClose, editPI }) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const isEdit = !!editPI

  const { register, control, handleSubmit, watch, setValue, reset } = useForm({
    defaultValues: {
      company_id: '',
      so_id: null,
      date: new Date().toISOString().slice(0, 10),
      validity_date: '',
      place_of_supply: '27',
      notes: '',
      items: [{ ...EMPTY_ITEM }],
    }
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const items = watch('items')

  const { data: customers = [] } = useQuery({ queryKey: ['companies'], queryFn: settingsApi.listCompanies })
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: settingsApi.listProducts })
  const { data: orders = [] } = useQuery({ queryKey: ['orders'], queryFn: ordersApi.list })

  useEffect(() => {
    if (editPI) {
      reset({
        company_id: editPI.company_id || '',
        so_id: editPI.so_id || null,
        date: editPI.date || '',
        validity_date: editPI.validity_date || '',
        place_of_supply: editPI.place_of_supply || '27',
        notes: editPI.notes || '',
        items: editPI.proforma_items?.length
          ? editPI.proforma_items.map(it => ({
              product_id: it.product_id || null,
              description: it.description,
              hsn_code: it.hsn_code || '',
              uom: it.uom || 'NOS',
              qty: it.qty,
              rate: it.rate,
              gst_rate: it.gst_rate,
            }))
          : [{ ...EMPTY_ITEM }],
      })
    }
  }, [editPI, reset])

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? proformaApi.update(editPI.id, data) : proformaApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proforma'] })
      toast({ title: isEdit ? 'Proforma updated' : 'Proforma created' })
      onClose()
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  // Live totals
  const taxable = items.reduce((s, it) => s + pn(it.qty) * pn(it.rate), 0)
  const totalGst = items.reduce((s, it) => s + pn(it.qty) * pn(it.rate) * pn(it.gst_rate) / 100, 0)
  const total = taxable + totalGst

  const onSubmit = (data) => {
    const cleaned = {
      ...data,
      validity_date: data.validity_date || null,
      so_id: data.so_id || null,
      items: data.items.map(it => ({
        ...it,
        qty: pn(it.qty),
        rate: pn(it.rate),
        gst_rate: pn(it.gst_rate),
        product_id: it.product_id || null,
      })),
    }
    mutation.mutate(cleaned)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${editPI.pi_no}` : 'New Proforma Invoice'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Header fields */}
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
              <label className="text-sm font-medium">Valid Until</label>
              <Input type="date" {...register('validity_date')} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Place of Supply</label>
              <Input {...register('place_of_supply')} placeholder="27" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Notes</label>
              <Input {...register('notes')} placeholder="Optional notes" />
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">Line Items</h3>
              <Button type="button" variant="outline" size="sm" onClick={() => append({ ...EMPTY_ITEM })}>
                <Plus className="h-3 w-3 mr-1" />Add Item
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    {['Product', 'Description', 'HSN', 'UOM', 'Qty', 'Rate', 'GST%', 'Amount', ''].map(h => (
                      <th key={h} className="px-2 py-1.5 text-left font-medium text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field, i) => {
                    const amt = pn(items[i]?.qty) * pn(items[i]?.rate)
                    const gst = amt * pn(items[i]?.gst_rate) / 100
                    return (
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
                                  setValue(`items.${i}.gst_rate`, prod.gst_rate || 18)
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
                        <td className="px-1 py-1"><Input className="h-8 text-xs w-36" {...register(`items.${i}.description`)} /></td>
                        <td className="px-1 py-1"><Input className="h-8 text-xs w-20" {...register(`items.${i}.hsn_code`)} /></td>
                        <td className="px-1 py-1"><Input className="h-8 text-xs w-16" {...register(`items.${i}.uom`)} /></td>
                        <td className="px-1 py-1"><Input className="h-8 text-xs w-16" type="number" step="0.001" {...register(`items.${i}.qty`)} /></td>
                        <td className="px-1 py-1"><Input className="h-8 text-xs w-20" type="number" step="0.01" {...register(`items.${i}.rate`)} /></td>
                        <td className="px-1 py-1"><Input className="h-8 text-xs w-14" type="number" step="0.01" {...register(`items.${i}.gst_rate`)} /></td>
                        <td className="px-1 py-1 text-right font-mono text-xs">
                          ₹{(amt + gst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-1 py-1">
                          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => remove(i)}>
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="space-y-1 text-sm min-w-48">
              <div className="flex justify-between"><span className="text-slate-500">Taxable</span><span className="font-mono">₹{taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">GST</span><span className="font-mono">₹{totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
              <div className="flex justify-between font-bold text-base border-t pt-1"><span>Total</span><span className="font-mono">₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : isEdit ? 'Update' : 'Create Proforma'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
