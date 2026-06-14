# Architecture Document — Foundry ERP Phase 2
**Role:** Software Architect
**Version:** 1.0
**Date:** 2026-06-14
**BRD:** v1.0 (approved) | **Backlog:** v1.0
**Status:** DRAFT — for developer reference before Sprint 1 begins

---

## 1. Current System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (React 18 + Vite + shadcn/ui + TanStack)               │
│  Vercel CDN — https://foundry-crm.vercel.app                    │
└────────────────────┬────────────────────────────────────────────┘
                     │ HTTPS / REST + JWT Bearer
┌────────────────────▼────────────────────────────────────────────┐
│  FastAPI Backend (Python 3.11)                                   │
│  Railway — https://foundrycrm-production.up.railway.app         │
│  ├── app/routers/       (one file per domain)                    │
│  ├── app/services/      (PDF generators, NIC client)             │
│  ├── app/models/        (Pydantic v2 schemas)                    │
│  ├── app/auth.py        (JWT decode, require_roles)              │
│  └── app/db/client.py   (supabase-py singleton)                 │
└──────────┬──────────────────────────────┬───────────────────────┘
           │ supabase-py (REST + PostgREST)│ Supabase Admin API
┌──────────▼──────────────────────────────▼───────────────────────┐
│  Supabase (PostgreSQL 15)                                        │
│  ├── Auth (JWT, user profiles)                                   │
│  ├── Storage (company-assets bucket)                             │
│  ├── PostgREST (auto-generated REST on all tables)               │
│  └── RLS (Row-Level Security on all 19 tables)                   │
└─────────────────────────────────────────────────────────────────┘
```

**Key constraints inherited from Phase 1:**
- supabase-py does NOT support explicit `BEGIN / COMMIT` transactions. Multi-table atomic writes must use Supabase RPC (PostgreSQL stored procedures).
- Service-role key (`SUPABASE_SERVICE_KEY`) is backend-only — never sent to frontend.
- Frontend authenticates via Supabase Auth; JWT is forwarded as `Authorization: Bearer <token>` to FastAPI.

---

## 2. Phase 2 New File Structure

### Backend additions

```
backend/app/
├── routers/
│   ├── credit_notes.py       ← Sprint 2 (ERP-202/203)
│   ├── proforma.py           ← Sprint 4 (ERP-402)
│   ├── delivery_challans.py  ← Sprint 4 (ERP-405)
│   ├── advance_receipts.py   ← Sprint 5 (ERP-502)
│   ├── bom.py                ← Sprint 5 (ERP-507)
│   ├── work_orders.py        ← Sprint 6 (ERP-602)
│   ├── reports.py            ← Sprint 3 (ERP-302/304/306)
│   └── grns.py               ← Sprint 1 (ERP-103, extracted from purchase_orders.py)
├── services/
│   ├── pdf.py                (existing invoice PDF)
│   ├── quotation_pdf.py      (existing)
│   ├── credit_note_pdf.py    ← Sprint 2
│   ├── proforma_pdf.py       ← Sprint 4
│   ├── delivery_challan_pdf.py ← Sprint 4
│   ├── grn_pdf.py            ← Sprint 1
│   ├── gstr1.py              ← Sprint 3 (GSTR-1 computation + JSON build)
│   └── gstr3b.py             ← Sprint 3
├── models/
│   ├── credit_note.py
│   ├── proforma.py
│   ├── delivery_challan.py
│   ├── advance_receipt.py
│   ├── bom.py
│   └── work_order.py
└── main.py                   (register all new routers here)
```

### Frontend additions

```
frontend/src/pages/
├── CreditNotes/
│   └── index.jsx             (list + CNForm modal)
├── ProformaInvoices/
│   └── index.jsx
├── DeliveryChallans/
│   └── index.jsx
├── GRNs/
│   └── index.jsx
├── AdvanceReceipts/
│   └── index.jsx
├── BOM/
│   └── index.jsx
├── WorkOrders/
│   └── index.jsx
└── Reports/
    ├── index.jsx             (report selector / landing)
    ├── Gstr1.jsx
    ├── Gstr3b.jsx
    ├── ReceivablesAging.jsx
    └── PayablesAging.jsx
```

---

## 3. Database Schema — Phase 2 Migrations

All migrations go in `supabase/migrations/`. Convention: `00N_description.sql`.

### Migration 006 — Credit Notes

```sql
CREATE SEQUENCE cn_seq START 5001;

CREATE TABLE credit_notes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cn_no        TEXT        NOT NULL UNIQUE DEFAULT 'CN-' || nextval('cn_seq'),
  invoice_id   UUID        REFERENCES invoices(id) ON DELETE SET NULL,
  company_id   UUID        NOT NULL REFERENCES companies(id),
  date         DATE        NOT NULL,
  reason       TEXT,
  taxable_amt  NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_gst    NUMERIC(12,2) NOT NULL DEFAULT 0,
  cgst_amt     NUMERIC(12,2) NOT NULL DEFAULT 0,
  sgst_amt     NUMERIC(12,2) NOT NULL DEFAULT 0,
  igst_amt     NUMERIC(12,2) NOT NULL DEFAULT 0,
  total        NUMERIC(12,2) NOT NULL DEFAULT 0,
  status       TEXT        NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft','issued','cancelled')),
  created_by   UUID        REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE credit_note_items (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cn_id          UUID        NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
  product_id     UUID        REFERENCES products(id),
  description    TEXT        NOT NULL,
  hsn_code       TEXT,
  uom            TEXT,
  qty            NUMERIC(10,3) NOT NULL,
  rate           NUMERIC(12,2) NOT NULL,
  gst_rate       NUMERIC(5,2) NOT NULL DEFAULT 0,
  taxable_amt    NUMERIC(12,2) NOT NULL,
  cgst_amt       NUMERIC(12,2) NOT NULL DEFAULT 0,
  sgst_amt       NUMERIC(12,2) NOT NULL DEFAULT 0,
  igst_amt       NUMERIC(12,2) NOT NULL DEFAULT 0,
  total          NUMERIC(12,2) NOT NULL,
  sort_order     INT DEFAULT 0
);

-- RLS
ALTER TABLE credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_note_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_cn" ON credit_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_cn_items" ON credit_note_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

### Migration 007 — Customer Ledger

```sql
CREATE TABLE customer_ledger (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID        NOT NULL REFERENCES companies(id),
  doc_type    TEXT        NOT NULL
              CHECK (doc_type IN ('invoice','payment','cn','advance','opening','adjustment')),
  doc_id      UUID,
  doc_no      TEXT,
  doc_date    DATE,
  debit       NUMERIC(12,2) NOT NULL DEFAULT 0,
  credit      NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ledger_company ON customer_ledger(company_id, doc_date);

-- Backfill existing invoices as debit entries
INSERT INTO customer_ledger (company_id, doc_type, doc_id, doc_no, doc_date, debit)
SELECT company_id, 'invoice', id, inv_no, date, total
FROM invoices WHERE status NOT IN ('cancelled');

-- Backfill existing payments as credit entries
INSERT INTO customer_ledger (company_id, doc_type, doc_id, doc_no, doc_date, credit)
SELECT i.company_id, 'payment', p.id, p.payment_no, p.date, p.amount
FROM payments p JOIN invoices i ON i.id = p.invoice_id;

ALTER TABLE customer_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_ledger" ON customer_ledger FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

### Migration 008 — Advance Receipts

```sql
CREATE SEQUENCE ar_seq START 6001;

CREATE TABLE advance_receipts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ar_no         TEXT        NOT NULL UNIQUE DEFAULT 'AR-' || nextval('ar_seq'),
  company_id    UUID        NOT NULL REFERENCES companies(id),
  date          DATE        NOT NULL,
  amount        NUMERIC(12,2) NOT NULL,
  applied_amt   NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_mode  TEXT        NOT NULL DEFAULT 'bank'
                            CHECK (payment_mode IN ('bank','cash','cheque','upi')),
  is_pdc        BOOLEAN     NOT NULL DEFAULT false,
  cheque_date   DATE,
  cheque_no     TEXT,
  notes         TEXT,
  created_by    UUID        REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE advance_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_ar" ON advance_receipts FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

### Migration 009 — Proforma Invoices

```sql
CREATE SEQUENCE pi_seq START 7001;

CREATE TABLE proforma_invoices (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pi_no         TEXT        NOT NULL UNIQUE DEFAULT 'PI-' || nextval('pi_seq'),
  company_id    UUID        NOT NULL REFERENCES companies(id),
  date          DATE        NOT NULL,
  valid_until   DATE,
  place_of_supply TEXT      NOT NULL DEFAULT '27',
  taxable_amt   NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_gst     NUMERIC(12,2) NOT NULL DEFAULT 0,
  total         NUMERIC(12,2) NOT NULL DEFAULT 0,
  status        TEXT        NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft','sent','converted','cancelled')),
  converted_invoice_id UUID REFERENCES invoices(id),
  notes         TEXT,
  terms         TEXT,
  created_by    UUID        REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE proforma_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pi_id       UUID NOT NULL REFERENCES proforma_invoices(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES products(id),
  description TEXT NOT NULL,
  hsn_code    TEXT,
  uom         TEXT,
  qty         NUMERIC(10,3) NOT NULL,
  rate        NUMERIC(12,2) NOT NULL,
  gst_rate    NUMERIC(5,2) NOT NULL DEFAULT 0,
  sort_order  INT DEFAULT 0
);

ALTER TABLE proforma_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE proforma_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_pi" ON proforma_invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_pi_items" ON proforma_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

### Migration 010 — Delivery Challans

```sql
CREATE SEQUENCE dc_seq START 8001;

CREATE TABLE delivery_challans (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dc_no          TEXT        NOT NULL UNIQUE DEFAULT 'DC-' || nextval('dc_seq'),
  company_id     UUID        NOT NULL REFERENCES companies(id),
  so_id          UUID        REFERENCES sales_orders(id),
  date           DATE        NOT NULL,
  vehicle_no     TEXT,
  transporter    TEXT,
  status         TEXT        NOT NULL DEFAULT 'draft'
                             CHECK (status IN ('draft','dispatched','delivered')),
  notes          TEXT,
  created_by     UUID        REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE dc_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dc_id       UUID NOT NULL REFERENCES delivery_challans(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES products(id),
  description TEXT NOT NULL,
  hsn_code    TEXT,
  uom         TEXT,
  qty         NUMERIC(10,3) NOT NULL,
  sort_order  INT DEFAULT 0
);

ALTER TABLE delivery_challans ENABLE ROW LEVEL SECURITY;
ALTER TABLE dc_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_dc" ON delivery_challans FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_dc_items" ON dc_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

### Migration 011 — GRN Sequential Numbering

```sql
-- Add sequence and grn_no column to existing grn table
CREATE SEQUENCE grn_seq START 9001;

ALTER TABLE grn ADD COLUMN IF NOT EXISTS grn_no TEXT;

-- Backfill existing GRNs with legacy prefix so they don't collide
UPDATE grn SET grn_no = 'GRN-LEGACY-' || id::text WHERE grn_no IS NULL;

-- Future inserts: trigger sets grn_no from sequence
CREATE OR REPLACE FUNCTION set_grn_no()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.grn_no IS NULL THEN
    NEW.grn_no := 'GRN-' || nextval('grn_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER grn_no_trigger
  BEFORE INSERT ON grn
  FOR EACH ROW EXECUTE FUNCTION set_grn_no();
```

### Migration 012 — BOM

```sql
CREATE TABLE bom_headers (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID        NOT NULL REFERENCES products(id),
  version     INT         NOT NULL DEFAULT 1,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  notes       TEXT,
  created_by  UUID        REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (product_id, version)
);

CREATE TABLE bom_items (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id          UUID        NOT NULL REFERENCES bom_headers(id) ON DELETE CASCADE,
  component_id    UUID        NOT NULL REFERENCES products(id),
  qty_per_unit    NUMERIC(10,4) NOT NULL,
  uom             TEXT        NOT NULL,
  sort_order      INT         DEFAULT 0
);

ALTER TABLE bom_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_bom" ON bom_headers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_bom_items" ON bom_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

### Migration 013 — Work Orders

```sql
CREATE SEQUENCE wo_seq START 1001;

CREATE TABLE work_orders (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_no        TEXT        NOT NULL UNIQUE DEFAULT 'WO-' || nextval('wo_seq'),
  so_id        UUID        REFERENCES sales_orders(id),
  so_item_id   UUID,
  product_id   UUID        NOT NULL REFERENCES products(id),
  bom_id       UUID        REFERENCES bom_headers(id),
  qty          NUMERIC(10,3) NOT NULL,
  start_date   DATE,
  target_date  DATE,
  completed_at TIMESTAMPTZ,
  assigned_to  UUID        REFERENCES auth.users(id),
  status       TEXT        NOT NULL DEFAULT 'open'
               CHECK (status IN ('open','in_progress','done','cancelled')),
  notes        TEXT,
  created_by   UUID        REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- stock_ledger: add 'production' and 'production_output' to txn_type enum
ALTER TABLE stock_ledger
  DROP CONSTRAINT IF EXISTS stock_ledger_txn_type_check;
ALTER TABLE stock_ledger
  ADD CONSTRAINT stock_ledger_txn_type_check
  CHECK (txn_type IN ('purchase','sale','adjustment','opening','production','production_output'));

ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_wo" ON work_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

### Migration 014 — Settings additions

```sql
-- NIC environment toggle
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS einvoice_env TEXT NOT NULL DEFAULT 'sandbox'
  CHECK (einvoice_env IN ('sandbox', 'production'));

-- User active flag
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
```

---

## 4. API Design

### 4.1 Router registration (`main.py`)

```python
from app.routers import (
    credit_notes, proforma, delivery_challans,
    advance_receipts, bom, work_orders, reports, grns
)
app.include_router(credit_notes.router, prefix="/api/v1")
app.include_router(proforma.router,     prefix="/api/v1")
app.include_router(delivery_challans.router, prefix="/api/v1")
app.include_router(advance_receipts.router,  prefix="/api/v1")
app.include_router(bom.router,          prefix="/api/v1")
app.include_router(work_orders.router,  prefix="/api/v1")
app.include_router(reports.router,      prefix="/api/v1")
app.include_router(grns.router,         prefix="/api/v1")
```

### 4.2 Full endpoint map (Phase 2 only)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /credit-notes | authenticated | List with company name |
| POST | /credit-notes | admin, accounts | Create CN + update invoice + ledger |
| GET | /credit-notes/{id} | authenticated | Detail with items |
| GET | /credit-notes/{id}/pdf | authenticated | PDF bytes |
| POST | /credit-notes/{id}/cancel | admin | Cancel CN, reverse ledger |
| GET | /grns | authenticated | List all GRNs (new dedicated list) |
| GET | /grns/{id}/pdf | authenticated | GRN PDF |
| GET | /customers/{id}/ledger | authenticated | Ledger rows + running balance |
| POST | /customers/{id}/ledger/opening | admin, accounts | Set opening balance |
| GET | /advance-receipts | authenticated | List by company_id |
| POST | /advance-receipts | admin, accounts | Create advance + ledger credit |
| GET | /advance-receipts/available?company_id= | authenticated | Available (unapplied) credit |
| GET | /proforma | authenticated | List |
| POST | /proforma | admin, sales | Create |
| GET | /proforma/{id} | authenticated | Detail |
| GET | /proforma/{id}/pdf | authenticated | PDF |
| POST | /proforma/{id}/convert | admin, sales | Convert to invoice |
| GET | /delivery-challans | authenticated | List |
| POST | /delivery-challans | admin, sales, accounts | Create |
| GET | /delivery-challans/{id}/pdf | authenticated | PDF |
| GET | /bom | authenticated | List (optionally filter by product_id) |
| POST | /bom | admin | Create BOM (first version) |
| PUT | /bom/{id} | admin | Create new version |
| GET | /bom/{id} | authenticated | Detail with components + current stock |
| GET | /work-orders | authenticated | List |
| POST | /work-orders | admin, accounts | Create WO |
| GET | /work-orders/{id} | authenticated | Detail + BOM requirements + stock |
| PUT | /work-orders/{id} | admin | Update status / assign |
| POST | /work-orders/{id}/complete | admin | Complete WO → deduct stock (RPC) |
| GET | /reports/gstr1 | admin, accounts | GSTR-1 data for month/year |
| GET | /reports/gstr1/excel | admin, accounts | .xlsx download |
| GET | /reports/gstr1/json | admin, accounts | NIC JSON download |
| GET | /reports/gstr3b | admin, accounts | GSTR-3B summary |
| GET | /reports/gstr3b/excel | admin, accounts | .xlsx download |
| GET | /reports/aging/receivables | admin, accounts | Receivables aging |
| GET | /reports/aging/receivables/csv | admin, accounts | CSV download |
| GET | /reports/aging/payables | admin, accounts | Payables aging |
| POST | /settings/users | admin | Create new user (Supabase Admin API) |
| PUT | /settings/users/{id}/deactivate | admin | Set is_active = false |

---

## 5. Architectural Decision Records (ADRs)

### ADR-001: Customer Ledger — Append-Only Event Table (not View)

**Decision:** Use `customer_ledger` as an **append-only event table** (one row per financial event), not a PostgreSQL view or materialized view.

**Rationale:**
- A view over invoices + payments + CNs + advances requires complex UNION and will be slow as data grows
- Append-only table allows arbitrary opening balance entries (`doc_type = 'opening'`)
- Running balance computed server-side per query (`SUM(debit) - SUM(credit)`) — simple and fast with the `(company_id, doc_date)` index
- Every write operation that creates a financial event (invoice create, payment record, CN issue, advance record) must also write a ledger row

**Trade-off:** Risk of ledger drift if a write succeeds but the ledger insert fails. Mitigated by ADR-002 (use RPC for atomic writes).

---

### ADR-002: Multi-Table Atomicity via Supabase RPC

**Decision:** Any operation that writes to 2+ tables atomically must use a **PostgreSQL stored procedure** called via `supabase.rpc()`.

**Affected operations:**
1. **CN issue** → updates `invoices.balance_due` + inserts `customer_ledger` credit row
2. **Work Order complete** → inserts `stock_ledger` rows (one per component) + `work_orders.status = done`
3. **Apply advance to payment** → updates `advance_receipts.applied_amt` + inserts payment + inserts ledger rows + updates `invoices.balance_due`

**Implementation pattern:**
```python
# In router:
result = db.rpc("complete_work_order", {"p_wo_id": str(wo_id), "p_user_id": user["id"]}).execute()

# In Supabase SQL (migration):
CREATE OR REPLACE FUNCTION complete_work_order(p_wo_id UUID, p_user_id UUID)
RETURNS JSON LANGUAGE plpgsql AS $$
DECLARE
  wo work_orders%ROWTYPE;
BEGIN
  SELECT * INTO wo FROM work_orders WHERE id = p_wo_id FOR UPDATE;
  -- insert stock_ledger rows for each BOM component
  -- update work_orders.status = 'done'
  -- return summary
END;
$$;
```

**Trade-off:** Logic lives in DB rather than Python. Mitigated by keeping RPC functions thin (data manipulation only, no business logic); business rules validated in Python before calling RPC.

---

### ADR-003: Number Series — DB Sequences Only

**Decision:** All document number sequences (cn_seq, ar_seq, pi_seq, dc_seq, grn_seq, wo_seq) are **PostgreSQL SEQUENCE objects**. No application-level counters, no `MAX(id) + 1`, no UUID-based numbering.

**Rationale:** Sequences are atomic, gap-safe under concurrent inserts, and survive application restarts. `MAX(id) + 1` has a race condition under concurrent writes.

**Pattern:** Default value on the column, set via trigger or column default:
```sql
DEFAULT 'CN-' || nextval('cn_seq')
```

---

### ADR-004: PDF Generation — One Service Module Per Document Type

**Decision:** Each document type has its own file in `backend/app/services/`:
- `pdf.py` — Invoice (existing)
- `quotation_pdf.py` — Quotation (existing)
- `credit_note_pdf.py` — Credit Note
- `proforma_pdf.py` — Proforma Invoice
- `delivery_challan_pdf.py` — Delivery Challan
- `grn_pdf.py` — GRN

**Rationale:** ReportLab document assembly is verbose. Sharing one mega-file creates merge conflicts and makes individual documents hard to iterate on. A shared `_pdf_utils.py` can hold the logo-fetch helper, company header builder, and common styles.

**Shared utilities** (`backend/app/services/_pdf_utils.py`):
```python
def get_company_settings() -> dict: ...
def fetch_logo(logo_url: str) -> Image | None: ...
def build_header_table(our: dict, doc_meta: dict) -> Table: ...
BLUE = colors.HexColor("#2563eb")
STYLES = getSampleStyleSheet()
```

---

### ADR-005: GSTR-1 JSON Format

**Decision:** Build GSTR-1 JSON in Python as a dict following the **NIC GSTR-1 schema v1.1**. Validate structure before returning; return HTTP 422 with field-level errors if validation fails.

**Key sections of NIC GSTR-1 JSON:**
```json
{
  "gstin": "27XXXXX",
  "fp": "052026",
  "b2b": [ { "ctin": "...", "inv": [...] } ],
  "b2cs": [ { "typ": "OE", "pos": "27", "rt": 18, "txval": 0, "iamt": 0 } ],
  "cdnr": [ { "ctin": "...", "nt": [...] } ]
}
```

Use `openpyxl` for Excel, `json.dumps` + `Response(media_type="application/json")` for JSON download.

---

### ADR-006: NIC E-Invoice Environment

**Decision:** Replace the hardcoded `NIC_EINVOICE_BASE_URL` environment variable with a **per-company DB setting** (`company_settings.einvoice_env`).

**Implementation:**
```python
# nic_client.py
def get_nic_base_url() -> str:
    settings = get_db().table("company_settings").select("einvoice_env").limit(1).execute().data
    env = (settings[0].get("einvoice_env") if settings else None) or "sandbox"
    return NIC_SANDBOX_URL if env == "sandbox" else NIC_PROD_URL
```

Backend reads this on every IRN request — no caching (avoids stale URL after toggle).

---

### ADR-007: User Management via Supabase Admin API

**Decision:** New user creation uses the **Supabase Admin client** (initialised with the service-role key) rather than Supabase Auth invite emails.

**Rationale:** Owner wants to set passwords directly (Clarification H1: admin creates credentials, no magic link).

**Pattern:**
```python
# backend/app/db/client.py — add admin client
from supabase import create_client
admin_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# settings.py router
admin_client.auth.admin.create_user({
    "email": payload.email,
    "password": payload.password,
    "email_confirm": True,
    "user_metadata": {"full_name": payload.name}
})
# Then insert profile row
```

**Security:** Service-role key never leaves the backend. Frontend never has access.

---

### ADR-008: Mobile Responsiveness Strategy

**Decision:** Use **Tailwind responsive prefixes** (`sm:`, `md:`) on existing pages rather than separate mobile components. The sidebar becomes a controlled drawer at `< 768px` via a `useSidebar` context hook.

**Breakpoints:**
- `< 768px` (md): mobile — sidebar collapsed, tables show priority columns only
- `>= 768px`: desktop — full layout unchanged

**Priority column pattern for tables:**
```jsx
// Column definition
{ accessorKey: 'inv_no', header: 'Invoice #' },                    // always visible
{ accessorKey: 'total', header: 'Total', meta: { mobileHide: false } },
{ accessorKey: 'due_date', header: 'Due', meta: { mobileHide: true } }, // hidden on mobile
```

Use `useMediaQuery('(max-width: 768px)')` hook to conditionally pass filtered columns to DataTable.

---

## 6. Frontend Architecture Patterns

### 6.1 API client (`frontend/src/lib/api.js`) additions

```js
export const creditNotesApi = {
  list:        () => api.get('/api/v1/credit-notes'),
  get:         (id) => api.get(`/api/v1/credit-notes/${id}`),
  create:      (data) => api.post('/api/v1/credit-notes', data),
  cancel:      (id) => api.post(`/api/v1/credit-notes/${id}/cancel`),
  downloadPdf: (id) => api.get(`/api/v1/credit-notes/${id}/pdf`, { responseType: 'blob' }),
}
export const proformaApi = {
  list:    () => api.get('/api/v1/proforma'),
  create:  (data) => api.post('/api/v1/proforma', data),
  convert: (id) => api.post(`/api/v1/proforma/${id}/convert`),
  downloadPdf: (id) => api.get(`/api/v1/proforma/${id}/pdf`, { responseType: 'blob' }),
}
export const deliveryChallansApi = { ... }
export const advanceReceiptsApi = { ... }
export const bomApi = { ... }
export const workOrdersApi = { ... }
export const reportsApi = {
  gstr1:              (month, year) => api.get(`/api/v1/reports/gstr1?month=${month}&year=${year}`),
  gstr1Excel:         (month, year) => api.get(`/api/v1/reports/gstr1/excel?month=${month}&year=${year}`, { responseType: 'blob' }),
  gstr1Json:          (month, year) => api.get(`/api/v1/reports/gstr1/json?month=${month}&year=${year}`, { responseType: 'blob' }),
  gstr3b:             (month, year) => api.get(`/api/v1/reports/gstr3b?month=${month}&year=${year}`),
  receivablesAging:   (asOf) => api.get(`/api/v1/reports/aging/receivables?as_of=${asOf}`),
  payablesAging:      (asOf) => api.get(`/api/v1/reports/aging/payables?as_of=${asOf}`),
}
```

### 6.2 React Query key conventions

```js
// Consistent query key patterns
['credit-notes']           // list
['credit-notes', id]       // single
['customer-ledger', companyId]
['reports', 'gstr1', month, year]
['reports', 'aging', 'receivables', asOf]
['bom', productId]
['work-orders']
['work-orders', id]
```

### 6.3 Pydantic model pattern (backend)

Every new router follows the same `ModelIn / ModelOut` pattern as existing routers:

```python
# models/credit_note.py
class CreditNoteItemIn(BaseModel):
    product_id: UUID | None = None
    description: str
    hsn_code: str | None = None
    uom: str | None = None
    qty: Decimal
    rate: Decimal
    gst_rate: Decimal = Decimal("0")

class CreditNoteIn(BaseModel):
    invoice_id: UUID | None = None
    company_id: UUID
    date: date
    reason: str | None = None
    items: list[CreditNoteItemIn]
```

---

## 7. Supabase RPC Functions (Migration 015)

These are the stored procedures required by ADR-002. All go in `supabase/migrations/015_rpc_functions.sql`.

### issue_credit_note

```sql
CREATE OR REPLACE FUNCTION issue_credit_note(
  p_cn_id UUID,
  p_invoice_id UUID,
  p_company_id UUID,
  p_cn_total NUMERIC
) RETURNS JSON LANGUAGE plpgsql AS $$
BEGIN
  -- Update invoice balance_due
  UPDATE invoices
  SET balance_due = GREATEST(0, balance_due - p_cn_total),
      status = CASE
        WHEN GREATEST(0, balance_due - p_cn_total) = 0 THEN 'paid'
        ELSE status
      END
  WHERE id = p_invoice_id;

  -- Insert customer ledger credit
  INSERT INTO customer_ledger (company_id, doc_type, doc_id, doc_no, doc_date, credit)
  SELECT p_company_id, 'cn', p_cn_id, cn_no, date, p_cn_total
  FROM credit_notes WHERE id = p_cn_id;

  -- Mark CN as issued
  UPDATE credit_notes SET status = 'issued' WHERE id = p_cn_id;

  RETURN json_build_object('success', true);
END;
$$;
```

### complete_work_order

```sql
CREATE OR REPLACE FUNCTION complete_work_order(
  p_wo_id UUID,
  p_user_id UUID
) RETURNS JSON LANGUAGE plpgsql AS $$
DECLARE
  wo work_orders%ROWTYPE;
  bom_item RECORD;
  component_stock NUMERIC;
BEGIN
  SELECT * INTO wo FROM work_orders WHERE id = p_wo_id FOR UPDATE;
  IF wo.status = 'done' THEN
    RAISE EXCEPTION 'Work order already completed';
  END IF;

  -- Deduct raw material components from stock
  FOR bom_item IN
    SELECT bi.component_id, bi.qty_per_unit * wo.qty AS total_qty, bi.uom
    FROM bom_items bi WHERE bi.bom_id = wo.bom_id
  LOOP
    INSERT INTO stock_ledger (product_id, txn_type, qty, ref_id, notes)
    VALUES (bom_item.component_id, 'production', -bom_item.total_qty, p_wo_id,
            'WO-' || wo.wo_no || ' consumption');
  END LOOP;

  -- Add finished product to stock
  INSERT INTO stock_ledger (product_id, txn_type, qty, ref_id, notes)
  VALUES (wo.product_id, 'production_output', wo.qty, p_wo_id, 'WO-' || wo.wo_no || ' output');

  -- Mark WO done
  UPDATE work_orders SET status = 'done', completed_at = now() WHERE id = p_wo_id;

  RETURN json_build_object('success', true, 'wo_no', wo.wo_no);
END;
$$;
```

### apply_advance_to_invoice

```sql
CREATE OR REPLACE FUNCTION apply_advance_to_invoice(
  p_invoice_id UUID,
  p_advance_id UUID,
  p_advance_apply_amt NUMERIC,
  p_new_payment_amt NUMERIC,
  p_payment_mode TEXT,
  p_payment_date DATE,
  p_user_id UUID
) RETURNS JSON LANGUAGE plpgsql AS $$
DECLARE
  inv invoices%ROWTYPE;
BEGIN
  SELECT * INTO inv FROM invoices WHERE id = p_invoice_id FOR UPDATE;

  -- Record bank/cash payment if any
  IF p_new_payment_amt > 0 THEN
    INSERT INTO payments (invoice_id, amount, payment_mode, date)
    VALUES (p_invoice_id, p_new_payment_amt, p_payment_mode, p_payment_date);
    INSERT INTO customer_ledger (company_id, doc_type, doc_id, doc_date, credit)
    VALUES (inv.company_id, 'payment', p_invoice_id, p_payment_date, p_new_payment_amt);
  END IF;

  -- Apply advance
  IF p_advance_apply_amt > 0 THEN
    UPDATE advance_receipts
    SET applied_amt = applied_amt + p_advance_apply_amt
    WHERE id = p_advance_id;
    INSERT INTO customer_ledger (company_id, doc_type, doc_id, doc_date, debit)
    VALUES (inv.company_id, 'advance', p_advance_id, p_payment_date, p_advance_apply_amt);
  END IF;

  -- Update invoice balance
  UPDATE invoices
  SET balance_due = GREATEST(0, balance_due - p_new_payment_amt - p_advance_apply_amt),
      status = CASE WHEN GREATEST(0, balance_due - p_new_payment_amt - p_advance_apply_amt) = 0
                    THEN 'paid' ELSE status END
  WHERE id = p_invoice_id;

  RETURN json_build_object('success', true);
END;
$$;
```

---

## 8. Security Checklist

All new endpoints must satisfy:

- [ ] `Depends(get_current_user)` on all read endpoints
- [ ] `Depends(require_roles(...))` on all write/mutate endpoints
- [ ] `is_active` check in `get_current_user` (returns 403 for deactivated users)
- [ ] RLS enabled on all new tables (see migration SQL above)
- [ ] No raw user input passed to SQL strings (use supabase-py parameterised calls only)
- [ ] Service-role key used only in `admin_client` for user management — never exposed
- [ ] PDF endpoints do not expose other companies' data (filter by company in query)

---

## 9. Migration Execution Order

```
004_storage_policy.sql    ← existing
005_...                   ← existing
006_credit_notes.sql
007_customer_ledger.sql   ← depends on invoices + payments (backfill)
008_advance_receipts.sql
009_proforma_invoices.sql
010_delivery_challans.sql
011_grn_seq.sql
012_bom.sql
013_work_orders.sql       ← depends on bom_headers
014_settings_additions.sql
015_rpc_functions.sql     ← depends on all tables above
```

Run via Supabase CLI: `supabase db push` or apply in Supabase Studio SQL editor in order.

---

*End of ARCHITECTURE.md v1.0 — Developer may begin Sprint 1 (ERP-101 through ERP-108) immediately. Sprint 2 requires Migration 006 + 007 to be applied first.*
