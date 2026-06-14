import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { creditNotesApi, settingsApi, invoicesApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { Plus, Trash2 } from 'lucide-react'

const emptyItem = { description: '', hsn_code: '', uom: 'NOS', qty: 1, rate: 0, gst_rate: 18 }

function pn(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n }

export default function CNForm({ open, onClose, linkedInvoice = null }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: settingsApi.listCompanies })

  const getDefaults = () => {
    if (linkedInvoice) {
      return {
        invoice_id: linkedInvoice.id,
        company_id: linkedInvoice.company_id,
        date: new Date().toISOString().slice(0, 10),
        reason: '',
        place_of_supply: linkedInvoice.place_of_supply ?? '27',
        items: linkedInvoice.invoice_items?.length
          ? linkedInvoice.invoice_items.map((i) => ({
              description: i.description,
              hsn_code: i.hsn_code,
              uom: i.uom,
              qty: i.qty,
              rate: i.rate,
              gst_rate: i.gst_rate,
            }))
          : [emptyItem],
      }
    }
    return {
      invoice_id: '',
      company_id: '',
      date: new Date().toISOString().slice(0, 10),
      reason: '',
      place_of_supply: '27',
      items: [emptyItem],
    }
  }

  const { register, control, watch, handleSubmit, formState: { errors } } = useForm({ defaultValues: getDefaults() })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const items = watch('items') ?? []

  const taxable = items.reduce((s, i) => s + pn(i.qty) * pn(i.rate), 0)
  const gst = items.reduce((s, i) => s + pn(i.qty) * pn(i.rate) * pn(i.gst_rate) / 100, 0)
  const total = taxable + gst

  const mutation = useMutation({
    mutationFn: (data) => creditNotesApi.create(data),
    onSuccess: async (cn) => {
      // Auto-issue after creation
      try { await creditNotesApi.issue(cn.id) } catch (_) {}
      toast({ title: 'Credit Note issued', description: `${cn.cn_no} issued successfully.` })
      qc.invalidateQueries(['credit-notes'])
      qc.invalidateQueries(['invoices'])
      onClose()
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  function onSubmit(data) {
    mutation.mutate({
      ...data,
      invoice_id: data.invoice_id || null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {linkedInvoice ? `New Credit Note — against ${linkedInvoice.inv_no}` : 'New Credit Note'}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Customer */}
              <div className="space-y-1.5">
                <Label>Customer <span className="text-red-500">*</span></Label>
                {linkedInvoice ? (
                  <Input value={linkedInvoice.companies?.name ?? ''} disabled />
                ) : (
                  <select {...register('company_id', { required: true })}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                    <option value="">Select customer…</option>
                    {companies.filter(c => c.type !== 'supplier').map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
                {linkedInvoice && <input type="hidden" {...register('company_id')} />}
              </div>

              {/* Date */}
              <div className="space-y-1.5">
                <Label>Date <span className="text-red-500">*</span></Label>
                <Input type="date" {...register('date', { required: true })} />
              </div>

              {/* Invoice reference */}
              <div className="space-y-1.5">
                <Label>Against Invoice</Label>
                <Input
                  value={linkedInvoice?.inv_no ?? ''}
                  disabled={!!linkedInvoice}
                  placeholder="Optional"
                  readOnly
                />
                <input type="hidden" {...register('invoice_id')} />
              </div>

              {/* Reason */}
              <div className="space-y-1.5">
                <Label>Reason</Label>
                <Input {...register('reason')} placeholder="Sales return, pricing correction, etc." />
              </div>
            </div>

            {/* Line items */}
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-red-50 border-b">
                  <tr>
                    {['Description', 'HSN', 'UOM', 'Qty', 'Rate', 'GST%', 'Total', ''].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {fields.map((field, i) => {
                    const lineTotal = pn(items[i]?.qty) * pn(items[i]?.rate) * (1 + pn(items[i]?.gst_rate) / 100)
                    return (
                      <tr key={field.id}>
                        <td className="px-2 py-1"><Input {...register(`items.${i}.description`, { required: true })} className="h-8 text-xs min-w-[140px]" /></td>
                        <td className="px-2 py-1"><Input {...register(`items.${i}.hsn_code`)} className="h-8 text-xs w-20" /></td>
                        <td className="px-2 py-1"><Input {...register(`items.${i}.uom`)} className="h-8 text-xs w-16" /></td>
                        <td className="px-2 py-1"><Input type="number" step="0.001" {...register(`items.${i}.qty`, { valueAsNumber: true })} className="h-8 text-xs w-20" /></td>
                        <td className="px-2 py-1"><Input type="number" step="0.01" {...register(`items.${i}.rate`, { valueAsNumber: true })} className="h-8 text-xs w-24" /></td>
                        <td className="px-2 py-1"><Input type="number" step="0.01" {...register(`items.${i}.gst_rate`, { valueAsNumber: true })} className="h-8 text-xs w-16" /></td>
                        <td className="px-3 py-2 text-right text-xs font-medium">₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-2 py-1">
                          <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => remove(i)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => append({ ...emptyItem })}>
              <Plus className="h-3 w-3 mr-1" /> Add Item
            </Button>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="text-sm space-y-1 w-56">
                <div className="flex justify-between"><span className="text-muted-foreground">Taxable</span><span>₹{taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">GST</span><span>₹{gst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between font-semibold text-red-600 border-t pt-1">
                  <span>Credit Amount</span><span>₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" className="bg-red-600 hover:bg-red-700" disabled={mutation.isPending}>
                {mutation.isPending ? 'Issuing…' : 'Issue Credit Note'}
              </Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
