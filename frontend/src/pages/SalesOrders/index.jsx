import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Plus, CheckCircle, Truck, Receipt, Trash2, Download } from 'lucide-react'
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
  const navigate = useNavigate()
  const location = useLocation()
  const canWrite = useHasRole('admin', 'sales')
  const canInvoice = useHasRole('admin', 'sales', 'accounts')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [highlightId, setHighlightId] = useState(null)
  const { data = [] } = useQuery({ queryKey: ['orders'], queryFn: ordersApi.list })

  useEffect(() => {
    if (location.state?.highlightId) {
      setHighlightId(location.state.highlightId)
      window.history.replaceState({}, '')
      // Clear highlight after 3 seconds
      setTimeout(() => setHighlightId(null), 3000)
    }
  }, [location.state])

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => ordersApi.updateStatus(id, status),
    onSuccess: (_, { status }) => {
      toast({ title: `Order marked as ${status}` })
      qc.invalidateQueries(['orders'])
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => ordersApi.delete(id),
    onSuccess: () => { toast({ title: 'Order deleted' }); qc.invalidateQueries(['orders']) },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  async function downloadPdf(so) {
    try {
      const blob = await ordersApi.downloadPdf(so.id)
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
      const a = document.createElement('a'); a.href = url; a.download = `${so.so_no}.pdf`; a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  async function handleCreateInvoice(so) {
    try {
      const prefill = await ordersApi.getInvoicePrefill(so.id)
      navigate('/invoices', { state: { fromSO: prefill } })
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const getRowClassName = (row) =>
    row.original.id === highlightId
      ? 'bg-blue-50 ring-2 ring-inset ring-blue-400 transition-colors'
      : 'hover:bg-gray-50 transition-colors'

  const columns = [
    { accessorKey: 'so_no', header: 'SO #' },
    { accessorKey: 'companies.name', header: 'Customer' },
    { accessorKey: 'date', header: 'Date', cell: ({ getValue }) => formatDate(getValue()) },
    { accessorKey: 'delivery_date', header: 'Delivery', cell: ({ getValue }) => formatDate(getValue()) },
    { accessorKey: 'po_reference', header: 'PO Ref' },
    { accessorKey: 'total', header: 'Total', cell: ({ getValue }) => formatCurrency(getValue()) },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <Badge className={statusColor(getValue())}>{getValue()}</Badge> },
    {
      id: 'invoices_link',
      header: 'Invoices',
      cell: ({ row }) => {
        const invs = row.original.invoices ?? []
        if (!invs.length) return <span className="text-muted-foreground text-xs">—</span>
        return (
          <button
            className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 text-xs px-2 py-0.5 font-medium hover:bg-blue-200"
            onClick={() => navigate('/invoices', { state: { filterSONo: row.original.so_no } })}
          >
            {invs.length} invoice{invs.length > 1 ? 's' : ''}
          </button>
        )
      },
    },
    {
      id: 'actions', header: '',
      cell: ({ row }) => {
        const { id, status } = row.original
        return (
          <div className="flex gap-1 flex-wrap">
            {canWrite && (
              <Button size="sm" variant="ghost" onClick={() => { setEditing(row.original); setOpen(true) }}>Edit</Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => downloadPdf(row.original)}>
              <Download className="h-3 w-3" />
            </Button>
            {canWrite && status === 'draft' && (
              <Button size="sm" variant="outline" className="text-blue-700 border-blue-300"
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate({ id, status: 'confirmed' })}>
                <CheckCircle className="h-3 w-3 mr-1" />Confirm
              </Button>
            )}
            {canWrite && status === 'confirmed' && (
              <Button size="sm" variant="outline" className="text-purple-700 border-purple-300"
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate({ id, status: 'dispatched' })}>
                <Truck className="h-3 w-3 mr-1" />Dispatched
              </Button>
            )}
            {canWrite && ['draft', 'cancelled'].includes(status) && (
              <Button size="sm" variant="ghost" className="text-red-500"
                onClick={() => { if (confirm(`Delete ${row.original.so_no}?`)) deleteMutation.mutate(id) }}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
            {canInvoice && ['confirmed', 'dispatched'].includes(status) && (
              <Button size="sm" variant="outline" className="text-green-700 border-green-300"
                onClick={() => handleCreateInvoice(row.original)}>
                <Receipt className="h-3 w-3 mr-1" />Invoice
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
        getRowClassName={getRowClassName}
      />
      {open && <SOForm open={open} onClose={() => setOpen(false)} existing={editing} />}
    </div>
  )
}
