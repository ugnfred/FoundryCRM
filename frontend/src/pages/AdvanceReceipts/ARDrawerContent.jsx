import { DrawerSection, DrawerFields } from '@/components/shared/DetailDrawer'
import { Building2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })

export default function ARDrawerContent({ ar }) {
  if (!ar) return null
  const company = ar.companies

  return (
    <>
      {company && (
        <DrawerSection title="Customer">
          <div className="flex items-start gap-3 rounded-lg border bg-slate-50 px-4 py-3">
            <Building2 className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-slate-800">{company.name}</p>
              {company.gstin && <p className="text-slate-500 text-xs mt-0.5">GSTIN: {company.gstin}</p>}
            </div>
          </div>
        </DrawerSection>
      )}

      <DrawerSection title="Receipt Details">
        <DrawerFields fields={[
          { label: 'Date', value: ar.date },
          { label: 'Payment Mode', value: ar.payment_mode?.replace('_', ' ') },
          { label: 'Reference / Cheque No', value: ar.reference || '—' },
          ar.is_pdc ? { label: 'PDC Date', value: ar.pdc_date } : null,
          ar.notes ? { label: 'Notes', value: ar.notes } : null,
        ].filter(Boolean)} />
      </DrawerSection>

      <DrawerSection title="Amount">
        <div className="rounded-lg border bg-slate-50 px-4 py-4">
          <div className="text-center">
            <p className="text-xs text-slate-500 mb-1">Advance Amount</p>
            <p className="text-3xl font-bold font-mono text-green-700">₹{fmt(ar.amount)}</p>
            {ar.is_pdc && (
              <Badge variant="outline" className="mt-2 text-orange-600 border-orange-300">
                PDC — matures on {ar.pdc_date}
              </Badge>
            )}
          </div>
        </div>
      </DrawerSection>
    </>
  )
}
