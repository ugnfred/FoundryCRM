import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { deliveryChallansApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import { DetailDrawer } from '@/components/shared/DetailDrawer'
import { Plus, Download, Truck, X, Link2 } from 'lucide-react'
import DCForm from './DCForm'
import DCDrawerContent from './DCDrawerContent'
import { useToast } from '@/components/ui/toast'

const STATUS_COLORS = { draft: 'secondary', dispatched: 'default', cancelled: 'destructive' }

export default function DeliveryChallans() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editDC, setEditDC] = useState(null)
  const [selectedId, setSelectedId] = useState(null)

  const { data: dcList = [], isLoading } = useQuery({
    queryKey: ['delivery-challans'],
    queryFn: deliveryChallansApi.list,
  })

  const { data: dcDetail } = useQuery({
    queryKey: ['delivery-challan', selectedId],
    queryFn: () => deliveryChallansApi.get(selectedId),
    enabled: !!selectedId,
    staleTime: 30_000,
  })

  const selectedDC = dcDetail ?? dcList.find(d => d.id === selectedId)

  const dispatchMutation = useMutation({
    mutationFn: (id) => deliveryChallansApi.dispatch(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delivery-challans'] })
      qc.invalidateQueries({ queryKey: ['delivery-challan', selectedId] })
      toast({ title: 'Challan marked as dispatched' })
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  const cancelMutation = useMutation({
    mutationFn: (id) => deliveryChallansApi.cancel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delivery-challans'] })
      qc.invalidateQueries({ queryKey: ['delivery-challan', selectedId] })
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  async function downloadPdf(id, dcNo) {
    try {
      const blob = await deliveryChallansApi.downloadPdf(id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `DC-${dcNo}.pdf`; a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const columns = [
    { accessorKey: 'dc_no', header: 'DC No', cell: ({ getValue }) => <span className="font-mono font-semibold">{getValue()}</span> },
    { accessorKey: 'companies.name', header: 'Customer' },
    { accessorKey: 'date', header: 'Date' },
    { accessorKey: 'sales_orders.so_no', header: 'SO Ref', cell: ({ getValue }) => getValue() || '—' },
    { accessorKey: 'vehicle_no', header: 'Vehicle No', cell: ({ getValue }) => getValue() || '—' },
    { accessorKey: 'transporter_name', header: 'Transporter', cell: ({ getValue }) => getValue() || '—' },
    {
      accessorKey: 'status', header: 'Status',
      cell: ({ getValue }) => <Badge variant={STATUS_COLORS[getValue()] || 'secondary'} className="capitalize">{getValue()}</Badge>,
    },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); downloadPdf(row.original.id, row.original.dc_no) }}>
          <Download className="h-3 w-3" />
        </Button>
      ),
    },
  ]

  const getRowClassName = (row) => {
    if (row.original.id === selectedId) return 'bg-primary/5 border-l-4 border-l-primary cursor-pointer'
    return 'hover:bg-gray-50 cursor-pointer'
  }

  const dc = selectedDC
  const status = dc?.status

  const drawerPrimary = status === 'draft' ? {
    label: 'Mark Dispatched',
    icon: Truck,
    onClick: () => { if (confirm('Mark as dispatched?')) dispatchMutation.mutate(selectedId) },
    disabled: dispatchMutation.isPending,
  } : undefined

  const drawerSecondary = [
    status === 'draft' ? { label: 'Edit', onClick: () => { setEditDC(dc); setFormOpen(true); setSelectedId(null) } } : null,
  ].filter(Boolean)

  const drawerDestructive = status === 'draft' ? {
    label: 'Cancel',
    icon: X,
    onClick: () => { if (confirm('Cancel this challan?')) cancelMutation.mutate(selectedId) },
  } : undefined

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Delivery Challans</h1>
          <p className="text-slate-500 text-sm">Dispatch documents — no pricing, for delivery use only</p>
        </div>
        <Button onClick={() => { setEditDC(null); setFormOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" />New Challan
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={dcList}
        isLoading={isLoading}
        emptyMessage="No delivery challans yet"
        onRowClick={(row) => setSelectedId(row.original.id === selectedId ? null : row.original.id)}
        getRowClassName={getRowClassName}
      />

      <DetailDrawer
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        title={dc?.dc_no ?? '…'}
        subtitle={dc?.companies?.name}
        status={status}
        statusLabel={status}
        headerActions={[
          { icon: Download, tooltip: 'Download PDF', onClick: () => dc && downloadPdf(dc.id, dc.dc_no) },
          { icon: Link2, tooltip: 'Copy link', onClick: () => { navigator.clipboard.writeText(window.location.origin + '/delivery-challans?dc=' + selectedId); toast({ title: 'Link copied' }) } },
        ]}
        primaryAction={drawerPrimary}
        secondaryActions={drawerSecondary}
        destructiveAction={drawerDestructive}
      >
        <DCDrawerContent dc={dc} />
      </DetailDrawer>

      {formOpen && (
        <DCForm open={formOpen} onClose={() => { setFormOpen(false); setEditDC(null) }} editDC={editDC} />
      )}
    </div>
  )
}
