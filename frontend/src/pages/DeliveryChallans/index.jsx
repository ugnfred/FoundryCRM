import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { deliveryChallansApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import { Plus, Download, Truck, X } from 'lucide-react'
import DCForm from './DCForm'
import { useToast } from '@/components/ui/toast'

const STATUS_COLORS = { draft: 'secondary', dispatched: 'default', cancelled: 'destructive' }

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function DeliveryChallans() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editDC, setEditDC] = useState(null)

  const { data: dcList = [], isLoading } = useQuery({
    queryKey: ['delivery-challans'],
    queryFn: deliveryChallansApi.list,
  })

  const dispatchMutation = useMutation({
    mutationFn: (id) => deliveryChallansApi.dispatch(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delivery-challans'] })
      toast({ title: 'Challan marked as dispatched' })
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  const cancelMutation = useMutation({
    mutationFn: (id) => deliveryChallansApi.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['delivery-challans'] }),
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  const handleDownload = async (id, dcNo) => {
    try {
      const blob = await deliveryChallansApi.downloadPdf(id)
      downloadBlob(blob, `DC-${dcNo}.pdf`)
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const columns = [
    { accessorKey: 'dc_no', header: 'DC No', cell: ({ getValue }) => <span className="font-mono font-semibold">{getValue()}</span> },
    { accessorKey: 'companies.name', header: 'Customer' },
    { accessorKey: 'date', header: 'Date' },
    { accessorKey: 'sales_orders.so_no', header: 'SO Ref', cell: ({ getValue }) => getValue() || '—' },
    { accessorKey: 'vehicle_no', header: 'Vehicle No', cell: ({ getValue }) => getValue() || '—' },
    { accessorKey: 'transporter_name', header: 'Transporter', cell: ({ getValue }) => getValue() || '—' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => <Badge variant={STATUS_COLORS[getValue()] || 'secondary'} className="capitalize">{getValue()}</Badge>,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const dc = row.original
        return (
          <div className="flex gap-1 items-center">
            {dc.status === 'draft' && (
              <Button size="sm" variant="outline" onClick={() => { setEditDC(dc); setFormOpen(true) }}>Edit</Button>
            )}
            {dc.status === 'draft' && (
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => {
                  if (confirm('Mark as dispatched?')) dispatchMutation.mutate(dc.id)
                }}>
                <Truck className="h-3 w-3 mr-1" />Dispatch
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => handleDownload(dc.id, dc.dc_no)}>
              <Download className="h-3 w-3" />
            </Button>
            {dc.status === 'draft' && (
              <Button size="sm" variant="ghost" className="text-red-500 h-7 w-7 p-0"
                title="Cancel challan"
                onClick={() => {
                  if (confirm('Cancel this challan?')) cancelMutation.mutate(dc.id)
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
          <h1 className="text-2xl font-bold">Delivery Challans</h1>
          <p className="text-slate-500 text-sm">Dispatch documents — no pricing, for delivery use only</p>
        </div>
        <Button onClick={() => { setEditDC(null); setFormOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" />New Challan
        </Button>
      </div>

      <DataTable columns={columns} data={dcList} isLoading={isLoading} emptyMessage="No delivery challans yet" />

      {formOpen && (
        <DCForm open={formOpen} onClose={() => { setFormOpen(false); setEditDC(null) }} editDC={editDC} />
      )}
    </div>
  )
}

