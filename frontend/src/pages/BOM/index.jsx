import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { bomApi, settingsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Edit } from 'lucide-react'
import BOMEditor from './BOMEditor'
import { useHasRole } from '@/hooks/useAuth'

export default function BOM() {
  const canWrite = useHasRole('admin', 'production')
  const [productFilter, setProductFilter] = useState('all')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editBOM, setEditBOM] = useState(null)

  const { data: allBoms = [], isLoading } = useQuery({
    queryKey: ['bom', productFilter],
    queryFn: () => bomApi.list(productFilter === 'all' ? undefined : productFilter),
  })
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: settingsApi.listProducts })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bill of Materials</h1>
          <p className="text-slate-500 text-sm">Component requirements per finished product — versioned</p>
        </div>
        {canWrite && (
          <Button onClick={() => { setEditBOM(null); setEditorOpen(true) }}>
            <Plus className="h-4 w-4 mr-2" />New BOM
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3 p-3 bg-white border rounded-lg">
        <label className="text-sm font-medium shrink-0">Filter by Product:</label>
        <Select value={productFilter} onValueChange={setProductFilter}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="All products" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All products</SelectItem>
            {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading && <p className="text-center text-slate-400 py-8">Loading…</p>}

      {!isLoading && allBoms.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg font-medium">No BOMs yet</p>
          <p className="text-sm mt-1">Create a BOM to define component requirements for finished goods</p>
        </div>
      )}

      <div className="space-y-4">
        {allBoms.map(bom => (
          <div key={bom.id} className="bg-white border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b">
              <div className="flex items-center gap-3">
                <span className="font-semibold">{bom.products?.name}</span>
                <Badge variant={bom.is_active ? 'default' : 'secondary'}>
                  v{bom.version} {bom.is_active ? '(Active)' : '(Inactive)'}
                </Badge>
              </div>
              {canWrite && bom.is_active && (
                <Button size="sm" variant="outline" onClick={() => { setEditBOM(bom); setEditorOpen(true) }}>
                  <Edit className="h-3 w-3 mr-1" />New Version
                </Button>
              )}
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Component</th>
                  <th className="px-4 py-2 text-right font-medium">Qty</th>
                  <th className="px-4 py-2 text-left font-medium">UOM</th>
                  <th className="px-4 py-2 text-left font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {bom.bom_items?.map((item, i) => (
                  <tr key={item.id} className={i % 2 === 0 ? '' : 'bg-slate-50'}>
                    <td className="px-4 py-2">{item.products?.name || item.component_id}</td>
                    <td className="px-4 py-2 text-right font-mono">{parseFloat(item.qty).toFixed(3)}</td>
                    <td className="px-4 py-2">{item.uom}</td>
                    <td className="px-4 py-2 text-slate-500 text-xs">{item.notes || '—'}</td>
                  </tr>
                ))}
                {(!bom.bom_items || bom.bom_items.length === 0) && (
                  <tr><td colSpan={4} className="px-4 py-4 text-center text-slate-400 text-sm">No components</td></tr>
                )}
              </tbody>
            </table>
            {bom.notes && (
              <div className="px-4 py-2 text-xs text-slate-500 border-t bg-slate-50">Notes: {bom.notes}</div>
            )}
          </div>
        ))}
      </div>

      {editorOpen && (
        <BOMEditor open={editorOpen} onClose={() => { setEditorOpen(false); setEditBOM(null) }} editBOM={editBOM} />
      )}
    </div>
  )
}
