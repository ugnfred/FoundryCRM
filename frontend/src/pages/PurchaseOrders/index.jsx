import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, PackageCheck } from 'lucide-react'
import { purchaseOrdersApi } from '@/lib/api'
import { formatCurrency, formatDate, statusColor } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import { useHasRole } from '@/hooks/useAuth'
import POForm from './POForm'
import GRNForm from './GRNForm'

export default function PurchaseOrders() {
  const canWrite = useHasRole('admin', 'accounts')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [grnPO, setGrnPO] = useState(null)
  const { data = [] } = useQuery({ queryKey: ['purchase-orders'], queryFn: purchaseOrdersApi.list })

  const columns = [
    { accessorKey: 'po_no', header: 'PO #' },
    { accessorKey: 'companies.name', header: 'Supplier' },
    { accessorKey: 'date', header: 'Date', cell: ({ getValue }) => formatDate(getValue()) },
    { accessorKey: 'delivery_date', header: 'Delivery', cell: ({ getValue }) => formatDate(getValue()) },
    { accessorKey: 'total', header: 'Total', cell: ({ getValue }) => formatCurrency(getValue()) },
    {
      id: 'received',
      header: 'Received',
      cell: ({ row }) => {
        const items = row.original.po_items ?? []
        if (!items.length) return <span className="text-muted-foreground text-xs">—</span>
        const ordered = items.reduce((s, i) => s + Number(i.qty ?? 0), 0)
        const received = items.reduce((s, i) => s + Number(i.received_qty ?? 0), 0)
        const pct = ordered > 0 ? Math.round((received / ordered) * 100) : 0
        return (
          <span className={`text-xs font-medium ${pct === 100 ? 'text-green-700' : pct > 0 ? 'text-amber-700' : 'text-muted-foreground'}`}>
            {received}/{ordered} ({pct}%)
          </span>
        )
      },
    },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <Badge className={statusColor(getValue())}>{getValue()}</Badge> },
    {
      id: 'actions', header: '',
      cell: ({ row }) => canWrite && (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => { setEditing(row.original); setOpen(true) }}>Edit</Button>
          {['sent', 'partial'].includes(row.original.status) && (
            <Button size="sm" variant="outline" onClick={() => setGrnPO(row.original)}>
              <PackageCheck className="h-3 w-3 mr-1" /> GRN
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{data.length} purchase orders</p>
        {canWrite && (
          <Button onClick={() => { setEditing(null); setOpen(true) }}>
            <Plus className="h-4 w-4 mr-1" /> New PO
          </Button>
        )}
      </div>
      <DataTable columns={columns} data={data} searchPlaceholder="Search POs…" emptyMessage="No purchase orders yet. Create your first PO to get started." />
      {open && <POForm open={open} onClose={() => setOpen(false)} existing={editing} />}
      {grnPO && <GRNForm open={!!grnPO} onClose={() => setGrnPO(null)} po={grnPO} />}
    </div>
  )
}
