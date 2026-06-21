import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { advanceReceiptsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import { DetailDrawer } from '@/components/shared/DetailDrawer'
import { Plus, XCircle, CheckCircle, Link2 } from 'lucide-react'
import ARForm from './ARForm'
import ARDrawerContent from './ARDrawerContent'
import { useToast } from '@/components/ui/toast'

const STATUS_COLORS = { received: 'default', pending: 'outline', applied: 'secondary', cancelled: 'destructive' }
const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })

export default function AdvanceReceipts() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(null)

  const { data: arList = [], isLoading } = useQuery({
    queryKey: ['advance-receipts'],
    queryFn: advanceReceiptsApi.list,
  })

  const { data: arDetail } = useQuery({
    queryKey: ['advance-receipt', selectedId],
    queryFn: () => advanceReceiptsApi.get(selectedId),
    enabled: !!selectedId,
    staleTime: 30_000,
  })

  const selectedAR = arDetail ?? arList.find(a => a.id === selectedId)

  const receiveMutation = useMutation({
    mutationFn: (id) => advanceReceiptsApi.receive(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['advance-receipts'] })
      qc.invalidateQueries({ queryKey: ['advance-receipt', selectedId] })
      toast({ title: 'PDC marked as received — ledger updated' })
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  const cancelMutation = useMutation({
    mutationFn: (id) => advanceReceiptsApi.cancel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['advance-receipts'] })
      qc.invalidateQueries({ queryKey: ['advance-receipt', selectedId] })
      toast({ title: 'Advance receipt cancelled' })
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  const columns = [
    { accessorKey: 'ar_no', header: 'AR No', cell: ({ getValue }) => <span className="font-mono font-semibold">{getValue()}</span> },
    { accessorKey: 'companies.name', header: 'Customer' },
    { accessorKey: 'date', header: 'Date' },
    { accessorKey: 'amount', header: 'Amount (₹)', cell: ({ getValue }) => <span className="font-mono text-green-700 font-semibold">₹{fmt(getValue())}</span> },
    { accessorKey: 'payment_mode', header: 'Mode', cell: ({ getValue }) => <span className="capitalize">{getValue()?.replace('_', ' ')}</span> },
    {
      accessorKey: 'is_pdc', header: 'PDC',
      cell: ({ row }) => row.original.is_pdc
        ? <Badge variant="outline" className="text-orange-600 border-orange-300">PDC {row.original.pdc_date}</Badge>
        : <span className="text-slate-400 text-xs">—</span>,
    },
    { accessorKey: 'reference', header: 'Reference', cell: ({ getValue }) => getValue() || '—' },
    {
      accessorKey: 'status', header: 'Status',
      cell: ({ getValue }) => <Badge variant={STATUS_COLORS[getValue()] || 'secondary'} className="capitalize">{getValue()}</Badge>,
    },
  ]

  const getRowClassName = (row) => {
    if (row.original.id === selectedId) return 'bg-primary/5 border-l-4 border-l-primary cursor-pointer'
    return 'hover:bg-gray-50 cursor-pointer'
  }

  const ar = selectedAR
  const status = ar?.status

  const drawerPrimary = status === 'pending' ? {
    label: 'Mark Received',
    icon: CheckCircle,
    onClick: () => {
      if (confirm(`Mark ${ar?.ar_no} as received? This will post the ledger entry.`)) {
        receiveMutation.mutate(selectedId)
      }
    },
    disabled: receiveMutation.isPending,
  } : undefined

  const drawerDestructive = ['received', 'pending'].includes(status ?? '') ? {
    label: 'Cancel',
    icon: XCircle,
    onClick: () => {
      if (confirm(`Cancel advance receipt ${ar?.ar_no}?${status === 'received' ? ' This will reverse the ledger entry.' : ''}`)) {
        cancelMutation.mutate(selectedId)
      }
    },
  } : undefined

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Advance Receipts</h1>
          <p className="text-slate-500 text-sm">Customer advance payments and PDCs — auto-posted to ledger</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />New Advance
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={arList}
        isLoading={isLoading}
        emptyMessage="No advance receipts yet"
        onRowClick={(row) => setSelectedId(row.original.id === selectedId ? null : row.original.id)}
        getRowClassName={getRowClassName}
      />

      <DetailDrawer
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        title={ar?.ar_no ?? '…'}
        subtitle={ar?.companies?.name}
        status={status}
        statusLabel={status}
        headerActions={[
          { icon: Link2, tooltip: 'Copy link', onClick: () => { navigator.clipboard.writeText(window.location.origin + '/advance-receipts?ar=' + selectedId); toast({ title: 'Link copied' }) } },
        ]}
        primaryAction={drawerPrimary}
        destructiveAction={drawerDestructive}
      >
        <ARDrawerContent ar={arDetail ?? ar} />
      </DetailDrawer>

      {formOpen && <ARForm open={formOpen} onClose={() => setFormOpen(false)} />}
    </div>
  )
}
