import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Download, PackageCheck, Link2 } from 'lucide-react'
import { grnsApi } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/shared/DataTable'
import { DetailDrawer } from '@/components/shared/DetailDrawer'
import { useToast } from '@/components/ui/toast'
import GRNDrawerContent from './GRNDrawerContent'

export default function GRNs() {
  const { toast } = useToast()
  const { data = [] } = useQuery({ queryKey: ['grns'], queryFn: grnsApi.list })
  const [selectedId, setSelectedId] = useState(null)

  const { data: grnDetail } = useQuery({
    queryKey: ['grn', selectedId],
    queryFn: () => grnsApi.get(selectedId),
    enabled: !!selectedId,
    staleTime: 30_000,
  })

  const selectedGRN = grnDetail ?? data.find(g => g.id === selectedId)

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
    { accessorKey: 'grn_no', header: 'GRN #', cell: ({ getValue }) => <span className="font-mono font-semibold">{getValue()}</span> },
    {
      id: 'po_no', header: 'PO #',
      accessorFn: (row) => row.purchase_orders?.po_no ?? '—',
      cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
    },
    {
      id: 'supplier', header: 'Supplier',
      accessorFn: (row) => row.purchase_orders?.companies?.name ?? '—',
    },
    { accessorKey: 'received_date', header: 'Received Date', cell: ({ getValue }) => formatDate(getValue()) },
    { accessorKey: 'notes', header: 'Notes', cell: ({ getValue }) => <span className="text-muted-foreground text-xs">{getValue() ?? '—'}</span> },
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

  const grn = selectedGRN

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
        onRowClick={(row) => setSelectedId(row.original.id === selectedId ? null : row.original.id)}
        getRowClassName={getRowClassName}
      />

      <DetailDrawer
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        title={grn?.grn_no ?? '…'}
        subtitle={grn?.purchase_orders?.companies?.name}
        headerActions={[
          { icon: Download, tooltip: 'Download PDF', onClick: () => grn && downloadPdf(grn) },
          { icon: Link2, tooltip: 'Copy link', onClick: () => { navigator.clipboard.writeText(window.location.origin + '/grns?grn=' + selectedId); toast({ title: 'Link copied' }) } },
        ]}
      >
        <GRNDrawerContent grn={grnDetail ?? grn} />
      </DetailDrawer>
    </div>
  )
}
