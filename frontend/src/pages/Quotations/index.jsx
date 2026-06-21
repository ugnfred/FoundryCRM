import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, ArrowRightCircle, Send, ThumbsUp, ThumbsDown, Download, Link2 } from 'lucide-react'
import { quotationsApi } from '@/lib/api'
import { formatCurrency, formatDate, statusColor } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import { DetailDrawer } from '@/components/shared/DetailDrawer'
import { useToast } from '@/components/ui/toast'
import { useHasRole } from '@/hooks/useAuth'
import QuotationForm from './QuotationForm'
import QuotationDrawerContent from './QuotationDrawerContent'

export default function Quotations() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const canWrite = useHasRole('admin', 'sales')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [selectedId, setSelectedId] = useState(null)

  const { data = [] } = useQuery({ queryKey: ['quotations'], queryFn: quotationsApi.list })

  const { data: quotDetail } = useQuery({
    queryKey: ['quotation', selectedId],
    queryFn: () => quotationsApi.get(selectedId),
    enabled: !!selectedId,
    staleTime: 30_000,
  })

  const selectedQuot = quotDetail ?? data.find(q => q.id === selectedId)

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => quotationsApi.updateStatus(id, status),
    onSuccess: (_, { status }) => {
      toast({ title: `Marked as ${status}` })
      qc.invalidateQueries(['quotations'])
      qc.invalidateQueries(['quotation', selectedId])
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  const convertMutation = useMutation({
    mutationFn: (id) => quotationsApi.convertToSO(id),
    onSuccess: (res) => {
      toast({ title: 'Converted', description: `Sales Order ${res.so_no} created.` })
      qc.invalidateQueries(['quotations'])
      qc.invalidateQueries(['orders'])
      setSelectedId(null)
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  async function downloadPdf(quot) {
    try {
      const blob = await quotationsApi.downloadPdf(quot.id)
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
      const a = document.createElement('a'); a.href = url; a.download = `${quot.quot_no}.pdf`; a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const columns = [
    { accessorKey: 'quot_no', header: 'Quot #', cell: ({ getValue }) => <span className="font-mono font-semibold">{getValue()}</span> },
    { accessorKey: 'companies.name', header: 'Customer' },
    { accessorKey: 'date', header: 'Date', cell: ({ getValue }) => formatDate(getValue()) },
    { accessorKey: 'valid_until', header: 'Valid Until', cell: ({ getValue }) => formatDate(getValue()) },
    { accessorKey: 'total', header: 'Total', cell: ({ getValue }) => formatCurrency(getValue()) },
    {
      accessorKey: 'status', header: 'Status',
      cell: ({ getValue }) => <Badge className={statusColor(getValue())}>{getValue()}</Badge>,
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

  const q = selectedQuot
  const status = q?.status

  const drawerPrimary = canWrite && ['sent', 'accepted'].includes(status) ? {
    label: convertMutation.isPending ? 'Converting…' : 'Convert to SO',
    icon: ArrowRightCircle,
    onClick: () => convertMutation.mutate(selectedId),
    disabled: convertMutation.isPending,
  } : undefined

  const drawerSecondary = canWrite ? [
    status === 'draft' ? { label: 'Send', icon: Send, onClick: () => statusMutation.mutate({ id: selectedId, status: 'sent' }) } : null,
    status === 'sent' ? { label: 'Accept', icon: ThumbsUp, onClick: () => statusMutation.mutate({ id: selectedId, status: 'accepted' }) } : null,
    status === 'sent' ? { label: 'Mark Lost', icon: ThumbsDown, onClick: () => statusMutation.mutate({ id: selectedId, status: 'lost' }) } : null,
    ['draft', 'sent'].includes(status) ? { label: 'Edit', onClick: () => { setEditing(q); setOpen(true); setSelectedId(null) } } : null,
  ].filter(Boolean) : []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{data.length} quotations</p>
        {canWrite && (
          <Button onClick={() => { setEditing(null); setOpen(true) }}>
            <Plus className="h-4 w-4 mr-1" /> New Quotation
          </Button>
        )}
      </div>
      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search quotations…"
        emptyMessage="No quotations yet. Create your first quotation to get started."
        onRowClick={(row) => setSelectedId(row.original.id === selectedId ? null : row.original.id)}
        getRowClassName={getRowClassName}
      />

      <DetailDrawer
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        title={q?.quot_no ?? '…'}
        subtitle={q?.companies?.name}
        status={status}
        statusLabel={status}
        headerActions={[
          { icon: Download, tooltip: 'Download PDF', onClick: () => q && downloadPdf(q) },
          { icon: Link2, tooltip: 'Copy link', onClick: () => { navigator.clipboard.writeText(window.location.origin + '/quotations?q=' + selectedId); toast({ title: 'Link copied' }) } },
        ]}
        primaryAction={drawerPrimary}
        secondaryActions={drawerSecondary}
      >
        <QuotationDrawerContent quot={q} />
      </DetailDrawer>

      {open && <QuotationForm open={open} onClose={() => { setOpen(false); setEditing(null) }} existing={editing} />}
    </div>
  )
}
