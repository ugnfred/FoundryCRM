import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { workOrdersApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import { Plus, CheckCircle, X } from 'lucide-react'
import WOForm from './WOForm'
import WODetail from './WODetail'
import { useToast } from '@/components/ui/toast'

const STATUS_COLORS = { open: 'secondary', in_progress: 'default', done: 'outline', cancelled: 'destructive' }
const STATUS_LABELS = { open: 'Open', in_progress: 'In Progress', done: 'Done', cancelled: 'Cancelled' }

export default function WorkOrders() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [detailId, setDetailId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')

  const { data: woList = [], isLoading } = useQuery({
    queryKey: ['work-orders', statusFilter],
    queryFn: () => workOrdersApi.list(statusFilter || undefined),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => workOrdersApi.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['work-orders'] }),
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  const completeMutation = useMutation({
    mutationFn: (id) => workOrdersApi.complete(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['work-orders'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      toast({ title: `${data.wo_no} completed — stock updated` })
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  const columns = [
    { accessorKey: 'wo_no', header: 'WO No', cell: ({ row, getValue }) =>
      <button className="font-mono font-semibold text-blue-600 hover:underline" onClick={() => setDetailId(row.original.id)}>{getValue()}</button> },
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
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => (
        <Badge variant={STATUS_COLORS[getValue()] || 'secondary'}>{STATUS_LABELS[getValue()] || getValue()}</Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const wo = row.original
        return (
          <div className="flex gap-1 items-center">
            {wo.status === 'open' && (
              <Button size="sm" variant="outline"
                onClick={() => statusMutation.mutate({ id: wo.id, status: 'in_progress' })}>
                Start
              </Button>
            )}
            {(wo.status === 'open' || wo.status === 'in_progress') && (
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => {
                  if (confirm(`Complete WO ${wo.wo_no}? This will update stock levels.`)) {
                    completeMutation.mutate(wo.id)
                  }
                }}
              >
                <CheckCircle className="h-3 w-3 mr-1" />Complete
              </Button>
            )}
            {wo.status === 'open' && (
              <Button size="sm" variant="ghost" className="text-red-500 h-7 w-7 p-0"
                title="Cancel work order"
                onClick={() => {
                  if (confirm('Cancel this work order?')) {
                    statusMutation.mutate({ id: wo.id, status: 'cancelled' })
                  }
                }}>
                <X className="h-3.5 w-3.5" />
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
        <div>
          <h1 className="text-2xl font-bold">Work Orders</h1>
          <p className="text-slate-500 text-sm">Manufacturing jobs — linked to BOM, drives stock on completion</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />New Work Order
        </Button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2">
        {['', 'open', 'in_progress', 'done', 'cancelled'].map(s => (
          <Button key={s} size="sm" variant={statusFilter === s ? 'default' : 'outline'}
            onClick={() => setStatusFilter(s)}>
            {s === '' ? 'All' : STATUS_LABELS[s] || s}
          </Button>
        ))}
      </div>

      <DataTable columns={columns} data={woList} isLoading={isLoading} emptyMessage="No work orders yet" />

      {formOpen && <WOForm open={formOpen} onClose={() => setFormOpen(false)} />}
      {detailId && <WODetail woId={detailId} onClose={() => setDetailId(null)} onComplete={() => completeMutation.mutate(detailId)} />}
    </div>
  )
}

