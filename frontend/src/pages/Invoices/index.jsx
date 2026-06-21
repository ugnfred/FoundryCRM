import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, Download, CreditCard, FileMinus, Link2 } from 'lucide-react'
import { invoicesApi } from '@/lib/api'
import { formatCurrency, formatDate, statusColor } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import { DetailDrawer } from '@/components/shared/DetailDrawer'
import { useHasRole } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/toast'
import InvoiceForm from './InvoiceForm'
import PaymentModal from './PaymentModal'
import InvoiceDrawerContent from './InvoiceDrawerContent'
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
  const [selectedId, setSelectedId] = useState(null)

  const { data = [] } = useQuery({ queryKey: ['invoices'], queryFn: invoicesApi.list })

  const { data: invDetail } = useQuery({
    queryKey: ['invoice', selectedId],
    queryFn: () => invoicesApi.get(selectedId),
    enabled: !!selectedId,
    staleTime: 30_000,
  })

  const selectedInv = invDetail ?? data.find(i => i.id === selectedId)

  useEffect(() => {
    if (location.state?.fromSO) {
      setFromSO(location.state.fromSO)
      setEditing(null)
      setOpen(true)
    }
    if (location.state?.filterSONo) setSoFilter(location.state.filterSONo)
    if (location.state?.fromSO || location.state?.filterSONo) window.history.replaceState({}, '')
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

  function handleClose() { setOpen(false); setEditing(null); setFromSO(null) }

  const columns = [
    { accessorKey: 'inv_no', header: 'Invoice #', cell: ({ getValue }) => <span className="font-mono font-semibold">{getValue()}</span> },
    { accessorKey: 'companies.name', header: 'Customer' },
    {
      id: 'so_link', header: 'Sales Order',
      accessorFn: (row) => row.sales_orders?.so_no ?? '',
      cell: ({ row }) => {
        const so = row.original.sales_orders
        if (!so?.so_no) return <span className="text-muted-foreground">—</span>
        return (
          <button className="text-blue-600 hover:underline font-medium text-sm"
            onClick={(e) => { e.stopPropagation(); navigate('/sales-orders', { state: { highlightId: so.id } }) }}>
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
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); downloadPdf(row.original) }}>
          <Download className="h-3 w-3" />
        </Button>
      ),
    },
  ]

  const getRowClassName = (row) => {
    if (row.original.id === selectedId) return 'bg-primary/5 border-l-4 border-l-primary cursor-pointer'
    if (row.original.status === 'overdue') return 'bg-red-50 hover:bg-red-100 text-red-900 cursor-pointer'
    return 'hover:bg-gray-50 transition-colors cursor-pointer'
  }

  const inv = selectedInv
  const status = inv?.status

  const drawerPrimary = canPayment && status !== 'paid' && !['cancelled', 'draft'].includes(status ?? '') ? {
    label: 'Record Payment',
    icon: CreditCard,
    onClick: () => { setPayInvoice(inv); setSelectedId(null) },
  } : undefined

  const drawerSecondary = [
    canPayment && !['cancelled', 'draft'].includes(status ?? '') ? {
      label: 'Issue Credit Note',
      icon: FileMinus,
      onClick: () => { setCnInvoice(inv); setSelectedId(null) },
    } : null,
    canWrite ? { label: 'Edit', onClick: () => { setEditing(inv); setFromSO(null); setOpen(true); setSelectedId(null) } } : null,
  ].filter(Boolean)

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
        onRowClick={(row) => setSelectedId(row.original.id === selectedId ? null : row.original.id)}
      />

      <DetailDrawer
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        title={inv?.inv_no ?? '…'}
        subtitle={inv?.companies?.name}
        status={status}
        statusLabel={status}
        headerActions={[
          { icon: Download, tooltip: 'Download PDF', onClick: () => inv && downloadPdf(inv) },
          { icon: Link2, tooltip: 'Copy link', onClick: () => { navigator.clipboard.writeText(window.location.origin + '/invoices?inv=' + selectedId); toast({ title: 'Link copied' }) } },
        ]}
        primaryAction={drawerPrimary}
        secondaryActions={drawerSecondary}
      >
        <InvoiceDrawerContent inv={inv} />
      </DetailDrawer>

      {open && <InvoiceForm open={open} onClose={handleClose} existing={editing} fromSO={fromSO} />}
      {payInvoice && <PaymentModal open={!!payInvoice} onClose={() => setPayInvoice(null)} invoice={payInvoice} />}
      {cnInvoice && <CNForm open={!!cnInvoice} onClose={() => setCnInvoice(null)} linkedInvoice={cnInvoice} />}
    </div>
  )
}
