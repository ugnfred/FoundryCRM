/**
 * seed.js — Direct API helpers for creating test data.
 *
 * These functions call the backend REST API (not the browser), so they're
 * suitable for use in test hooks (beforeAll / beforeEach) to set up fixtures
 * without going through the UI.
 *
 * Required env vars:
 *   TEST_EMAIL       — Supabase user email
 *   TEST_PASSWORD    — Supabase user password
 *   API_BASE_URL     — Backend base (default: https://foundrycrm-production.up.railway.app)
 *   SUPABASE_URL     — Supabase project URL
 *   SUPABASE_ANON_KEY — Supabase anon key
 */

const API_BASE =
  process.env.API_BASE_URL ?? 'https://foundrycrm-production.up.railway.app'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/**
 * Get a Supabase access token by signing in with email + password.
 * Returns the JWT string.
 *
 * @returns {Promise<string>}
 */
export async function getAuthToken() {
  const email = process.env.TEST_EMAIL ?? 'admin@foundryerp.test'
  const password = process.env.TEST_PASSWORD

  if (!password) throw new Error('TEST_PASSWORD env var is required for seed helpers')
  if (!SUPABASE_URL) throw new Error('SUPABASE_URL env var is required')
  if (!SUPABASE_ANON_KEY) throw new Error('SUPABASE_ANON_KEY env var is required')

  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email, password }),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Supabase auth failed: ${err}`)
  }

  const data = await res.json()
  return data.access_token
}

// ---------------------------------------------------------------------------
// Internal request helper
// ---------------------------------------------------------------------------

async function apiPost(path, body, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`POST ${path} failed (${res.status}): ${err}`)
  }

  return res.json()
}

async function apiGet(path, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`GET ${path} failed (${res.status}): ${err}`)
  }

  return res.json()
}

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

/**
 * Create a customer company and return its id.
 *
 * @param {string} token
 * @param {object} [overrides]
 * @returns {Promise<{id: string, name: string}>}
 */
export async function createCustomer(token, overrides = {}) {
  const payload = {
    name: `Test Customer ${Date.now()}`,
    gstin: '27ABCDE1234F1Z5',
    state_code: '27',
    type: 'buyer',
    city: 'Mumbai',
    phone: '9999999999',
    email: 'testcustomer@example.com',
    ...overrides,
  }
  return apiPost('/api/v1/settings/companies', payload, token)
}

/**
 * Create a supplier company and return its id.
 *
 * @param {string} token
 * @param {object} [overrides]
 */
export async function createSupplier(token, overrides = {}) {
  return createCustomer(token, { type: 'supplier', name: `Test Supplier ${Date.now()}`, ...overrides })
}

/**
 * Create a product and return its record.
 *
 * @param {string} token
 * @param {object} [overrides]
 */
export async function createProduct(token, overrides = {}) {
  const payload = {
    name: `Test Product ${Date.now()}`,
    hsn_code: '7325',
    uom: 'NOS',
    base_rate: 1000,
    gst_rate: 18,
    category: 'Test',
    ...overrides,
  }
  return apiPost('/api/v1/settings/products', payload, token)
}

/**
 * Create a quotation and return its record.
 *
 * @param {string} customerId
 * @param {string} token
 * @param {object} [overrides]
 */
export async function createQuotation(customerId, token, overrides = {}) {
  // We need at least one product to add as a line item
  const product = await createProduct(token)

  const today = new Date().toISOString().slice(0, 10)
  const nextMonth = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10)

  const payload = {
    company_id: customerId,
    date: today,
    valid_until: nextMonth,
    items: [
      {
        product_id: product.id,
        description: product.name,
        qty: 2,
        rate: product.base_rate,
        uom: product.uom,
        hsn_code: product.hsn_code,
        gst_rate: product.gst_rate,
        discount: 0,
      },
    ],
    notes: 'Seeded by E2E test',
    ...overrides,
  }

  return apiPost('/api/v1/quotations/', payload, token)
}

/**
 * Create a sales order directly (without going via quotation conversion).
 *
 * @param {string} customerId
 * @param {string} token
 * @param {object} [overrides]
 */
export async function createSalesOrder(customerId, token, overrides = {}) {
  const product = await createProduct(token)
  const today = new Date().toISOString().slice(0, 10)

  const payload = {
    company_id: customerId,
    date: today,
    delivery_date: today,
    items: [
      {
        product_id: product.id,
        description: product.name,
        qty: 1,
        rate: product.base_rate,
        uom: product.uom,
        hsn_code: product.hsn_code,
        gst_rate: product.gst_rate,
        discount: 0,
      },
    ],
    notes: 'Seeded by E2E test',
    ...overrides,
  }

  return apiPost('/api/v1/orders/', payload, token)
}

/**
 * Create an invoice directly.
 *
 * @param {string} customerId
 * @param {string} token
 * @param {object} [overrides]
 */
export async function createInvoice(customerId, token, overrides = {}) {
  const product = await createProduct(token)
  const today = new Date().toISOString().slice(0, 10)

  const payload = {
    company_id: customerId,
    date: today,
    items: [
      {
        product_id: product.id,
        description: product.name,
        qty: 1,
        rate: product.base_rate,
        uom: product.uom,
        hsn_code: product.hsn_code,
        gst_rate: product.gst_rate,
        discount: 0,
      },
    ],
    notes: 'Seeded by E2E test',
    ...overrides,
  }

  return apiPost('/api/v1/invoices/', payload, token)
}

/**
 * Create a purchase order.
 *
 * @param {string} supplierId
 * @param {string} token
 * @param {object} [overrides]
 */
export async function createPurchaseOrder(supplierId, token, overrides = {}) {
  const product = await createProduct(token)
  const today = new Date().toISOString().slice(0, 10)

  const payload = {
    company_id: supplierId,
    date: today,
    expected_delivery: today,
    items: [
      {
        product_id: product.id,
        description: product.name,
        qty: 5,
        rate: 800,
        uom: product.uom,
        hsn_code: product.hsn_code,
        gst_rate: product.gst_rate,
      },
    ],
    notes: 'Seeded by E2E test',
    ...overrides,
  }

  return apiPost('/api/v1/purchase-orders/', payload, token)
}

/**
 * List all companies (for finding existing test customers).
 *
 * @param {string} token
 */
export async function listCompanies(token) {
  return apiGet('/api/v1/settings/companies', token)
}

/**
 * List all products.
 *
 * @param {string} token
 */
export async function listProducts(token) {
  return apiGet('/api/v1/settings/products', token)
}
