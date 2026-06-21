import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, Download, XCircle, Link2 } from 'lucide-react'
import { creditNotesApi } from '@/lib/api'
import { formatCurrency, formatDate, statusColor } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import { DetailDrawer } from '@/components/shared/DetailDrawer'
import { useHasRole } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/toast'
import CNForm from './CNForm'
import CNDrawerContent from './CNDrawerContent'

export default function CreditNotes() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const canWrite = useHasRole('admin', 'accounts')
  const isAdmin = useHasRole('admin')
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(null)

  const { data = [] } = useQuery({ queryKey: ['credit-notes'], queryFn: creditNotesApi.list })

  const { data: cnDetail } = useQuery({
    queryKey: ['credit-note', selectedId],
    queryFn: () => creditNotesApi.get(selectedId),
    enabled: !!selectedId,
    staleTime: 30_000,
  })

  const selectedCN = cnDetail ?? data.find(c => c.id === selectedId)

  const cancelMutation = useMutation({
    mutationFn: (id) => creditNotesApi.cancel(id),
    onSuccess: () => {
      toast({ title: 'CN cancelled' })
      qc.invalidateQueries(['credit-notes'])
      qc.invalidateQueries(['invoices'])
      qc.invalidateQueries(['credit-note', selectedId])
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  async function downloadPdf(cn) {
    try {
      const blob = await creditNotesApi.downloadPdf(cn.id)
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
      const a = document.createElement('a'); a.href = url; a.download = `${cn.cn_no}.pdf`; a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast({ title: 'PDF Error', description: e.message, variant: 'destructive' })
    }
  }

  const cnStatusColor = (s) => {
    if (s === 'issued') return 'bg-green-100 text-green-700'
    if (s === 'cancelled') return 'bg-gray-100 text-gray-500'
    return 'bg-yellow-100 text-yellow-700'
  }

  const columns = [
    { accessorKey: 'cn_no', header: 'CN #', cell: ({ getValue }) => <span className="font-mono font-semibold">{getValue()}</span> },
    { accessorKey: 'companies.name', header: 'Customer' },
    {
      id: 'invoice', header: 'Against Invoice',
      accessorFn: (row) => row.invoices?.inv_no ?? '—',
      cell: ({ getValue }) => <span className="text-sm font-medium">{getValue()}</span>,
    },
    { accessorKey: 'date', header: 'Date', cell: ({ getValue }) => formatDate(getValue()) },
    { accessorKey: 'total', header: 'Credit Amount', cell: ({ getValue }) => <span className="font-medium text-red-600">{formatCurrency(getValue())}</span> },
    { accessorKey: 'reason', header: 'Reason', cell: ({ getValue }) => <span className="text-muted-foreground text-xs">{getValue() ?? '—'}</span> },
    {
      accessorKey: 'status', header: 'Status',
      cell: ({ getValue }) => <Badge className={cnStatusColor(getValue())}>{getValue()}</Badge>,
    },
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
    if (row.original.id === selectedId) return 'bg-primary/5 border-l-4 border-l-primary cursor-pointer'
    return 'hover:bg-gray-50 cursor-pointer'
  }

  const cn = selectedCN
  const status = cn?.status

  const drawerDestructive = isAdmin && status !== 'cancelled' ? {
    label: 'Cancel CN',
    icon: XCircle,
    onClick: () => {
      if (confirm(`Cancel ${cn?.cn_no}? This reverses the invoice adjustment.`)) cancelMutation.mutate(selectedId)
    },
  } : undefined

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{data.length} credit notes</p>
        {canWrite && (
          <Button className="bg-red-600 hover:bg-red-700" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Credit Note
          </Button>
        )}
      </div>
      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search credit notes…"
        emptyMessage="No credit notes yet. Issue one from an Invoice or from here."
        onRowClick={(row) => setSelectedId(row.original.id === selectedId ? null : row.original.id)}
        getRowClassName={getRowClassName}
      />

      <DetailDrawer
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        title={cn?.cn_no ?? '…'}
        subtitle={cn?.companies?.name}
        status={status}
        statusLabel={status}
        headerActions={[
          { icon: Download, tooltip: 'Download PDF', onClick: () => cn && downloadPdf(cn) },
          { icon: Link2, tooltip: 'Copy link', onClick: () => { navigator.clipboard.writeText(window.location.origin + '/credit-notes?cn=' + selectedId); toast({ title: 'Link copied' }) } },
        ]}
        destructiveAction={drawerDestructive}
      >
        <CNDrawerContent cn={cnDetail ?? cn} />
      </DetailDrawer>

      {open && <CNForm open={open} onClose={() => setOpen(false)} />}
    </div>
  )
}
