import { useEffect } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { bomApi, settingsApi } from '@/lib/api'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trash2, Plus } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

const EMPTY_ITEM = { component_id: '', qty: 1, uom: 'NOS', notes: '' }

export default function BOMEditor({ open, onClose, editBOM }) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const isEdit = !!editBOM

  const { register, control, handleSubmit, reset } = useForm({
    defaultValues: {
      product_id: '',
      notes: '',
      items: [{ ...EMPTY_ITEM }],
    }
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: settingsApi.listProducts })

  useEffect(() => {
    if (editBOM) {
      reset({
        product_id: editBOM.product_id || '',
        notes: editBOM.notes || '',
        items: editBOM.bom_items?.length
          ? editBOM.bom_items.map(it => ({
              component_id: it.component_id,
              qty: it.qty,
              uom: it.uom,
              notes: it.notes || '',
            }))
          : [{ ...EMPTY_ITEM }],
      })
    }
  }, [editBOM, reset])

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? bomApi.update(editBOM.id, data) : bomApi.create(data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['bom'] })
      toast({ title: isEdit ? `BOM v${data.version} created` : 'BOM created' })
      onClose()
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  const onSubmit = (data) => {
    mutation.mutate({
      ...data,
      items: data.items.map(it => ({
        ...it,
        qty: parseFloat(it.qty) || 1,
      })),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `New Version — ${editBOM.products?.name}` : 'Create Bill of Materials'}</DialogTitle>
          {isEdit && <p className="text-xs text-slate-500">This will create v{editBOM.version + 1} and deactivate the current version.</p>}
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Finished Product <span className="text-red-500">*</span></label>
              <Controller control={control} name="product_id" rules={{ required: true }}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={isEdit}>
                    <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                    <SelectContent>
                      {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Notes</label>
              <Input {...register('notes')} placeholder="Optional revision notes" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">Components</h3>
              <Button type="button" variant="outline" size="sm" onClick={() => append({ ...EMPTY_ITEM })}>
                <Plus className="h-3 w-3 mr-1" />Add Component
              </Button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  {['Component', 'Qty', 'UOM', 'Notes', ''].map(h => (
                    <th key={h} className="px-2 py-1.5 text-left font-medium text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fields.map((field, i) => (
                  <tr key={field.id} className="border-t">
                    <td className="px-1 py-1">
                      <Controller control={control} name={`items.${i}.component_id`} rules={{ required: true }}
                        render={({ field: f }) => (
                          <Select value={f.value} onValueChange={f.onChange}>
                            <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>
                              {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </td>
                    <td className="px-1 py-1"><Input className="h-8 text-xs w-20" type="number" step="0.001" {...register(`items.${i}.qty`)} /></td>
                    <td className="px-1 py-1"><Input className="h-8 text-xs w-16" {...register(`items.${i}.uom`)} /></td>
                    <td className="px-1 py-1"><Input className="h-8 text-xs w-28" {...register(`items.${i}.notes`)} /></td>
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
              {mutation.isPending ? 'Saving…' : isEdit ? 'Create New Version' : 'Create BOM'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
