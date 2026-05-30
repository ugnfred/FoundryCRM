import axios from 'axios'
import { supabase } from './supabase'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000',
})

// Attach Supabase JWT to every request
api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Global error handler
api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const detail = err.response?.data?.detail
    let msg
    if (Array.isArray(detail)) {
      // Pydantic validation errors — extract field + message
      msg = detail.map(e => {
        const field = e.loc?.at(-1) ?? 'field'
        return `${field}: ${e.msg}`
      }).join(' · ')
    } else {
      msg = detail ?? err.message
    }
    return Promise.reject(new Error(msg))
  }
)

export default api

// ── Quotations ──────────────────────────────────────────
export const quotationsApi = {
  list: () => api.get('/api/v1/quotations/'),
  get: (id) => api.get(`/api/v1/quotations/${id}`),
  create: (data) => api.post('/api/v1/quotations/', data),
  update: (id, data) => api.put(`/api/v1/quotations/${id}`, data),
  delete: (id) => api.delete(`/api/v1/quotations/${id}`),
  convertToSO: (id) => api.post(`/api/v1/quotations/${id}/convert-to-so`),
}

// ── Sales Orders ─────────────────────────────────────────
export const ordersApi = {
  list: () => api.get('/api/v1/orders/'),
  get: (id) => api.get(`/api/v1/orders/${id}`),
  create: (data) => api.post('/api/v1/orders/', data),
  update: (id, data) => api.put(`/api/v1/orders/${id}`, data),
}

// ── Invoices ─────────────────────────────────────────────
export const invoicesApi = {
  list: () => api.get('/api/v1/invoices/'),
  get: (id) => api.get(`/api/v1/invoices/${id}`),
  create: (data) => api.post('/api/v1/invoices/', data),
  update: (id, data) => api.put(`/api/v1/invoices/${id}`, data),
  recordPayment: (id, data) => api.post(`/api/v1/invoices/${id}/payments`, data),
  downloadPdf: (id) => api.get(`/api/v1/invoices/${id}/pdf`, { responseType: 'blob' }),
}

// ── Purchase Orders ──────────────────────────────────────
export const purchaseOrdersApi = {
  list: () => api.get('/api/v1/purchase-orders/'),
  get: (id) => api.get(`/api/v1/purchase-orders/${id}`),
  create: (data) => api.post('/api/v1/purchase-orders/', data),
  update: (id, data) => api.put(`/api/v1/purchase-orders/${id}`, data),
  createGRN: (id, data) => api.post(`/api/v1/purchase-orders/${id}/grn`, data),
}

// ── Inventory ────────────────────────────────────────────
export const inventoryApi = {
  stock: () => api.get('/api/v1/inventory/stock'),
  ledger: (productId) => api.get(`/api/v1/inventory/stock/ledger/${productId}`),
  adjust: (data) => api.post('/api/v1/inventory/stock/adjust', data),
}

// ── E-Invoice ────────────────────────────────────────────
export const einvoiceApi = {
  generate: (invoiceId) => api.post(`/api/v1/einvoice/generate?invoice_id=${invoiceId}`),
  cancel: (invoiceId, reason) => api.post(`/api/v1/einvoice/cancel/${invoiceId}?reason=${reason}`),
  ewaybill: (data) => api.post('/api/v1/einvoice/ewaybill', data),
}

// ── Settings ─────────────────────────────────────────────
export const settingsApi = {
  getCompany: () => api.get('/api/v1/settings/company'),
  updateCompany: (data) => api.put('/api/v1/settings/company', data),
  listUsers: () => api.get('/api/v1/settings/users'),
  updateUserRole: (userId, role) => api.put(`/api/v1/settings/users/${userId}/role?role=${role}`),
  listCompanies: () => api.get('/api/v1/settings/companies'),
  createCompany: (data) => api.post('/api/v1/settings/companies', data),
  updateCustomer: (id, data) => api.put(`/api/v1/settings/companies/${id}`, data),
  deactivateCompany: (id) => api.delete(`/api/v1/settings/companies/${id}`),
  listProducts: () => api.get('/api/v1/settings/products'),
  createProduct: (data) => api.post('/api/v1/settings/products', data),
  updateProduct: (id, data) => api.put(`/api/v1/settings/products/${id}`, data),
  deactivateProduct: (id) => api.delete(`/api/v1/settings/products/${id}`),
}

