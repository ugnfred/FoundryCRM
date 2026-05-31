import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, ArrowRightCircle, Send, ThumbsUp, ThumbsDown } from 'lucide-react'
import { quotationsApi } from '@/lib/api'
import { formatCurrency, formatDate, statusColor } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import { useToast } from '@/components/ui/toast'
import { useHasRole } from '@/hooks/useAuth'
import QuotationForm from './QuotationForm'

export default function Quotations() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const canWrite = useHasRole('admin', 'sales')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  const { data = [] } = useQuery({ queryKey: ['quotations'], queryFn: quotationsApi.list })

  const statusMutation = useMutation({
    mutationFn: ({ id, row, status }) => quotationsApi.update(id, { ...row, status }),
    onSuccess: (_, { status }) => {
      toast({ title: `Marked as ${status}` })
      qc.invalidateQueries(['quotations'])
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  const convertMutation = useMutation({
    mutationFn: (id) => quotationsApi.convertToSO(id),
    onSuccess: (res) => {
      toast({ title: 'Converted', description: `Sales Order ${res.so_no} created.` })
      qc.invalidateQueries(['quotations'])
      qc.invalidateQueries(['orders'])
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  const columns = [
    { accessorKey: 'quot_no', header: 'Quot #' },
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
      cell: ({ row }) => {
        if (!canWrite) return null
        const { id, status } = row.original
        return (
          <div className="flex gap-1 flex-wrap">
            <Button size="sm" variant="ghost" onClick={() => { setEditing(row.original); setOpen(true) }}>Edit</Button>

            {status === 'draft' && (
              <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ id, row: row.original, status: 'sent' })}>
                <Send className="h-3 w-3 mr-1" />Send
              </Button>
            )}
            {status === 'sent' && (
              <>
                <Button size="sm" variant="outline" className="text-green-700 border-green-300" onClick={() => statusMutation.mutate({ id, row: row.original, status: 'accepted' })}>
                  <ThumbsUp className="h-3 w-3 mr-1" />Accept
                </Button>
                <Button size="sm" variant="outline" className="text-red-700 border-red-300" onClick={() => statusMutation.mutate({ id, row: row.original, status: 'rejected' })}>
                  <ThumbsDown className="h-3 w-3 mr-1" />Lost
                </Button>
              </>
            )}
            {['sent', 'accepted'].includes(status) && (
              <Button size="sm" variant="outline" onClick={() => convertMutation.mutate(id)}>
                <ArrowRightCircle className="h-3 w-3 mr-1" />To SO
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
      />
      {open && <QuotationForm open={open} onClose={() => setOpen(false)} existing={editing} />}
    </div>
  )
}
