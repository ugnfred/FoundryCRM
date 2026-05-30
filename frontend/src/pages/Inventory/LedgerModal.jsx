import { useQuery } from '@tanstack/react-query'
import { inventoryApi } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/components/ui/dialog'

export default function LedgerModal({ open, onClose, product }) {
  const { data = [] } = useQuery({
    queryKey: ['ledger', product.id],
    queryFn: () => inventoryApi.ledger(product.id),
  })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Stock Ledger — {product.name}</DialogTitle></DialogHeader>
        <DialogBody>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{['Date', 'Type', 'Qty', 'Ref', 'Balance'].map((h) => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {data.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">{formatDate(row.created_at)}</td>
                  <td className="px-3 py-2 capitalize">{row.txn_type}</td>
                  <td className={`px-3 py-2 font-medium ${Number(row.qty) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {Number(row.qty) > 0 ? '+' : ''}{Number(row.qty).toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">{row.ref_type}</td>
                  <td className="px-3 py-2 font-semibold">{Number(row.balance).toLocaleString('en-IN', { maximumFractionDigits: 3 })}</td>
                </tr>
              ))}
              {data.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">No transactions yet.</td></tr>}
            </tbody>
          </table>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
