import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, ArrowRightCircle } from 'lucide-react'
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

  const { data = [], isLoading } = useQuery({ queryKey: ['quotations'], queryFn: quotationsApi.list })

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
      cell: ({ getValue }) => (
        <Badge className={statusColor(getValue())}>{getValue()}</Badge>
      ),
    },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <div className="flex gap-2">
          {canWrite && (
            <>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(row.original); setOpen(true) }}>Edit</Button>
              {['sent', 'accepted'].includes(row.original.status) && (
                <Button size="sm" variant="outline" onClick={() => convertMutation.mutate(row.original.id)}>
                  <ArrowRightCircle className="h-3 w-3 mr-1" /> To SO
                </Button>
              )}
            </>
          )}
        </div>
      ),
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
      <DataTable columns={columns} data={data} searchPlaceholder="Search quotations…" />
      {open && <QuotationForm open={open} onClose={() => setOpen(false)} existing={editing} />}
    </div>
  )
}
