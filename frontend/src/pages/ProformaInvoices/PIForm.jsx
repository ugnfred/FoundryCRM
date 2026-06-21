import { useEffect } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { proformaApi, settingsApi, ordersApi } from '@/lib/api'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Trash2, Plus } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

const pn = (v) => { const f = parseFloat(v); return isNaN(f) ? 0 : f }
const EMPTY_ITEM = { description: '', hsn_code: '', uom: 'NOS', qty: 1, rate: 0, gst_rate: 18, product_id: null }

const INDIAN_STATES = [
  { code: '01', name: 'Jammu & Kashmir' }, { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' }, { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' }, { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' }, { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' }, { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' }, { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' }, { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' }, { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' }, { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' }, { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' }, { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' }, { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra & Nagar Haveli and Daman & Diu' },
  { code: '27', name: 'Maharashtra' }, { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' }, { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' }, { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' }, { code: '35', name: 'Andaman & Nicobar Islands' },
  { code: '36', name: 'Telangana' }, { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' },
]

export default function PIForm({ open, onClose, editPI }) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const isEdit = !!editPI

  const {
    register, control, handleSubmit, watch, setValue, reset,
    formState: { errors },
  } = useForm({
    mode: 'onBlur',
    defaultValues: {
      company_id: '',
      so_id: null,
      date: new Date().toISOString().slice(0, 10),
      validity_date: '',
      place_of_supply: '27',
      notes: '',
      items: [{ ...EMPTY_ITEM }],
    },
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
    mutation.mutate({
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
    })
  }

  function fillFromProduct(index, productId) {
    const prod = products.find(p => p.id === productId)
    if (!prod) return
    setValue(`items.${index}.description`, prod.name)
    setValue(`items.${index}.hsn_code`, prod.hsn_code || '')
    setValue(`items.${index}.uom`, prod.uom || 'NOS')
    setValue(`items.${index}.gst_rate`, prod.gst_rate || 18)
    setValue(`items.${index}.rate`, prod.base_rate || 0)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      {/* R1: wider modal, flex-column so header/footer can be sticky */}
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 gap-0">

        {/* Sticky header */}
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="text-lg">
            {isEdit ? `Edit ${editPI.pi_no}` : 'New Proforma Invoice'}
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <form id="pi-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5">

            {/* R2: Document Details card */}
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Document Details
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">

                  {/* Customer — spans 2 cols */}
                  <div className="col-span-2 space-y-1.5">
                    <Label>
                      Customer <span className="text-destructive ml-0.5">*</span>
                    </Label>
                    <Controller control={control} name="company_id"
                      rules={{ required: 'Customer is required' }}
                      render={({ field }) => (
                        <Select value={field.value || 'none_cust'} onValueChange={v => field.onChange(v === 'none_cust' ? '' : v)}>
                          <SelectTrigger className={errors.company_id ? 'border-destructive' : ''}>
                            <SelectValue placeholder="Select customer" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none_cust" disabled>Select customer…</SelectItem>
                            {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.company_id && (
                      <p className="text-xs text-destructive">{errors.company_id.message}</p>
                    )}
                  </div>

                  {/* Date */}
                  <div className="space-y-1.5">
                    <Label>Date <span className="text-destructive ml-0.5">*</span></Label>
                    <Input type="date" {...register('date', { required: 'Date is required' })}
                      className={errors.date ? 'border-destructive' : ''} />
                    {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
                  </div>

                  {/* Valid Until */}
                  <div className="space-y-1.5">
                    <Label>Valid Until</Label>
                    <Input type="date" {...register('validity_date')} />
                    <p className="text-xs text-muted-foreground">Recommended — leave blank for open-ended</p>
                  </div>

                  {/* R3: Place of Supply — dropdown with state names */}
                  <div className="col-span-2 space-y-1.5">
                    <Label>Place of Supply <span className="text-destructive ml-0.5">*</span></Label>
                    <Controller control={control} name="place_of_supply"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                          <SelectContent className="max-h-60">
                            {INDIAN_STATES.map(s => (
                              <SelectItem key={s.code} value={s.code}>
                                {s.code} — {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  {/* R7: Notes as textarea — spans 2 cols */}
                  <div className="col-span-2 space-y-1.5">
                    <Label>Notes</Label>
                    <textarea
                      {...register('notes')}
                      rows={2}
                      placeholder="Payment terms, delivery instructions, special conditions…"
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* R2: Reference card — only when SOs exist */}
            {orders.filter(o => o.status !== 'cancelled').length > 0 && (
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Reference
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Sales Order (optional)</Label>
                      <Controller control={control} name="so_id"
                        render={({ field }) => (
                          <Select value={field.value || 'none'} onValueChange={v => field.onChange(v === 'none' ? null : v)}>
                            <SelectTrigger><SelectValue placeholder="Link to SO" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— None —</SelectItem>
                              {orders.filter(o => o.status !== 'cancelled').map(o => (
                                <SelectItem key={o.id} value={o.id}>{o.so_no} — {o.companies?.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* R4: Line items — fixed columns, Amount = taxable only */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Line Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => append({ ...EMPTY_ITEM })}>
                  <Plus className="h-3 w-3 mr-1" />Add Item
                </Button>
              </div>

              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-sm min-w-[780px]">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 w-6">#</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 w-36">Product</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">Description</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 w-20">HSN</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 w-16">UOM</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 w-16">Qty</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 w-24">Rate (₹)</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 w-16">GST%</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 w-24">Amount (₹)</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {fields.map((field, i) => {
                      const amt = pn(items[i]?.qty) * pn(items[i]?.rate)
                      return (
                        <tr key={field.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-xs text-gray-400">{i + 1}</td>
                          <td className="px-2 py-2">
                            {/* Native select avoids Radix complexity inside table rows */}
                            <select
                              value={items[i]?.product_id || ''}
                              onChange={e => {
                                setValue(`items.${i}.product_id`, e.target.value || null)
                                if (e.target.value) fillFromProduct(i, e.target.value)
                              }}
                              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                            >
                              <option value="">— Manual —</option>
                              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <input type="hidden" {...register(`items.${i}.product_id`)} />
                          </td>
                          <td className="px-2 py-2">
                            <Input className="h-8 text-xs" {...register(`items.${i}.description`)} />
                          </td>
                          <td className="px-2 py-2">
                            <Input className="h-8 text-xs w-20" {...register(`items.${i}.hsn_code`)} />
                          </td>
                          <td className="px-2 py-2">
                            <Input className="h-8 text-xs w-16" {...register(`items.${i}.uom`)} />
                          </td>
                          <td className="px-2 py-2">
                            <Input type="number" step="0.001" min="0.001"
                              className="h-8 text-xs w-16 text-right"
                              {...register(`items.${i}.qty`)} />
                          </td>
                          <td className="px-2 py-2">
                            <Input type="number" step="0.01" min="0"
                              className="h-8 text-xs w-24 text-right"
                              {...register(`items.${i}.rate`)} />
                          </td>
                          <td className="px-2 py-2">
                            <Input type="number" step="0.01" min="0"
                              className="h-8 text-xs w-16 text-right"
                              {...register(`items.${i}.gst_rate`)} />
                          </td>
                          {/* R4: Amount = taxable only (qty × rate), not including GST */}
                          <td className="px-3 py-2 text-right font-mono text-xs font-semibold tabular-nums">
                            {amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-2 py-2">
                            {fields.length > 1 && (
                              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(i)}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* R5: Totals */}
              <div className="flex justify-end pt-1">
                <dl className="w-56 space-y-1.5 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <dt>Taxable Amount</dt>
                    <dd className="font-mono tabular-nums">₹{taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</dd>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <dt>GST</dt>
                    <dd className="font-mono tabular-nums">₹{totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</dd>
                  </div>
                  <div className="flex justify-between font-semibold text-base border-t pt-2">
                    <dt>Total</dt>
                    <dd className="font-mono tabular-nums">₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</dd>
                  </div>
                </dl>
              </div>
            </div>

          </form>
        </div>

        {/* R8: Sticky footer with action buttons */}
        <div className="px-6 py-4 border-t bg-background shrink-0 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {isEdit ? `Editing ${editPI.pi_no}` : 'New proforma invoice — not a tax document'}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" form="pi-form" disabled={mutation.isPending} className="min-w-36">
              {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Proforma Invoice'}
            </Button>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  )
}
