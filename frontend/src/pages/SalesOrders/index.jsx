import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, CheckCircle, Truck } from 'lucide-react'
import { ordersApi } from '@/lib/api'
import { formatCurrency, formatDate, statusColor } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import { useHasRole } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/toast'
import SOForm from './SOForm'

export default function SalesOrders() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const canWrite = useHasRole('admin', 'sales')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const { data = [] } = useQuery({ queryKey: ['orders'], queryFn: ordersApi.list })

  const statusMutation = useMutation({
    mutationFn: ({ id, row, status }) => ordersApi.update(id, { ...row, status }),
    onSuccess: (_, { status }) => {
      toast({ title: `Order marked as ${status}` })
      qc.invalidateQueries(['orders'])
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

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
      cell: ({ row }) => {
        if (!canWrite) return null
        const { id, status } = row.original
        return (
          <div className="flex gap-1 flex-wrap">
            <Button size="sm" variant="ghost" onClick={() => { setEditing(row.original); setOpen(true) }}>Edit</Button>

            {status === 'draft' && (
              <Button size="sm" variant="outline" className="text-blue-700 border-blue-300" onClick={() => statusMutation.mutate({ id, row: row.original, status: 'confirmed' })}>
                <CheckCircle className="h-3 w-3 mr-1" />Confirm
              </Button>
            )}
            {status === 'confirmed' && (
              <Button size="sm" variant="outline" className="text-purple-700 border-purple-300" onClick={() => statusMutation.mutate({ id, row: row.original, status: 'dispatched' })}>
                <Truck className="h-3 w-3 mr-1" />Dispatched
              </Button>
            )}
          </div>
        )
      },
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
      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search orders…"
        emptyMessage="No sales orders yet. Convert a quotation or create a new order."
      />
      {open && <SOForm open={open} onClose={() => setOpen(false)} existing={editing} />}
    </div>
  )
}
