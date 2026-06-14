import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { advanceReceiptsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import { Plus, XCircle } from 'lucide-react'
import ARForm from './ARForm'
import { useToast } from '@/components/ui/toast'

const STATUS_COLORS = { received: 'default', applied: 'secondary', cancelled: 'destructive' }
const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })

export default function AdvanceReceipts() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)

  const { data: arList = [], isLoading } = useQuery({
    queryKey: ['advance-receipts'],
    queryFn: advanceReceiptsApi.list,
  })

  const cancelMutation = useMutation({
    mutationFn: (id) => advanceReceiptsApi.cancel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['advance-receipts'] })
      toast({ title: 'Advance receipt cancelled' })
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  const columns = [
    { accessorKey: 'ar_no', header: 'AR No', cell: ({ getValue }) => <span className="font-mono font-semibold">{getValue()}</span> },
    { accessorKey: 'companies.name', header: 'Customer' },
    { accessorKey: 'date', header: 'Date' },
    { accessorKey: 'amount', header: 'Amount (â‚¹)', cell: ({ getValue }) => <span className="font-mono text-green-700 font-semibold">â‚¹{fmt(getValue())}</span> },
    { accessorKey: 'payment_mode', header: 'Mode', cell: ({ getValue }) => <span className="capitalize">{getValue()?.replace('_', ' ')}</span> },
    {
      accessorKey: 'is_pdc',
      header: 'PDC',
      cell: ({ row }) => row.original.is_pdc
        ? <Badge variant="outline" className="text-orange-600 border-orange-300">PDC {row.original.pdc_date}</Badge>
        : <span className="text-slate-400 text-xs">â€”</span>,
    },
    { accessorKey: 'reference', header: 'Reference', cell: ({ getValue }) => getValue() || 'â€”' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => <Badge variant={STATUS_COLORS[getValue()] || 'secondary'} className="capitalize">{getValue()}</Badge>,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const ar = row.original
        return ar.status === 'received' ? (
          <Button size="sm" variant="outline" className="text-red-600"
            onClick={() => {
              if (confirm(`Cancel advance receipt ${ar.ar_no}? This will reverse the ledger entry.`)) {
                cancelMutation.mutate(ar.id)
              }
            }}>
            <XCircle className="h-3 w-3 mr-1" />Cancel
          </Button>
        ) : null
      },
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Advance Receipts</h1>
          <p className="text-slate-500 text-sm">Customer advance payments and PDCs â€” auto-posted to ledger</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />New Advance
        </Button>
      </div>
      <DataTable columns={columns} data={arList} isLoading={isLoading} emptyMessage="No advance receipts yet" />
      {formOpen && <ARForm open={formOpen} onClose={() => setFormOpen(false)} />}
    </div>
  )
}

