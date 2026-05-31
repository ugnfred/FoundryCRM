import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Zap, Truck } from 'lucide-react'
import { invoicesApi, einvoiceApi } from '@/lib/api'
import { formatCurrency, formatDate, statusColor } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import { useToast } from '@/components/ui/toast'
import { useHasRole } from '@/hooks/useAuth'
import EWBModal from './EWBModal'

export default function EInvoice() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const canGenerate = useHasRole('admin', 'accounts')
  const [ewbInvoice, setEwbInvoice] = useState(null)
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: invoicesApi.list })

  const eligible = invoices.filter((i) => ['sent', 'paid', 'partially_paid'].includes(i.status))

  const irnMutation = useMutation({
    mutationFn: (id) => einvoiceApi.generate(id),
    onSuccess: () => { toast({ title: 'IRN Generated' }); qc.invalidateQueries(['invoices']) },
    onError: (e) => toast({ title: 'IRN Error', description: e.message, variant: 'destructive' }),
  })

  const columns = [
    { accessorKey: 'inv_no', header: 'Invoice #' },
    { accessorKey: 'companies.name', header: 'Customer' },
    { accessorKey: 'date', header: 'Date', cell: ({ getValue }) => formatDate(getValue()) },
    { accessorKey: 'total', header: 'Total', cell: ({ getValue }) => formatCurrency(getValue()) },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <Badge className={statusColor(getValue())}>{getValue()}</Badge> },
    {
      accessorKey: 'irn', header: 'IRN',
      cell: ({ getValue }) => getValue()
        ? <span className="text-xs text-green-700 font-mono">{String(getValue()).slice(0, 20)}…</span>
        : <span className="text-xs text-muted-foreground">Not generated</span>,
    },
    {
      accessorKey: 'ewb_no', header: 'EWB',
      cell: ({ getValue }) => getValue()
        ? <span className="text-xs text-blue-700 font-mono">{getValue()}</span>
        : <span className="text-xs text-muted-foreground">—</span>,
    },
    {
      id: 'actions', header: '',
      cell: ({ row }) => canGenerate && (
        <div className="flex gap-1">
          {!row.original.irn && (
            <Button size="sm" variant="outline" onClick={() => irnMutation.mutate(row.original.id)} disabled={irnMutation.isPending}>
              <Zap className="h-3 w-3 mr-1" />IRN
            </Button>
          )}
          {row.original.irn && !row.original.ewb_no && (
            <Button size="sm" variant="outline" onClick={() => setEwbInvoice(row.original)}>
              <Truck className="h-3 w-3 mr-1" />EWB
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
        E-Invoice is connected to NIC Sandbox. Switch <code>NIC_EINVOICE_BASE_URL</code> in <code>.env</code> to go live.
      </div>
      <p className="text-sm text-muted-foreground">{eligible.length} invoices eligible for e-invoicing</p>
      <DataTable columns={columns} data={eligible} searchPlaceholder="Search invoices…" emptyMessage="No invoices eligible for e-invoicing yet." />
      {ewbInvoice && <EWBModal open={!!ewbInvoice} onClose={() => setEwbInvoice(null)} invoice={ewbInvoice} />}
    </div>
  )
}
