import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { settingsApi } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { useHasRole } from '@/hooks/useAuth'
import { Pencil, Trash2, X, Check, Upload, UserPlus, UserX, UserCheck, BookOpen } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/components/ui/dialog'

const INDIAN_STATES = [
  { code: '01', name: 'Jammu & Kashmir' }, { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' }, { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' }, { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' }, { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' }, { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' }, { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' }, { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' }, { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' }, { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' }, { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' }, { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' }, { code: '24', name: 'Gujarat' },
  { code: '25', name: 'Daman & Diu' }, { code: '26', name: 'Dadra & Nagar Haveli' },
  { code: '27', name: 'Maharashtra' }, { code: '28', name: 'Andhra Pradesh (Old)' },
  { code: '29', name: 'Karnataka' }, { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' }, { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' }, { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar' }, { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' }, { code: '38', name: 'Ladakh' },
]

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

const TABS = ['Company', 'Users', 'Customers', 'Products']

export default function Settings() {
  const [tab, setTab] = useState('Company')
  const isAdmin = useHasRole('admin')

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'Company' && <CompanySettings isAdmin={isAdmin} />}
      {tab === 'Users' && isAdmin && <UsersSettings />}
      {tab === 'Customers' && <CompaniesSettings />}
      {tab === 'Products' && <ProductsSettings />}
    </div>
  )
}

const COMPANY_DEFAULTS = {
  name: '', gstin: '', state_code: '', address: '', pan: '',
  phone: '', email: '', cin: '', bank_name: '', bank_account: '',
  bank_ifsc: '', upi_id: '', logo_url: '', einvoice_env: 'sandbox',
}

function CompanySettings({ isAdmin }) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const fileRef = useRef(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [uploading, setUploading] = useState(false)

  const { data } = useQuery({ queryKey: ['company-settings'], queryFn: settingsApi.getCompany })

  const { register, handleSubmit, setValue, formState: { errors, isDirty } } = useForm({
    values: { ...COMPANY_DEFAULTS, ...(data ?? {}) },
  })

  const mutation = useMutation({
    mutationFn: settingsApi.updateCompany,
    onSuccess: () => { toast({ title: 'Saved' }); qc.invalidateQueries(['company-settings']) },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `logo-${Date.now()}.${ext}`
      // Use service-role upload via signed URL workaround: upload as anon but with public bucket
      const { data: uploadData, error } = await supabase.storage
        .from('company-assets')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (error) throw error
      const { data: urlData } = supabase.storage.from('company-assets').getPublicUrl(path)
      const publicUrl = urlData.publicUrl
      // Save immediately to DB so it persists even if user doesn't click Save
      await settingsApi.updateCompany({ ...(data ?? COMPANY_DEFAULTS), logo_url: publicUrl })
      setValue('logo_url', publicUrl, { shouldDirty: false })
      setLogoPreview(publicUrl)
      qc.invalidateQueries(['company-settings'])
      toast({ title: 'Logo uploaded and saved' })
    } catch (err) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  const currentLogo = logoPreview ?? data?.logo_url

  return (
    <Card className="max-w-2xl">
      <CardHeader><CardTitle>Company Details</CardTitle></CardHeader>
      <CardContent className="pb-0">
        {/* Unsaved changes banner */}
        {isDirty && (
          <div className="mb-4 rounded-md bg-yellow-50 border border-yellow-200 px-4 py-2 text-sm text-yellow-800">
            You have unsaved changes
          </div>
        )}

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))}>
          <div className="grid grid-cols-2 gap-4">

            {/* Logo upload */}
            <div className="col-span-2 space-y-1.5">
              <Label>Company Logo</Label>
              <div className="flex items-center gap-4">
                {currentLogo ? (
                  <img src={currentLogo} alt="Logo" className="h-16 w-auto rounded border object-contain" />
                ) : (
                  <div className="h-16 w-24 rounded border border-dashed border-muted-foreground/40 flex items-center justify-center text-xs text-muted-foreground">No logo</div>
                )}
                {isAdmin && (
                  <>
                    <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                      <Upload className="h-3 w-3 mr-1" />{uploading ? 'Uploading…' : 'Upload Logo'}
                    </Button>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  </>
                )}
              </div>
              <input type="hidden" {...register('logo_url')} />
            </div>

            {/* Company Name */}
            <div className="space-y-1.5">
              <Label>Company Name <span className="text-red-500">*</span></Label>
              <Input {...register('name', { required: 'Required' })} disabled={!isAdmin} />
              {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
            </div>

            {/* GSTIN */}
            <div className="space-y-1.5">
              <Label>GSTIN <span className="text-red-500">*</span></Label>
              <Input
                {...register('gstin', {
                  required: 'Required',
                  pattern: { value: GSTIN_REGEX, message: 'Invalid GSTIN format (e.g. 27ABCDE1234F1Z5)' },
                })}
                disabled={!isAdmin}
                placeholder="27ABCDE1234F1Z5"
                className={errors.gstin ? 'border-red-400' : ''}
              />
              {errors.gstin && <p className="text-xs text-red-500">{errors.gstin.message}</p>}
            </div>

            {/* State Code dropdown */}
            <div className="space-y-1.5">
              <Label>State Code <span className="text-red-500">*</span></Label>
              <select
                {...register('state_code', { required: 'Required' })}
                disabled={!isAdmin}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm disabled:opacity-50"
              >
                <option value="">Select state…</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s.code} value={s.code}>{s.code} — {s.name}</option>
                ))}
              </select>
              {errors.state_code && <p className="text-xs text-red-500">{errors.state_code.message}</p>}
            </div>

            {/* PAN */}
            <div className="space-y-1.5">
              <Label>PAN</Label>
              <Input {...register('pan')} disabled={!isAdmin} />
            </div>

            {/* Rest of fields */}
            {[['phone','Phone'],['email','Email'],['cin','CIN'],['bank_name','Bank Name'],['bank_account','Bank Account No.'],['bank_ifsc','IFSC Code'],['upi_id','UPI ID']].map(([field, label]) => (
              <div key={field} className="space-y-1.5">
                <Label>{label}</Label>
                <Input {...register(field)} disabled={!isAdmin} />
              </div>
            ))}

            {/* E-Invoice Environment */}
            <div className="col-span-2 space-y-1.5">
              <Label>E-Invoice Mode</Label>
              <div className="flex gap-4">
                {['sandbox', 'production'].map((env) => (
                  <label key={env} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value={env}
                      disabled={!isAdmin}
                      {...register('einvoice_env', {
                        onChange: (e) => {
                          if (e.target.value === 'production') {
                            if (!confirm('Switch to PRODUCTION? Real IRNs will be generated and cannot be cancelled as test. Confirm?')) {
                              e.target.checked = false
                            }
                          }
                        },
                      })}
                    />
                    <span className={`text-sm font-medium ${env === 'production' ? 'text-red-600' : 'text-green-700'}`}>
                      {env === 'sandbox' ? 'Sandbox (test)' : 'Production (LIVE)'}
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Sandbox uses NIC test environment. Switch to Production only when ready for real e-invoicing.</p>
            </div>

            {/* Address */}
            <div className="col-span-2 space-y-1.5">
              <Label>Address</Label>
              <textarea
                {...register('address')}
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                disabled={!isAdmin}
              />
            </div>
          </div>

          {/* Sticky Save button */}
          {isAdmin && (
            <div className="sticky bottom-0 bg-white border-t mt-4 -mx-6 px-6 py-3 flex justify-end">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  )
}

function UsersSettings() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: settingsApi.listUsers })
  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  const roleMutation = useMutation({
    mutationFn: ({ id, role }) => settingsApi.updateUserRole(id, role),
    onSuccess: () => { toast({ title: 'Role updated' }); qc.invalidateQueries(['users']) },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  const createMutation = useMutation({
    mutationFn: (data) => settingsApi.createUser(data),
    onSuccess: (res) => {
      toast({ title: 'User created', description: `${res.name} can now log in.` })
      qc.invalidateQueries(['users'])
      reset()
      setShowCreate(false)
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id) => settingsApi.deactivateUser(id),
    onSuccess: () => { toast({ title: 'User deactivated' }); qc.invalidateQueries(['users']) },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  const reactivateMutation = useMutation({
    mutationFn: (id) => settingsApi.reactivateUser(id),
    onSuccess: () => { toast({ title: 'User reactivated' }); qc.invalidateQueries(['users']) },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  return (
    <div className="space-y-4 max-w-2xl">
      {showCreate && (
        <Card>
          <CardHeader><CardTitle className="text-base">Create New User</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Full Name <span className="text-red-500">*</span></Label>
                <Input {...register('name', { required: 'Required' })} />
                {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Email <span className="text-red-500">*</span></Label>
                <Input type="email" {...register('email', { required: 'Required' })} />
                {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Password <span className="text-red-500">*</span></Label>
                <Input type="password" {...register('password', { required: 'Required', minLength: { value: 8, message: 'Min 8 characters' } })} />
                {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Role <span className="text-red-500">*</span></Label>
                <select {...register('role', { required: true })} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                  {['admin','sales','accounts','dispatch'].map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="col-span-2 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => { setShowCreate(false); reset() }}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating…' : 'Create User'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Users & Roles</CardTitle>
          {!showCreate && (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <UserPlus className="h-3 w-3 mr-1" /> Add User
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr>{['Name','Email','Role','Status',''].map((h) => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => (
                <tr key={u.id} className={u.is_active === false ? 'opacity-50' : ''}>
                  <td className="px-3 py-2 font-medium">{u.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{u.email}</td>
                  <td className="px-3 py-2">
                    <select
                      value={u.role}
                      disabled={u.is_active === false}
                      onChange={(e) => roleMutation.mutate({ id: u.id, role: e.target.value })}
                      className="h-8 rounded border border-input text-sm px-2 disabled:opacity-50"
                    >
                      {['admin','sales','accounts','dispatch'].map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <Badge className={u.is_active === false ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'}>
                      {u.is_active === false ? 'Inactive' : 'Active'}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    {u.is_active === false ? (
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600"
                        title="Reactivate user"
                        onClick={() => reactivateMutation.mutate(u.id)}>
                        <UserCheck className="h-3 w-3" />
                      </Button>
                    ) : (
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-700"
                        title="Deactivate user"
                        onClick={() => {
                          if (confirm(`Deactivate ${u.name}? They will not be able to log in.`))
                            deactivateMutation.mutate(u.id)
                        }}>
                        <UserX className="h-3 w-3" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

function CustomerLedgerModal({ company, onClose }) {
  const { toast } = useToast()
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [showOpening, setShowOpening] = useState(false)
  const [openingAmt, setOpeningAmt] = useState('')
  const [openingDate, setOpeningDate] = useState('2024-04-01')

  const { data, refetch } = useQuery({
    queryKey: ['customer-ledger', company.id, fromDate, toDate],
    queryFn: () => settingsApi.getCustomerLedger(company.id, { from_date: fromDate || undefined, to_date: toDate || undefined }),
  })

  const rows = data?.rows ?? []
  const closingBalance = data?.closing_balance ?? 0

  function exportCsv() {
    const header = ['Date', 'Type', 'Doc No', 'Debit', 'Credit', 'Balance']
    const lines = rows.map((r) => [r.doc_date, r.doc_type, r.doc_no ?? '', r.debit, r.credit, r.running_balance].join(','))
    const csv = [header.join(','), ...lines].join('\n')
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = `ledger-${company.name}.csv`; a.click()
  }

  async function saveOpening() {
    try {
      await settingsApi.setOpeningBalance(company.id, { amount: parseFloat(openingAmt) || 0, as_of_date: openingDate })
      toast({ title: 'Opening balance set' }); setShowOpening(false); refetch()
    } catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }) }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Customer Ledger — {company.name}</DialogTitle></DialogHeader>
        <DialogBody>
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex gap-3 items-end flex-wrap">
              <div className="space-y-1"><Label className="text-xs">From</Label><Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-8 text-xs w-36" /></div>
              <div className="space-y-1"><Label className="text-xs">To</Label><Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-8 text-xs w-36" /></div>
              <Button size="sm" variant="outline" onClick={exportCsv}>Export CSV</Button>
              <Button size="sm" variant="outline" onClick={() => setShowOpening(!showOpening)}>Set Opening Balance</Button>
            </div>

            {showOpening && (
              <div className="rounded-lg border p-3 bg-yellow-50 flex gap-3 items-end">
                <div className="space-y-1"><Label className="text-xs">Opening Balance (₹)</Label><Input type="number" step="0.01" value={openingAmt} onChange={(e) => setOpeningAmt(e.target.value)} placeholder="Positive = they owe you" className="h-8 text-xs w-40" /></div>
                <div className="space-y-1"><Label className="text-xs">As of Date</Label><Input type="date" value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} className="h-8 text-xs w-36" /></div>
                <Button size="sm" onClick={saveOpening}>Save</Button>
                <p className="text-xs text-muted-foreground self-center">Positive = customer owes you. Negative = you owe customer.</p>
              </div>
            )}

            {/* Ledger table */}
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>{['Date','Type','Doc No','Debit (₹)','Credit (₹)','Balance (₹)'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y">
                  {rows.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">No ledger entries for this period.</td></tr>
                  )}
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-xs">{r.doc_date}</td>
                      <td className="px-3 py-2"><Badge className={
                        r.doc_type === 'invoice' ? 'bg-blue-100 text-blue-700' :
                        r.doc_type === 'payment' ? 'bg-green-100 text-green-700' :
                        r.doc_type === 'cn' ? 'bg-red-100 text-red-700' :
                        r.doc_type === 'opening' ? 'bg-gray-100 text-gray-700' :
                        'bg-yellow-100 text-yellow-700'
                      }>{r.doc_type}</Badge></td>
                      <td className="px-3 py-2 text-xs font-medium">{r.doc_no ?? '—'}</td>
                      <td className="px-3 py-2 text-right text-xs">{r.debit > 0 ? `₹${Number(r.debit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}</td>
                      <td className="px-3 py-2 text-right text-xs text-green-700">{r.credit > 0 ? `₹${Number(r.credit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}</td>
                      <td className={`px-3 py-2 text-right text-xs font-medium ${r.running_balance > 0 ? 'text-red-600' : r.running_balance < 0 ? 'text-green-600' : ''}`}>
                        ₹{Number(Math.abs(r.running_balance)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        {r.running_balance < 0 ? ' Cr' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t bg-gray-50">
                  <tr>
                    <td colSpan={5} className="px-3 py-2 text-xs font-semibold text-right">Closing Balance</td>
                    <td className={`px-3 py-2 text-right text-sm font-bold ${closingBalance > 0 ? 'text-red-600' : closingBalance < 0 ? 'text-green-700' : ''}`}>
                      ₹{Number(Math.abs(closingBalance)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      {closingBalance < 0 ? ' Cr' : closingBalance > 0 ? ' Dr' : ''}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

function CompaniesSettings() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const isAdmin = useHasRole('admin')
  const [editId, setEditId] = useState(null)
  const [ledgerCompany, setLedgerCompany] = useState(null)
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: settingsApi.listCompanies })
  const { register, handleSubmit, reset } = useForm()
  const { register: regEdit, handleSubmit: handleEdit, reset: resetEdit } = useForm()

  const createMutation = useMutation({
    mutationFn: settingsApi.createCompany,
    onSuccess: () => { toast({ title: 'Company added' }); qc.invalidateQueries(['companies']); reset() },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => settingsApi.updateCustomer(id, data),
    onSuccess: () => { toast({ title: 'Company updated' }); qc.invalidateQueries(['companies']); setEditId(null) },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })
  const deactivateMutation = useMutation({
    mutationFn: (id) => settingsApi.deactivateCompany(id),
    onSuccess: () => { toast({ title: 'Company deactivated' }); qc.invalidateQueries(['companies']) },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  const startEdit = (c) => { setEditId(c.id); resetEdit(c) }

  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <CardHeader><CardTitle>Add Company</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="grid grid-cols-2 gap-3">
            {[['name','Name *'],['gstin','GSTIN'],['state_code','State Code *'],['city','City'],['phone','Phone'],['email','Email']].map(([f,l]) => (
              <div key={f} className="space-y-1"><Label>{l}</Label><Input {...register(f, { required: ['name', 'state_code'].includes(f) })} /></div>
            ))}
            <div className="space-y-1"><Label>Type</Label>
              <select {...register('type')} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                <option value="buyer">Buyer</option><option value="supplier">Supplier</option><option value="both">Both</option>
              </select>
            </div>
            <div className="col-span-2 flex justify-end"><Button type="submit" size="sm">Add</Button></div>
          </form>
        </CardContent>
      </Card>
      <div className="rounded-lg border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>{['Name','GSTIN','State','Type',''].map((h) => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {companies.map((c) => editId === c.id ? (
              <tr key={c.id} className="bg-blue-50">
                <td className="px-2 py-1"><Input {...regEdit('name')} className="h-7 text-xs" /></td>
                <td className="px-2 py-1"><Input {...regEdit('gstin')} className="h-7 text-xs font-mono" /></td>
                <td className="px-2 py-1"><Input {...regEdit('state_code')} className="h-7 text-xs w-16" /></td>
                <td className="px-2 py-1">
                  <select {...regEdit('type')} className="h-7 rounded border text-xs px-1">
                    <option value="buyer">Buyer</option><option value="supplier">Supplier</option><option value="both">Both</option>
                  </select>
                </td>
                <td className="px-2 py-1">
                  <div className="flex gap-1">
                    <Button size="icon" className="h-6 w-6" onClick={handleEdit((d) => updateMutation.mutate({ id: c.id, data: d }))}><Check className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditId(null)}><X className="h-3 w-3" /></Button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{c.name}</td>
                <td className="px-3 py-2 font-mono text-xs">{c.gstin}</td>
                <td className="px-3 py-2">{c.state_code}</td>
                <td className="px-3 py-2 capitalize">{c.type}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-600" title="Customer Ledger" onClick={() => setLedgerCompany(c)}><BookOpen className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(c)}><Pencil className="h-3 w-3" /></Button>
                    {isAdmin && <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => { if (confirm(`Deactivate ${c.name}?`)) deactivateMutation.mutate(c.id) }}><Trash2 className="h-3 w-3" /></Button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ledgerCompany && <CustomerLedgerModal company={ledgerCompany} onClose={() => setLedgerCompany(null)} />}
    </div>
  )
}

function ProductsSettings() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const isAdmin = useHasRole('admin')
  const [editId, setEditId] = useState(null)
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: settingsApi.listProducts })
  const PRODUCT_DEFAULTS = { gst_rate: 18, uom: 'NOS', base_rate: 0 }
  const { register, handleSubmit, reset } = useForm({ defaultValues: PRODUCT_DEFAULTS })
  const { register: regEdit, handleSubmit: handleEdit, reset: resetEdit } = useForm()

  const createMutation = useMutation({
    mutationFn: settingsApi.createProduct,
    onSuccess: () => { toast({ title: 'Product added' }); qc.invalidateQueries(['products']); reset(PRODUCT_DEFAULTS) },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => settingsApi.updateProduct(id, data),
    onSuccess: () => { toast({ title: 'Product updated' }); qc.invalidateQueries(['products']); setEditId(null) },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })
  const deactivateMutation = useMutation({
    mutationFn: (id) => settingsApi.deactivateProduct(id),
    onSuccess: () => { toast({ title: 'Product deactivated' }); qc.invalidateQueries(['products']) },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  const startEdit = (p) => { setEditId(p.id); resetEdit(p) }

  return (
    <div className="space-y-4 max-w-3xl">
      <Card>
        <CardHeader><CardTitle>Add Product</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="grid grid-cols-2 gap-3">
            {[['name','Name *'],['hsn_code','HSN Code *'],['uom','UOM'],['base_rate','Base Rate'],['gst_rate','GST %'],['category','Category']].map(([f,l]) => (
              <div key={f} className="space-y-1"><Label>{l}</Label>
                <Input type={['base_rate','gst_rate'].includes(f) ? 'number' : 'text'} step="0.01"
                  {...register(f, ['base_rate','gst_rate'].includes(f) ? { valueAsNumber: true } : {})} />
              </div>
            ))}
            <div className="col-span-2 flex justify-end"><Button type="submit" size="sm">Add</Button></div>
          </form>
        </CardContent>
      </Card>
      <div className="rounded-lg border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>{['Name','HSN','UOM','Rate','GST%','Category',''].map((h) => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {products.map((p) => editId === p.id ? (
              <tr key={p.id} className="bg-blue-50">
                <td className="px-2 py-1"><Input {...regEdit('name')} className="h-7 text-xs" /></td>
                <td className="px-2 py-1"><Input {...regEdit('hsn_code')} className="h-7 text-xs w-20" /></td>
                <td className="px-2 py-1"><Input {...regEdit('uom')} className="h-7 text-xs w-16" /></td>
                <td className="px-2 py-1"><Input type="number" step="0.01" {...regEdit('base_rate', { valueAsNumber: true })} className="h-7 text-xs w-24" /></td>
                <td className="px-2 py-1"><Input type="number" step="0.01" {...regEdit('gst_rate', { valueAsNumber: true })} className="h-7 text-xs w-16" /></td>
                <td className="px-2 py-1"><Input {...regEdit('category')} className="h-7 text-xs" /></td>
                <td className="px-2 py-1">
                  <div className="flex gap-1">
                    <Button size="icon" className="h-6 w-6" onClick={handleEdit((d) => updateMutation.mutate({ id: p.id, data: d }))}><Check className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditId(null)}><X className="h-3 w-3" /></Button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{p.name}</td>
                <td className="px-3 py-2 font-mono text-xs">{p.hsn_code}</td>
                <td className="px-3 py-2">{p.uom}</td>
                <td className="px-3 py-2">&#8377;{Number(p.base_rate).toLocaleString('en-IN')}</td>
                <td className="px-3 py-2">{p.gst_rate}%</td>
                <td className="px-3 py-2 text-muted-foreground">{p.category}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(p)}><Pencil className="h-3 w-3" /></Button>
                    {isAdmin && <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => { if (confirm(`Deactivate ${p.name}?`)) deactivateMutation.mutate(p.id) }}><Trash2 className="h-3 w-3" /></Button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
