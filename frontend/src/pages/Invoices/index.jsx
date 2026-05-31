import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Plus, Download, CreditCard } from 'lucide-react'
import { invoicesApi } from '@/lib/api'
import { formatCurrency, formatDate, statusColor } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import { useHasRole } from '@/hooks/useAuth'
import InvoiceForm from './InvoiceForm'
import PaymentModal from './PaymentModal'

export default function Invoices() {
  const qc = useQueryClient()
  const canWrite = useHasRole('admin', 'sales', 'accounts')
  const canPayment = useHasRole('admin', 'accounts')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [payInvoice, setPayInvoice] = useState(null)
  const { data = [] } = useQuery({ queryKey: ['invoices'], queryFn: invoicesApi.list })

  // Fire-and-forget: mark overdue invoices silently on load
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    const overdueList = data.filter(
      (inv) => ['sent', 'partially_paid'].includes(inv.status) && inv.due_date && inv.due_date < today
    )
    overdueList.forEach((inv) => {
      invoicesApi.update(inv.id, { ...inv, status: 'overdue' }).then(() => {
        qc.invalidateQueries(['invoices'])
      }).catch(() => {})
    })
  }, [data])

  async function downloadPdf(inv) {
    const blob = await invoicesApi.downloadPdf(inv.id)
    const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
    const a = document.createElement('a'); a.href = url; a.download = `${inv.inv_no}.pdf`; a.click()
    URL.revokeObjectURL(url)
  }

  const columns = [
    { accessorKey: 'inv_no', header: 'Invoice #' },
    { accessorKey: 'companies.name', header: 'Customer' },
    { accessorKey: 'date', header: 'Date', cell: ({ getValue }) => formatDate(getValue()) },
    { accessorKey: 'due_date', header: 'Due', cell: ({ getValue }) => formatDate(getValue()) },
    { accessorKey: 'total', header: 'Total', cell: ({ getValue }) => formatCurrency(getValue()) },
    { accessorKey: 'balance_due', header: 'Balance', cell: ({ getValue }) => formatCurrency(getValue()) },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <Badge className={statusColor(getValue())}>{getValue()}</Badge> },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <div className="flex gap-1">
          {canWrite && <Button size="sm" variant="ghost" onClick={() => { setEditing(row.original); setOpen(true) }}>Edit</Button>}
          {canPayment && row.original.status !== 'paid' && (
            <Button size="sm" variant="outline" onClick={() => setPayInvoice(row.original)}>
              <CreditCard className="h-3 w-3 mr-1" /> Pay
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => downloadPdf(row.original)}>
            <Download className="h-3 w-3" />
          </Button>
        </div>
      ),
    },
  ]

  // Custom row className for overdue highlighting
  const getRowClassName = (row) =>
    row.original.status === 'overdue' ? 'bg-red-50 hover:bg-red-100 text-red-900' : 'hover:bg-gray-50 transition-colors'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{data.length} invoices</p>
        {canWrite && (
          <Button onClick={() => { setEditing(null); setOpen(true) }}>
            <Plus className="h-4 w-4 mr-1" /> New Invoice
          </Button>
        )}
      </div>
      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search invoices…"
        emptyMessage="No invoices yet. Create your first invoice to get started."
        getRowClassName={getRowClassName}
      />
      {open && <InvoiceForm open={open} onClose={() => setOpen(false)} existing={editing} />}
      {payInvoice && <PaymentModal open={!!payInvoice} onClose={() => setPayInvoice(null)} invoice={payInvoice} />}
    </div>
  )
}
