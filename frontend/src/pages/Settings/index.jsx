import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { settingsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { useHasRole } from '@/hooks/useAuth'
import { Pencil, Trash2, X, Check } from 'lucide-react'

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
  bank_ifsc: '', upi_id: '',
}

function CompanySettings({ isAdmin }) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['company-settings'], queryFn: settingsApi.getCompany })
  // Merge defaults so required fields are never undefined/omitted from the submission
  const { register, handleSubmit } = useForm({ values: { ...COMPANY_DEFAULTS, ...(data ?? {}) } })

  const mutation = useMutation({
    mutationFn: settingsApi.updateCompany,
    onSuccess: () => { toast({ title: 'Saved' }); qc.invalidateQueries(['company-settings']) },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  return (
    <Card className="max-w-2xl">
      <CardHeader><CardTitle>Company Details</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="grid grid-cols-2 gap-4">
          {[['name','Company Name'],['gstin','GSTIN'],['state_code','State Code'],['pan','PAN'],['phone','Phone'],['email','Email'],['cin','CIN'],['bank_name','Bank Name'],['bank_account','Bank Account No.'],['bank_ifsc','IFSC Code'],['upi_id','UPI ID']].map(([field, label]) => (
            <div key={field} className="space-y-1.5">
              <Label>{label}</Label>
              <Input {...register(field)} disabled={!isAdmin} />
            </div>
          ))}
          <div className="col-span-2 space-y-1.5">
            <Label>Address</Label>
            <textarea {...register('address')} rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" disabled={!isAdmin} />
          </div>
          {isAdmin && (
            <div className="col-span-2 flex justify-end">
              <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save'}</Button>
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
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: settingsApi.listUsers })

  const roleMutation = useMutation({
    mutationFn: ({ id, role }) => settingsApi.updateUserRole(id, role),
    onSuccess: () => { toast({ title: 'Role updated' }); qc.invalidateQueries(['users']) },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  })

  return (
    <Card className="max-w-2xl">
      <CardHeader><CardTitle>Users & Roles</CardTitle></CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead className="border-b"><tr>{['Name','Email','Role',''].map((h) => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600">{h}</th>)}</tr></thead>
          <tbody className="divide-y">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-3 py-2">{u.name}</td>
                <td className="px-3 py-2 text-muted-foreground">{u.email}</td>
                <td className="px-3 py-2">
                  <select value={u.role} onChange={(e) => roleMutation.mutate({ id: u.id, role: e.target.value })}
                    className="h-8 rounded border border-input text-sm px-2">
                    {['admin','sales','accounts','dispatch'].map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

function CompaniesSettings() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const isAdmin = useHasRole('admin')
  const [editId, setEditId] = useState(null)
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
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(c)}><Pencil className="h-3 w-3" /></Button>
                    {isAdmin && <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => { if (confirm(`Deactivate ${c.name}?`)) deactivateMutation.mutate(c.id) }}><Trash2 className="h-3 w-3" /></Button>}
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
