import { useQuery } from '@tanstack/react-query'
import { Download, PackageCheck } from 'lucide-react'
import { grnsApi } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import { useToast } from '@/components/ui/toast'

export default function GRNs() {
  const { toast } = useToast()
  const { data = [] } = useQuery({ queryKey: ['grns'], queryFn: grnsApi.list })

  async function downloadPdf(grn) {
    try {
      const blob = await grnsApi.downloadPdf(grn.id)
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
      const a = document.createElement('a'); a.href = url; a.download = `${grn.grn_no}.pdf`; a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast({ title: 'PDF Error', description: e.message, variant: 'destructive' })
    }
  }

  const columns = [
    { accessorKey: 'grn_no', header: 'GRN #' },
    {
      id: 'po_no',
      header: 'PO #',
      accessorFn: (row) => row.purchase_orders?.po_no ?? '—',
      cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
    },
    {
      id: 'supplier',
      header: 'Supplier',
      accessorFn: (row) => row.purchase_orders?.companies?.name ?? '—',
    },
    {
      accessorKey: 'received_date',
      header: 'Received Date',
      cell: ({ getValue }) => formatDate(getValue()),
    },
    {
      accessorKey: 'notes',
      header: 'Notes',
      cell: ({ getValue }) => <span className="text-muted-foreground text-xs">{getValue() ?? '—'}</span>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button size="sm" variant="ghost" onClick={() => downloadPdf(row.original)}>
          <Download className="h-3 w-3 mr-1" /> PDF
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <PackageCheck className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{data.length} goods receipts</p>
      </div>
      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search GRNs…"
        emptyMessage="No goods receipt notes yet. Create a GRN from a Purchase Order."
      />
    </div>
  )
}
