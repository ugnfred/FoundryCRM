import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { workOrdersApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import { DetailDrawer } from '@/components/shared/DetailDrawer'
import { Plus, CheckCircle, X } from 'lucide-react'
import WOForm from './WOForm'
import WODrawerContent from './WODrawerContent'
import { useToast } from '@/components/ui/toast'
import { useHasRole } from '@/hooks/useAuth'

const STATUS_COLORS = { open: 'secondary', in_progress: 'default', done: 'outline', cancelled: 'destructive' }
const STATUS_LABELS = { open: 'Open', in_progress: 'In Progress', done: 'Done', cancelled: 'Cancelled' }

export default function WorkOrders() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const canWrite = useHasRole('admin', 'production')
  const [formOpen, setFormOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')

  const { data: woList = [], isLoading } = useQuery({
    queryKey: ['work-orders', statusFilter],
    queryFn: () => workOrdersApi.list(statusFilter || undefined),
  })

  const { data: woDetail } = useQuery({
    queryKey: ['work-order', selectedId],
    queryFn: () => workOrdersApi.get(selectedId),
    enabled: !!selectedId,
    staleTime: 30_000,
  })

  const selectedWO = woDetail ?? woList.find(w => w.id === selectedId)

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => workOrdersApi.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-orders'] })
      qc.invalidateQueries({ queryKey: ['work-order', selectedId] })
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  const completeMutation = useMutation({
    mutationFn: (id) => workOrdersApi.complete(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['work-orders'] })
      qc.invalidateQueries({ queryKey: ['work-order', selectedId] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      toast({ title: `${data.wo_no} completed — stock updated` })
      setSelectedId(null)
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  const columns = [
    { accessorKey: 'wo_no', header: 'WO No', cell: ({ getValue }) => <span className="font-mono font-semibold">{getValue()}</span> },
    { accessorKey: 'products.name', header: 'Product' },
    { accessorKey: 'qty', header: 'Qty', cell: ({ getValue }) => <span className="font-mono">{parseFloat(getValue()).toFixed(2)}</span> },
    { accessorKey: 'sales_orders.so_no', header: 'SO Ref', cell: ({ getValue }) => getValue() || '—' },
    { accessorKey: 'target_date', header: 'Target Date', cell: ({ getValue }) => {
      const v = getValue()
      if (!v) return '—'
      const overdue = new Date(v) < new Date() ? 'text-red-600 font-semibold' : ''
      return <span className={overdue}>{v}</span>
    }},
    {
      accessorKey: 'status', header: 'Status',
      cell: ({ getValue }) => (
        <Badge variant={STATUS_COLORS[getValue()] || 'secondary'}>{STATUS_LABELS[getValue()] || getValue()}</Badge>
      ),
    },
  ]

  const getRowClassName = (row) => {
    if (row.original.id === selectedId) return 'bg-primary/5 border-l-4 border-l-primary cursor-pointer'
    return 'hover:bg-gray-50 cursor-pointer'
  }

  const wo = selectedWO
  const status = wo?.status
  const hasShortage = woDetail?.bom_headers?.bom_items?.some(i => i.shortage > 0)
  const canComplete = status === 'open' || status === 'in_progress'

  const drawerPrimary = canWrite && canComplete ? {
    label: completeMutation.isPending ? 'Completing…' : hasShortage ? 'Cannot Complete (Shortage)' : 'Mark Complete',
    icon: CheckCircle,
    onClick: () => {
      if (confirm(`Complete WO ${wo?.wo_no}? This will update stock levels.`)) {
        completeMutation.mutate(selectedId)
      }
    },
    disabled: hasShortage || completeMutation.isPending,
  } : undefined

  const drawerSecondary = canWrite ? [
    status === 'open' ? {
      label: 'Start',
      onClick: () => statusMutation.mutate({ id: selectedId, status: 'in_progress' }),
    } : null,
  ].filter(Boolean) : []

  const drawerDestructive = canWrite && status === 'open' ? {
    label: 'Cancel',
    icon: X,
    onClick: () => { if (confirm('Cancel this work order?')) statusMutation.mutate({ id: selectedId, status: 'cancelled' }) },
  } : undefined

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Work Orders</h1>
          <p className="text-slate-500 text-sm">Manufacturing jobs — linked to BOM, drives stock on completion</p>
        </div>
        {canWrite && (
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />New Work Order
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        {['', 'open', 'in_progress', 'done', 'cancelled'].map(s => (
          <Button key={s} size="sm" variant={statusFilter === s ? 'default' : 'outline'}
            onClick={() => setStatusFilter(s)}>
            {s === '' ? 'All' : STATUS_LABELS[s] || s}
          </Button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={woList}
        isLoading={isLoading}
        emptyMessage="No work orders yet"
        onRowClick={(row) => setSelectedId(row.original.id === selectedId ? null : row.original.id)}
        getRowClassName={getRowClassName}
      />

      <DetailDrawer
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        title={wo?.wo_no ?? '…'}
        subtitle={wo?.products?.name}
        status={status?.replace('_', ' ')}
        statusLabel={STATUS_LABELS[status] || status}
        primaryAction={drawerPrimary}
        secondaryActions={drawerSecondary}
        destructiveAction={drawerDestructive}
      >
        <WODrawerContent wo={woDetail ?? wo} />
      </DetailDrawer>

      {formOpen && <WOForm open={formOpen} onClose={() => setFormOpen(false)} />}
    </div>
  )
}
