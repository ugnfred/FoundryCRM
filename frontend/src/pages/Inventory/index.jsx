import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { inventoryApi } from '@/lib/api'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import LedgerModal from './LedgerModal'
import StockAdjustModal from './StockAdjustModal'
import { useHasRole } from '@/hooks/useAuth'

export default function Inventory() {
  const [ledgerProduct, setLedgerProduct] = useState(null)
  const [adjustProduct, setAdjustProduct] = useState(null)
  const isAdmin = useHasRole('admin')
  const { data = [] } = useQuery({ queryKey: ['stock'], queryFn: inventoryApi.stock })

  const lowStock = data.filter((p) => Number(p.balance) <= 0)

  const columns = [
    { accessorKey: 'name', header: 'Product' },
    { accessorKey: 'hsn_code', header: 'HSN' },
    { accessorKey: 'category', header: 'Category' },
    { accessorKey: 'uom', header: 'UOM' },
    {
      accessorKey: 'balance', header: 'Stock Balance',
      cell: ({ getValue }) => (
        <span className={Number(getValue()) <= 0 ? 'text-red-600 font-semibold' : 'font-semibold'}>
          {Number(getValue()).toLocaleString('en-IN', { maximumFractionDigits: 3 })}
        </span>
      ),
    },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => setLedgerProduct(row.original)}>Ledger</Button>
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={() => setAdjustProduct(row.original)}>Adjust</Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      {lowStock.length > 0 && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {lowStock.length} product(s) at zero or negative stock: {lowStock.map((p) => p.name).join(', ')}
        </div>
      )}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total Products</p><p className="text-2xl font-bold">{data.length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">In Stock</p><p className="text-2xl font-bold text-green-600">{data.filter((p) => Number(p.balance) > 0).length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Zero / Negative</p><p className="text-2xl font-bold text-red-600">{lowStock.length}</p></CardContent></Card>
      </div>
      <DataTable columns={columns} data={data} searchPlaceholder="Search products…" />
      {ledgerProduct && <LedgerModal open={!!ledgerProduct} onClose={() => setLedgerProduct(null)} product={ledgerProduct} />}
      {adjustProduct && <StockAdjustModal open={!!adjustProduct} onClose={() => setAdjustProduct(null)} product={adjustProduct} />}
    </div>
  )
}
