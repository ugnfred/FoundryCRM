import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Plus, CheckCircle, Truck, Receipt, Trash2, Download, Link2 } from 'lucide-react'
import { ordersApi } from '@/lib/api'
import { formatCurrency, formatDate, statusColor } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import { DetailDrawer } from '@/components/shared/DetailDrawer'
import { useHasRole } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/toast'
import SOForm from './SOForm'
import SODrawerContent from './SODrawerContent'

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
  const [selectedId, setSelectedId] = useState(null)

  const { data = [] } = useQuery({ queryKey: ['orders'], queryFn: ordersApi.list })

  const { data: soDetail } = useQuery({
    queryKey: ['order', selectedId],
    queryFn: () => ordersApi.get(selectedId),
    enabled: !!selectedId,
    staleTime: 30_000,
  })

  const selectedSO = soDetail ?? data.find(s => s.id === selectedId)

  useEffect(() => {
    if (location.state?.highlightId) {
      setHighlightId(location.state.highlightId)
      window.history.replaceState({}, '')
      setTimeout(() => setHighlightId(null), 3000)
    }
  }, [location.state])

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => ordersApi.updateStatus(id, status),
    onSuccess: (_, { status }) => {
      toast({ title: `Order marked as ${status}` })
      qc.invalidateQueries(['orders'])
      qc.invalidateQueries(['order', selectedId])
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => ordersApi.delete(id),
    onSuccess: () => { toast({ title: 'Order deleted' }); qc.invalidateQueries(['orders']); setSelectedId(null) },
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

  const columns = [
    { accessorKey: 'so_no', header: 'SO #', cell: ({ getValue }) => <span className="font-mono font-semibold">{getValue()}</span> },
    { accessorKey: 'companies.name', header: 'Customer' },
    { accessorKey: 'date', header: 'Date', cell: ({ getValue }) => formatDate(getValue()) },
    { accessorKey: 'delivery_date', header: 'Delivery', cell: ({ getValue }) => formatDate(getValue()) },
    { accessorKey: 'po_reference', header: 'PO Ref' },
    { accessorKey: 'total', header: 'Total', cell: ({ getValue }) => formatCurrency(getValue()) },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <Badge className={statusColor(getValue())}>{getValue()}</Badge> },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); downloadPdf(row.original) }}>
          <Download className="h-3 w-3" />
        </Button>
      ),
    },
  ]

  const getRowClassName = (row) => {
    if (row.original.id === highlightId) return 'bg-blue-50 ring-2 ring-inset ring-blue-400 transition-colors cursor-pointer'
    if (row.original.id === selectedId) return 'bg-primary/5 border-l-4 border-l-primary cursor-pointer'
    return 'hover:bg-gray-50 transition-colors cursor-pointer'
  }

  const so = selectedSO
  const status = so?.status

  const drawerPrimary = canInvoice && ['confirmed', 'dispatched'].includes(status) ? {
    label: 'Create Invoice',
    icon: Receipt,
    onClick: () => so && handleCreateInvoice(so),
  } : undefined

  const drawerSecondary = [
    canWrite && status === 'draft' ? { label: 'Confirm', icon: CheckCircle, onClick: () => statusMutation.mutate({ id: selectedId, status: 'confirmed' }) } : null,
    canWrite && status === 'confirmed' ? { label: 'Dispatch', icon: Truck, onClick: () => statusMutation.mutate({ id: selectedId, status: 'dispatched' }) } : null,
    canWrite && ['draft', 'sent'].includes(status) ? { label: 'Edit', onClick: () => { setEditing(so); setOpen(true); setSelectedId(null) } } : null,
  ].filter(Boolean)

  const drawerDestructive = canWrite && ['draft', 'cancelled'].includes(status) ? {
    label: 'Delete',
    icon: Trash2,
    onClick: () => { if (confirm(`Delete ${so?.so_no}?`)) deleteMutation.mutate(selectedId) },
  } : undefined

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
        onRowClick={(row) => setSelectedId(row.original.id === selectedId ? null : row.original.id)}
        getRowClassName={getRowClassName}
      />

      <DetailDrawer
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        title={so?.so_no ?? '…'}
        subtitle={so?.companies?.name}
        status={status}
        statusLabel={status}
        headerActions={[
          { icon: Download, tooltip: 'Download PDF', onClick: () => so && downloadPdf(so) },
          { icon: Link2, tooltip: 'Copy link', onClick: () => { navigator.clipboard.writeText(window.location.origin + '/sales-orders?so=' + selectedId); toast({ title: 'Link copied' }) } },
        ]}
        primaryAction={drawerPrimary}
        secondaryActions={drawerSecondary}
        destructiveAction={drawerDestructive}
      >
        <SODrawerContent so={so} />
      </DetailDrawer>

      {open && <SOForm open={open} onClose={() => { setOpen(false); setEditing(null) }} existing={editing} />}
    </div>
  )
}
