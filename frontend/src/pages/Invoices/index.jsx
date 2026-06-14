import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, Download, CreditCard, FileMinus } from 'lucide-react'
import { invoicesApi } from '@/lib/api'
import { formatCurrency, formatDate, statusColor } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import { useHasRole } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/toast'
import InvoiceForm from './InvoiceForm'
import PaymentModal from './PaymentModal'
import CNForm from '@/pages/CreditNotes/CNForm'

export default function Invoices() {
  const location = useLocation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const canWrite = useHasRole('admin', 'sales', 'accounts')
  const canPayment = useHasRole('admin', 'accounts')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [fromSO, setFromSO] = useState(null)
  const [payInvoice, setPayInvoice] = useState(null)
  const [cnInvoice, setCnInvoice] = useState(null)
  const [soFilter, setSoFilter] = useState('')
  const { data = [] } = useQuery({ queryKey: ['invoices'], queryFn: invoicesApi.list })

  // Auto-open invoice form pre-filled when navigated from Sales Orders
  // Also capture SO filter when navigated from SO list
  useEffect(() => {
    if (location.state?.fromSO) {
      setFromSO(location.state.fromSO)
      setEditing(null)
      setOpen(true)
    }
    if (location.state?.filterSONo) {
      setSoFilter(location.state.filterSONo)
    }
    if (location.state?.fromSO || location.state?.filterSONo) {
      window.history.replaceState({}, '')
    }
  }, [location.state])

  async function downloadPdf(inv) {
    try {
      const blob = await invoicesApi.downloadPdf(inv.id)
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
      const a = document.createElement('a'); a.href = url; a.download = `${inv.inv_no}.pdf`; a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast({ title: 'PDF Error', description: e.message, variant: 'destructive' })
    }
  }

  function handleClose() {
    setOpen(false)
    setEditing(null)
    setFromSO(null)
  }

  const columns = [
    { accessorKey: 'inv_no', header: 'Invoice #' },
    { accessorKey: 'companies.name', header: 'Customer' },
    {
      id: 'so_link',
      header: 'Sales Order',
      accessorFn: (row) => row.sales_orders?.so_no ?? '',
      cell: ({ row }) => {
        const so = row.original.sales_orders
        if (!so?.so_no) return <span className="text-muted-foreground">—</span>
        return (
          <button
            className="text-blue-600 hover:underline font-medium text-sm"
            onClick={() => navigate('/sales-orders', { state: { highlightId: so.id } })}
          >
            {so.so_no}
          </button>
        )
      },
    },
    { accessorKey: 'date', header: 'Date', cell: ({ getValue }) => formatDate(getValue()) },
    { accessorKey: 'due_date', header: 'Due', cell: ({ getValue }) => formatDate(getValue()) },
    { accessorKey: 'total', header: 'Total', cell: ({ getValue }) => formatCurrency(getValue()) },
    { accessorKey: 'balance_due', header: 'Balance', cell: ({ getValue }) => formatCurrency(getValue()) },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <Badge className={statusColor(getValue())}>{getValue()}</Badge> },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <div className="flex gap-1">
          {canWrite && <Button size="sm" variant="ghost" onClick={() => { setEditing(row.original); setFromSO(null); setOpen(true) }}>Edit</Button>}
          {canPayment && row.original.status !== 'paid' && (
            <Button size="sm" variant="outline" onClick={() => setPayInvoice(row.original)}>
              <CreditCard className="h-3 w-3 mr-1" /> Pay
            </Button>
          )}
          {canPayment && !['cancelled','draft'].includes(row.original.status) && (
            <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50"
              onClick={() => setCnInvoice(row.original)}>
              <FileMinus className="h-3 w-3 mr-1" /> CN
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => downloadPdf(row.original)}>
            <Download className="h-3 w-3" />
          </Button>
        </div>
      ),
    },
  ]

  const getRowClassName = (row) =>
    row.original.status === 'overdue'
      ? 'bg-red-50 hover:bg-red-100 text-red-900'
      : 'hover:bg-gray-50 transition-colors'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{data.length} invoices</p>
        {canWrite && (
          <Button onClick={() => { setEditing(null); setFromSO(null); setOpen(true) }}>
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
        defaultFilter={soFilter}
      />
      {open && <InvoiceForm open={open} onClose={handleClose} existing={editing} fromSO={fromSO} />}
      {payInvoice && <PaymentModal open={!!payInvoice} onClose={() => setPayInvoice(null)} invoice={payInvoice} />}
      {cnInvoice && <CNForm open={!!cnInvoice} onClose={() => setCnInvoice(null)} linkedInvoice={cnInvoice} />}
    </div>
  )
}
