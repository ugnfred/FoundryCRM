import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, Download, XCircle } from 'lucide-react'
import { creditNotesApi } from '@/lib/api'
import { formatCurrency, formatDate, statusColor } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import { useHasRole } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/toast'
import CNForm from './CNForm'

export default function CreditNotes() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const canWrite = useHasRole('admin', 'accounts')
  const isAdmin = useHasRole('admin')
  const [open, setOpen] = useState(false)
  const { data = [] } = useQuery({ queryKey: ['credit-notes'], queryFn: creditNotesApi.list })

  const cancelMutation = useMutation({
    mutationFn: (id) => creditNotesApi.cancel(id),
    onSuccess: () => { toast({ title: 'CN cancelled' }); qc.invalidateQueries(['credit-notes']); qc.invalidateQueries(['invoices']) },
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
    { accessorKey: 'cn_no', header: 'CN #' },
    { accessorKey: 'companies.name', header: 'Customer' },
    {
      id: 'invoice',
      header: 'Against Invoice',
      accessorFn: (row) => row.invoices?.inv_no ?? '—',
      cell: ({ getValue }) => <span className="text-sm font-medium">{getValue()}</span>,
    },
    { accessorKey: 'date', header: 'Date', cell: ({ getValue }) => formatDate(getValue()) },
    { accessorKey: 'total', header: 'Credit Amount', cell: ({ getValue }) => <span className="font-medium text-red-600">{formatCurrency(getValue())}</span> },
    { accessorKey: 'reason', header: 'Reason', cell: ({ getValue }) => <span className="text-muted-foreground text-xs">{getValue() ?? '—'}</span> },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => <Badge className={cnStatusColor(getValue())}>{getValue()}</Badge>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => downloadPdf(row.original)}>
            <Download className="h-3 w-3" />
          </Button>
          {isAdmin && row.original.status !== 'cancelled' && (
            <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700"
              onClick={() => { if (confirm(`Cancel ${row.original.cn_no}? This reverses the invoice adjustment.`)) cancelMutation.mutate(row.original.id) }}>
              <XCircle className="h-3 w-3" />
            </Button>
          )}
        </div>
      ),
    },
  ]

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
      />
      {open && <CNForm open={open} onClose={() => setOpen(false)} />}
    </div>
  )
}
