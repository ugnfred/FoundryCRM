import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { ordersApi } from '@/lib/api'
import { formatCurrency, formatDate, statusColor } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import { useHasRole } from '@/hooks/useAuth'
import SOForm from './SOForm'

export default function SalesOrders() {
  const canWrite = useHasRole('admin', 'sales')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const { data = [] } = useQuery({ queryKey: ['orders'], queryFn: ordersApi.list })

  const columns = [
    { accessorKey: 'so_no', header: 'SO #' },
    { accessorKey: 'companies.name', header: 'Customer' },
    { accessorKey: 'date', header: 'Date', cell: ({ getValue }) => formatDate(getValue()) },
    { accessorKey: 'delivery_date', header: 'Delivery', cell: ({ getValue }) => formatDate(getValue()) },
    { accessorKey: 'po_reference', header: 'PO Ref' },
    { accessorKey: 'total', header: 'Total', cell: ({ getValue }) => formatCurrency(getValue()) },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <Badge className={statusColor(getValue())}>{getValue()}</Badge> },
    {
      id: 'actions', header: '',
      cell: ({ row }) => canWrite && (
        <Button size="sm" variant="ghost" onClick={() => { setEditing(row.original); setOpen(true) }}>Edit</Button>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{data.length} orders</p>
        {canWrite && (
          <Button onClick={() => { setEditing(null); setOpen(true) }}>
            <Plus className="h-4 w-4 mr-1" /> New Sales Order
          </Button>
        )}
      </div>
      <DataTable columns={columns} data={data} searchPlaceholder="Search orders…" />
      {open && <SOForm open={open} onClose={() => setOpen(false)} existing={editing} />}
    </div>
  )
}
