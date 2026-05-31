import { useForm, useFieldArray } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { invoicesApi, settingsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'

const emptyItem = { description: '', hsn_code: '', uom: 'NOS', qty: 1, rate: 0, gst_rate: 18 }
const STATE_CODES = [
  { code: '27', name: 'Maharashtra' }, { code: '07', name: 'Delhi' },
  { code: '29', name: 'Karnataka' }, { code: '33', name: 'Tamil Nadu' },
  { code: '06', name: 'Haryana' }, { code: '09', name: 'Uttar Pradesh' },
  { code: '19', name: 'West Bengal' }, { code: '24', name: 'Gujarat' },
]

export default function InvoiceForm({ open, onClose, existing }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: settingsApi.listCompanies })
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: settingsApi.listProducts })

  const { register, control, handleSubmit, setValue, watch } = useForm({
    defaultValues: existing
      ? { ...existing, items: existing.invoice_items ?? existing.items ?? [emptyItem] }
      : { company_id: '', date: new Date().toISOString().slice(0, 10), due_date: '', place_of_supply: '27', items: [emptyItem] },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const pn = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n }
  const items = watch('items') ?? []
  const taxable = items.reduce((s, i) => s + pn(i.qty) * pn(i.rate), 0)
  const gst = items.reduce((s, i) => s + pn(i.qty) * pn(i.rate) * pn(i.gst_rate) / 100, 0)

  const mutation = useMutation({
    mutationFn: (d) => existing ? invoicesApi.update(existing.id, d) : invoicesApi.create(d),
    onSuccess: () => { toast({ title: 'Saved' }); qc.invalidateQueries(['invoices']); onClose() },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  function fillFromProduct(index, productId) {
    const p = products.find((x) => x.id === productId)
    if (!p) return
    setValue(`items.${index}.product_id`, p.id)
    setValue(`items.${index}.description`, p.name)
    setValue(`items.${index}.hsn_code`, p.hsn_code)
    setValue(`items.${index}.uom`, p.uom)
    setValue(`items.${index}.rate`, p.base_rate)
    setValue(`items.${index}.gst_rate`, p.gst_rate)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{existing ? 'Edit Invoice' : 'New Invoice'}</DialogTitle></DialogHeader>
        <DialogBody>
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Customer</Label>
                <select {...register('company_id', { required: true })} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                  <option value="">Select customer…</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5"><Label>Date</Label><Input type="date" {...register('date', { required: true })} /></div>
              <div className="space-y-1.5"><Label>Due Date</Label><Input type="date" {...register('due_date')} /></div>
              <div className="col-span-2 space-y-1.5">
                <Label>Place of Supply</Label>
                <select {...register('place_of_supply', { required: true })} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                  {STATE_CODES.map((s) => <option key={s.code} value={s.code}>{s.code} — {s.name}</option>)}
                </select>
                <p className="text-xs text-muted-foreground">Same state as seller → CGST+SGST. Different state → IGST.</p>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Line Items</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => append(emptyItem)}><Plus className="h-3 w-3 mr-1" /> Add Row</Button>
              </div>
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b"><tr>{['Product','Description','HSN','UOM','Qty','Rate','GST%','Amount',''].map((h) => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600">{h}</th>)}</tr></thead>
                  <tbody className="divide-y">
                    {fields.map((field, i) => {
                      const amt = pn(items[i]?.qty) * pn(items[i]?.rate)
                      return (
                        <tr key={field.id}>
                          <td className="px-2 py-1.5"><select value={items[i]?.product_id || ''} onChange={(e) => fillFromProduct(i, e.target.value)} className="h-8 rounded border border-input text-xs px-1 w-28"><option value="">Pick…</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><input type="hidden" {...register(`items.${i}.product_id`)} /></td>
                          <td className="px-2 py-1.5"><Input className="h-8 text-xs min-w-32" {...register(`items.${i}.description`)} /></td>
                          <td className="px-2 py-1.5"><Input className="h-8 text-xs w-20" {...register(`items.${i}.hsn_code`)} /></td>
                          <td className="px-2 py-1.5"><Input className="h-8 text-xs w-16" {...register(`items.${i}.uom`)} /></td>
                          <td className="px-2 py-1.5"><Input type="number" className="h-8 text-xs w-16" min="1" step="1" {...register(`items.${i}.qty`)} /></td>
                          <td className="px-2 py-1.5"><Input type="number" className="h-8 text-xs w-24" min="0" step="0.01" {...register(`items.${i}.rate`)} /></td>
                          <td className="px-2 py-1.5"><Input type="number" className="h-8 text-xs w-16" min="0" step="1" {...register(`items.${i}.gst_rate`)} /></td>
                          <td className="px-2 py-1.5 text-right font-medium">₹{amt.toLocaleString('en-IN')}</td>
                          <td className="px-2 py-1.5">{fields.length > 1 && <Button type="button" size="icon" variant="ghost" onClick={() => remove(i)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex justify-end text-sm">
                <div className="space-y-1 text-right">
                  <div className="flex gap-8 text-muted-foreground"><span>Taxable</span><span>₹{taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                  <div className="flex gap-8 text-muted-foreground"><span>GST</span><span>₹{gst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                  <div className="flex gap-8 font-semibold"><span>Total</span><span>₹{(taxable + gst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save Invoice'}</Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
