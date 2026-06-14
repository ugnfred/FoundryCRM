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
  downloadPdf: (id) => api.get(`/api/v1/quotations/${id}/pdf`, { responseType: 'blob' }),
}

// ── Sales Orders ─────────────────────────────────────────
export const ordersApi = {
  list: () => api.get('/api/v1/orders/'),
  get: (id) => api.get(`/api/v1/orders/${id}`),
  create: (data) => api.post('/api/v1/orders/', data),
  update: (id, data) => api.put(`/api/v1/orders/${id}`, data),
  getInvoicePrefill: (id) => api.get(`/api/v1/orders/${id}/invoice-prefill`),
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

// ── Credit Notes ─────────────────────────────────────────
export const creditNotesApi = {
  list:        () => api.get('/api/v1/credit-notes/'),
  get:         (id) => api.get(`/api/v1/credit-notes/${id}`),
  create:      (data) => api.post('/api/v1/credit-notes/', data),
  issue:       (id) => api.post(`/api/v1/credit-notes/${id}/issue`),
  cancel:      (id) => api.post(`/api/v1/credit-notes/${id}/cancel`),
  downloadPdf: (id) => api.get(`/api/v1/credit-notes/${id}/pdf`, { responseType: 'blob' }),
}

// ── GRNs ─────────────────────────────────────────────────
export const grnsApi = {
  list: () => api.get('/api/v1/grns/'),
  get: (id) => api.get(`/api/v1/grns/${id}`),
  downloadPdf: (id) => api.get(`/api/v1/grns/${id}/pdf`, { responseType: 'blob' }),
}

// ── Proforma Invoices ─────────────────────────────────
export const proformaApi = {
  list:         () => api.get('/api/v1/proforma/'),
  get:          (id) => api.get(`/api/v1/proforma/${id}`),
  create:       (data) => api.post('/api/v1/proforma/', data),
  update:       (id, data) => api.put(`/api/v1/proforma/${id}`, data),
  updateStatus: (id, status) => api.patch(`/api/v1/proforma/${id}/status?status=${status}`),
  convert:      (id) => api.post(`/api/v1/proforma/${id}/convert`),
  downloadPdf:  (id) => api.get(`/api/v1/proforma/${id}/pdf`, { responseType: 'blob' }),
}

// ── Delivery Challans ─────────────────────────────────
export const deliveryChallansApi = {
  list:        () => api.get('/api/v1/delivery-challans/'),
  get:         (id) => api.get(`/api/v1/delivery-challans/${id}`),
  create:      (data) => api.post('/api/v1/delivery-challans/', data),
  update:      (id, data) => api.put(`/api/v1/delivery-challans/${id}`, data),
  dispatch:    (id) => api.patch(`/api/v1/delivery-challans/${id}/dispatch`),
  cancel:      (id) => api.patch(`/api/v1/delivery-challans/${id}/cancel`),
  downloadPdf: (id) => api.get(`/api/v1/delivery-challans/${id}/pdf`, { responseType: 'blob' }),
}

// ── Work Orders ───────────────────────────────────────
export const workOrdersApi = {
  list:         (status) => api.get('/api/v1/work-orders/', { params: status ? { status } : {} }),
  get:          (id) => api.get(`/api/v1/work-orders/${id}`),
  create:       (data) => api.post('/api/v1/work-orders/', data),
  updateStatus: (id, status) => api.patch(`/api/v1/work-orders/${id}/status?status=${status}`),
  complete:     (id) => api.post(`/api/v1/work-orders/${id}/complete`),
}

// ── Advance Receipts ─────────────────────────────────
export const advanceReceiptsApi = {
  list:             (companyId) => api.get('/api/v1/advance-receipts/', { params: companyId ? { company_id: companyId } : {} }),
  get:              (id) => api.get(`/api/v1/advance-receipts/${id}`),
  create:           (data) => api.post('/api/v1/advance-receipts/', data),
  cancel:           (id) => api.patch(`/api/v1/advance-receipts/${id}/cancel`),
  availableBalance: (companyId) => api.get(`/api/v1/advance-receipts/company/${companyId}/available-balance`),
}

// ── BOM ───────────────────────────────────────────────
export const bomApi = {
  list:   (productId) => api.get('/api/v1/bom/', { params: productId ? { product_id: productId } : {} }),
  get:    (id) => api.get(`/api/v1/bom/${id}`),
  active: (productId) => api.get('/api/v1/bom/active', { params: { product_id: productId } }),
  create: (data) => api.post('/api/v1/bom/', data),
  update: (id, data) => api.put(`/api/v1/bom/${id}`, data),
}

// ── Reports ──────────────────────────────────────────
export const reportsApi = {
  gstr1:                (params) => api.get('/api/v1/reports/gstr1', { params }),
  gstr1Excel:           (params) => api.get('/api/v1/reports/gstr1/excel', { params, responseType: 'blob' }),
  gstr1Json:            (params) => api.get('/api/v1/reports/gstr1/json', { params, responseType: 'blob' }),
  gstr3b:               (params) => api.get('/api/v1/reports/gstr3b', { params }),
  gstr3bExcel:          (params) => api.get('/api/v1/reports/gstr3b/excel', { params, responseType: 'blob' }),
  receivablesAging:     (params) => api.get('/api/v1/reports/aging/receivables', { params }),
  receivablesAgingXlsx: (params) => api.get('/api/v1/reports/aging/receivables/excel', { params, responseType: 'blob' }),
  payablesAging:        (params) => api.get('/api/v1/reports/aging/payables', { params }),
  payablesAgingXlsx:    (params) => api.get('/api/v1/reports/aging/payables/excel', { params, responseType: 'blob' }),
}

// ── Settings ─────────────────────────────────────────────
export const settingsApi = {
  getCompany: () => api.get('/api/v1/settings/company'),
  updateCompany: (data) => api.put('/api/v1/settings/company', data),
  listUsers: () => api.get('/api/v1/settings/users'),
  createUser: (data) => api.post('/api/v1/settings/users', data),
  updateUserRole: (userId, role) => api.put(`/api/v1/settings/users/${userId}/role?role=${role}`),
  deactivateUser: (userId) => api.put(`/api/v1/settings/users/${userId}/deactivate`),
  reactivateUser: (userId) => api.put(`/api/v1/settings/users/${userId}/reactivate`),
  listCompanies: () => api.get('/api/v1/settings/companies'),
  getCustomerLedger: (id, params) => api.get(`/api/v1/settings/companies/${id}/ledger`, { params }),
  setOpeningBalance: (id, data) => api.post(`/api/v1/settings/companies/${id}/ledger/opening`, data),
  createCompany: (data) => api.post('/api/v1/settings/companies', data),
  updateCustomer: (id, data) => api.put(`/api/v1/settings/companies/${id}`, data),
  deactivateCompany: (id) => api.delete(`/api/v1/settings/companies/${id}`),
  listProducts: () => api.get('/api/v1/settings/products'),
  createProduct: (data) => api.post('/api/v1/settings/products', data),
  updateProduct: (id, data) => api.put(`/api/v1/settings/products/${id}`, data),
  deactivateProduct: (id) => api.delete(`/api/v1/settings/products/${id}`),
}

