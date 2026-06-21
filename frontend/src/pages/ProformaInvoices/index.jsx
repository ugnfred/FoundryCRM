import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { proformaApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import { Plus, ArrowRightCircle, Download, Send, X } from 'lucide-react'
import PIForm from './PIForm'
import { useToast } from '@/components/ui/toast'

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

  const { data: piList = [], isLoading } = useQuery({
    queryKey: ['proforma'],
    queryFn: proformaApi.list,
  })

  const convertMutation = useMutation({
    mutationFn: (id) => proformaApi.convert(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['proforma'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      toast({ title: `Converted to Invoice ${data.inv_no}` })
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => proformaApi.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proforma'] }),
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  const handleDownload = async (id, piNo) => {
    try {
      const blob = await proformaApi.downloadPdf(id)
      downloadBlob(blob, `PI-${piNo}.pdf`)
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const columns = [
    { accessorKey: 'pi_no', header: 'PI No', cell: ({ getValue }) => <span className="font-mono font-semibold">{getValue()}</span> },
    { accessorKey: 'companies.name', header: 'Customer' },
    { accessorKey: 'date', header: 'Date' },
    { accessorKey: 'validity_date', header: 'Valid Until', cell: ({ getValue }) => getValue() || 'â€”' },
    { accessorKey: 'total', header: 'Total (₹)', cell: ({ getValue }) => <span className="font-mono">₹{fmt(getValue())}</span> },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => <Badge variant={STATUS_COLORS[getValue()] || 'secondary'} className="capitalize">{getValue()}</Badge>,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const pi = row.original
        return (
          <div className="flex gap-1 items-center">
            {pi.status === 'draft' && (
              <Button size="sm" variant="outline" onClick={() => { setEditPI(pi); setFormOpen(true) }}>
                Edit
              </Button>
            )}
            {pi.status === 'draft' && (
              <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ id: pi.id, status: 'sent' })}>
                <Send className="h-3 w-3 mr-1" />Send
              </Button>
            )}
            {(pi.status === 'draft' || pi.status === 'sent') && (
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => {
                  if (confirm(`Convert PI ${pi.pi_no} to Invoice? This cannot be undone.`)) {
                    convertMutation.mutate(pi.id)
                  }
                }}
              >
                <ArrowRightCircle className="h-3 w-3 mr-1" />Convert
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => handleDownload(pi.id, pi.pi_no)}>
              <Download className="h-3 w-3" />
            </Button>
            {pi.status === 'draft' && (
              <Button size="sm" variant="ghost" className="text-red-500 h-7 w-7 p-0"
                title="Cancel proforma"
                onClick={() => {
                  if (confirm('Cancel this proforma invoice?')) {
                    statusMutation.mutate({ id: pi.id, status: 'cancelled' })
                  }
                }}>
                <X className="h-3.5 w-3.5" />
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
        <div>
          <h1 className="text-2xl font-bold">Proforma Invoices</h1>
          <p className="text-slate-500 text-sm">Pre-sales quotation documents â€” not a tax invoice</p>
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
      />

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

