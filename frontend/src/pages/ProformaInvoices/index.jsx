import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { proformaApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import { DetailDrawer } from '@/components/shared/DetailDrawer'
import { Plus, Download, Send, ArrowRightCircle } from 'lucide-react'
import PIForm from './PIForm'
import PIDrawerContent from './PIDrawerContent'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

// Fetches full PI detail (with proforma_items) only when a row is selected
function usePIDetail(id) {
  return useQuery({
    queryKey: ['proforma', id],
    queryFn: () => proformaApi.get(id),
    enabled: !!id,
    staleTime: 30_000,
  })
}

const STATUS_COLORS = {
  draft: 'secondary',
  sent: 'default',
  converted: 'outline',
  cancelled: 'destructive',
}

const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function ProformaInvoices() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editPI, setEditPI] = useState(null)
  const [selectedId, setSelectedId] = useState(null)

  const { data: piList = [], isLoading } = useQuery({
    queryKey: ['proforma'],
    queryFn: proformaApi.list,
  })

  // Full detail (with line items) — fetched on demand when drawer opens
  const { data: piDetail, isLoading: detailLoading } = usePIDetail(selectedId)

  // Use full detail if available, fall back to list row for instant header render
  const listPI = useMemo(() => piList.find(p => p.id === selectedId), [piList, selectedId])
  const selectedPI = piDetail ?? listPI

  const convertMutation = useMutation({
    mutationFn: (id) => proformaApi.convert(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['proforma'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      toast({ title: `Converted to Invoice ${data.inv_no}` })
      setSelectedId(null)
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => proformaApi.updateStatus(id, status),
    onSuccess: (_, { status }) => {
      qc.invalidateQueries({ queryKey: ['proforma'] })
      if (status === 'cancelled') setSelectedId(null)
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  const handleDownload = async (id, piNo, e) => {
    if (e) e.stopPropagation()
    try {
      const blob = await proformaApi.downloadPdf(id)
      downloadBlob(blob, `PI-${piNo}.pdf`)
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const getRowClassName = (row) => cn(
    'transition-colors',
    row.original.id === selectedId
      ? 'bg-primary/5 border-l-4 border-l-primary'
      : 'hover:bg-gray-50 cursor-pointer'
  )

  const columns = useMemo(() => [
    {
      accessorKey: 'pi_no',
      header: 'PI No',
      cell: ({ getValue }) => <span className="font-mono font-semibold">{getValue()}</span>,
    },
    { accessorKey: 'companies.name', header: 'Customer' },
    { accessorKey: 'date', header: 'Date' },
    { accessorKey: 'validity_date', header: 'Valid Until', cell: ({ getValue }) => getValue() || '—' },
    {
      accessorKey: 'total',
      header: 'Total (₹)',
      cell: ({ getValue }) => <span className="font-mono">₹{fmt(getValue())}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => (
        <Badge variant={STATUS_COLORS[getValue()] || 'secondary'} className="capitalize">
          {getValue()}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          title="Download PDF"
          onClick={(e) => handleDownload(row.original.id, row.original.pi_no, e)}
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ], [selectedId])

  // Drawer actions
  const pi = selectedPI
  const drawerDestructive = pi?.status === 'draft' ? {
    label: 'Cancel',
    onClick: () => {
      if (confirm('Cancel this proforma invoice?')) {
        statusMutation.mutate({ id: pi.id, status: 'cancelled' })
      }
    },
  } : undefined

  const drawerSecondary = []
  if (pi?.status === 'draft') {
    drawerSecondary.push({
      label: 'Edit',
      onClick: () => { setEditPI(pi); setFormOpen(true) },
    })
    drawerSecondary.push({
      label: 'Send',
      icon: Send,
      onClick: () => statusMutation.mutate({ id: pi.id, status: 'sent' }),
      loading: statusMutation.isPending,
    })
  }

  const drawerPrimary = (pi?.status === 'draft' || pi?.status === 'sent') ? {
    label: 'Convert to Invoice',
    icon: ArrowRightCircle,
    onClick: () => {
      if (confirm(`Convert ${pi.pi_no} to Invoice? This cannot be undone.`)) {
        convertMutation.mutate(pi.id)
      }
    },
    loading: convertMutation.isPending,
  } : undefined

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Proforma Invoices</h1>
          <p className="text-slate-500 text-sm">Pre-sales quotation documents — not a tax invoice</p>
        </div>
        <Button onClick={() => { setEditPI(null); setFormOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" />New Proforma
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={piList}
        isLoading={isLoading}
        emptyMessage="No proforma invoices yet"
        searchPlaceholder="Search proforma invoices…"
        getRowClassName={getRowClassName}
        onRowClick={(row) => setSelectedId(
          row.original.id === selectedId ? null : row.original.id
        )}
      />

      <DetailDrawer
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        title={pi?.pi_no}
        subtitle={pi?.companies?.name}
        status={pi?.status}
        destructiveAction={drawerDestructive}
        secondaryActions={drawerSecondary}
        primaryAction={drawerPrimary}
        isLoading={detailLoading}
      >
        <PIDrawerContent pi={selectedPI} />
      </DetailDrawer>

      {formOpen && (
        <PIForm
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditPI(null) }}
          editPI={editPI}
        />
      )}
    </div>
  )
}
