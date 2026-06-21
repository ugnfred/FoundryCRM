import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, PackageCheck, Link2 } from 'lucide-react'
import { purchaseOrdersApi } from '@/lib/api'
import { formatCurrency, formatDate, statusColor } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import { DetailDrawer } from '@/components/shared/DetailDrawer'
import { useHasRole } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/toast'
import POForm from './POForm'
import GRNForm from './GRNForm'
import PODrawerContent from './PODrawerContent'

export default function PurchaseOrders() {
  const { toast } = useToast()
  const canWrite = useHasRole('admin', 'accounts')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [grnPO, setGrnPO] = useState(null)
  const [selectedId, setSelectedId] = useState(null)

  const { data = [] } = useQuery({ queryKey: ['purchase-orders'], queryFn: purchaseOrdersApi.list })

  const { data: poDetail } = useQuery({
    queryKey: ['purchase-order', selectedId],
    queryFn: () => purchaseOrdersApi.get(selectedId),
    enabled: !!selectedId,
    staleTime: 30_000,
  })

  const selectedPO = poDetail ?? data.find(p => p.id === selectedId)

  const columns = [
    { accessorKey: 'po_no', header: 'PO #', cell: ({ getValue }) => <span className="font-mono font-semibold">{getValue()}</span> },
    { accessorKey: 'companies.name', header: 'Supplier' },
    { accessorKey: 'date', header: 'Date', cell: ({ getValue }) => formatDate(getValue()) },
    { accessorKey: 'delivery_date', header: 'Delivery', cell: ({ getValue }) => formatDate(getValue()) },
    { accessorKey: 'total', header: 'Total', cell: ({ getValue }) => formatCurrency(getValue()) },
    {
      id: 'received', header: 'Received',
      cell: ({ row }) => {
        const items = row.original.po_items ?? []
        if (!items.length) return <span className="text-muted-foreground text-xs">—</span>
        const ordered = items.reduce((s, i) => s + Number(i.qty ?? 0), 0)
        const received = items.reduce((s, i) => s + Number(i.received_qty ?? 0), 0)
        const pct = ordered > 0 ? Math.round((received / ordered) * 100) : 0
        return (
          <span className={`text-xs font-medium ${pct === 100 ? 'text-green-700' : pct > 0 ? 'text-amber-700' : 'text-muted-foreground'}`}>
            {received}/{ordered} ({pct}%)
          </span>
        )
      },
    },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <Badge className={statusColor(getValue())}>{getValue()}</Badge> },
  ]

  const getRowClassName = (row) => {
    if (row.original.id === selectedId) return 'bg-primary/5 border-l-4 border-l-primary cursor-pointer'
    return 'hover:bg-gray-50 cursor-pointer'
  }

  const po = selectedPO
  const status = po?.status

  const drawerPrimary = canWrite && ['sent', 'partial'].includes(status) ? {
    label: 'Create GRN',
    icon: PackageCheck,
    onClick: () => { setGrnPO(po); setSelectedId(null) },
  } : undefined

  const drawerSecondary = canWrite ? [
    { label: 'Edit', onClick: () => { setEditing(po); setOpen(true); setSelectedId(null) } },
  ] : []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{data.length} purchase orders</p>
        {canWrite && (
          <Button onClick={() => { setEditing(null); setOpen(true) }}>
            <Plus className="h-4 w-4 mr-1" /> New PO
          </Button>
        )}
      </div>
      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search POs…"
        emptyMessage="No purchase orders yet. Create your first PO to get started."
        onRowClick={(row) => setSelectedId(row.original.id === selectedId ? null : row.original.id)}
        getRowClassName={getRowClassName}
      />

      <DetailDrawer
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        title={po?.po_no ?? '…'}
        subtitle={po?.companies?.name}
        status={status}
        statusLabel={status}
        headerActions={[
          { icon: Link2, tooltip: 'Copy link', onClick: () => { navigator.clipboard.writeText(window.location.origin + '/purchase-orders?po=' + selectedId); toast({ title: 'Link copied' }) } },
        ]}
        primaryAction={drawerPrimary}
        secondaryActions={drawerSecondary}
      >
        <PODrawerContent po={poDetail ?? po} />
      </DetailDrawer>

      {open && <POForm open={open} onClose={() => setOpen(false)} existing={editing} />}
      {grnPO && <GRNForm open={!!grnPO} onClose={() => setGrnPO(null)} po={grnPO} />}
    </div>
  )
}
