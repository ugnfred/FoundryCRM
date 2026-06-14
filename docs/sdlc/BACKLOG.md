# Product Backlog — Foundry ERP Phase 2
**Role:** Scrum Master
**Version:** 1.0
**Date:** 2026-06-14
**BRD:** v1.0 (approved 2026-06-14)
**Sprint length:** 2 weeks
**Team velocity estimate:** 40 story points / sprint

Story points follow Fibonacci scale: 1 = trivial config, 2 = small change, 3 = self-contained feature, 5 = moderate, 8 = complex multi-layer, 13 = cross-cutting or high-uncertainty.

---

## Sprint 1 — Foundation & Quick Wins
*Goal: Fix broken navigation, harden GRN, flip e-invoice to prod, add user management. No new data models. All items are self-contained.*

| ID | Title | Type | BRD | Points | Dependencies |
|---|---|---|---|---|---|
| ERP-101 | Fix Invoice ↔ SO clickable navigation links | Bug | FR-043–045 | 3 | — |
| ERP-102 | GRN sequential numbering (GRN-XXXX from DB sequence) | Task | FR-039 | 2 | — |
| ERP-103 | GRN list page (own route + DataTable) | Story | FR-040 | 3 | ERP-102 |
| ERP-104 | Multiple GRNs per PO in UI | Story | FR-041 | 3 | ERP-102 |
| ERP-105 | GRN PDF (header "GOODS RECEIPT NOTE", items + signature line) | Story | FR-042 | 3 | ERP-102 |
| ERP-106 | NIC e-invoice environment toggle in Settings | Story | FR-046–048 | 3 | — |
| ERP-107 | Admin: create new user (name / email / password / role) | Story | FR-063–064 | 5 | — |
| ERP-108 | Admin: deactivate user (is_active flag, blocks login) | Story | FR-065–066 | 3 | ERP-107 |

**Sprint 1 total: 25 pts** *(buffer for testing and QA)*

### ERP-101: Fix Invoice ↔ SO clickable navigation links
**Description:** Invoice list shows SO number; clicking navigates to SOs page with that row highlighted. SO list shows invoice count as a link; clicking filters Invoices by that SO.
**Acceptance criteria:**
- [ ] Invoice list: "Sales Order" column shows SO number as a blue link when `so_id` is set; shows `—` otherwise
- [ ] Clicking SO link opens `/sales-orders` and highlights (or filters to) that SO row
- [ ] SO list: "Invoices" column shows count badge (e.g. "2"); clicking opens `/invoices?so_id=<id>`
- [ ] Navigation works for invoices created from SO prefill AND invoices with `so_id` set manually
- [ ] No regression: invoices without SO still display correctly

### ERP-102: GRN sequential numbering
**Description:** Replace current random 6-digit GRN# with DB sequence `grn_seq` starting at 9001. Format: `GRN-9001`.
**Acceptance criteria:**
- [ ] Migration creates sequence `grn_seq` start 9001
- [ ] `create_grn` backend sets `grn_no = f"GRN-{nextval('grn_seq')}"`
- [ ] Existing GRNs retain their old numbers (migration does not backfill)
- [ ] New GRNs show GRN-XXXX format

### ERP-103: GRN list page
**Description:** New route `/grns`. DataTable with columns: GRN#, PO#, Supplier, Received Date, Status. Filter by supplier.
**Acceptance criteria:**
- [ ] Sidebar link "GRN" added under Purchases section
- [ ] Lists all GRNs newest-first
- [ ] Supplier name and PO number are shown (joined from DB)
- [ ] Empty state: "No goods receipts yet"
- [ ] Clicking a row shows GRN detail (modal or detail panel)

### ERP-104: Multiple GRNs per PO in UI
**Description:** PO detail / list action allows creating a new GRN even if one already exists (as long as PO is not fully received).
**Acceptance criteria:**
- [ ] "GRN" button on PO shows when status = sent or partial
- [ ] GRN form shows remaining qty per item (ordered minus already received)
- [ ] After GRN save: PO status = `partial` if any items still outstanding; `received` if all done
- [ ] PO list shows total received vs ordered in a "Received" column

### ERP-105: GRN PDF
**Description:** `GET /api/v1/grns/{id}/pdf` returns a PDF with header "GOODS RECEIPT NOTE", PO reference, supplier, items with qty received, and a signature/acknowledgement block.
**Acceptance criteria:**
- [ ] PDF header: "GOODS RECEIPT NOTE" (blue bar, same style as Invoice PDF)
- [ ] Shows: GRN#, PO#, Supplier name, Received date, our company name
- [ ] Items table: description, HSN, UOM, ordered qty, received qty
- [ ] Footer: "Received by: __________ Date: __________  Store Keeper Signature: __________"
- [ ] Download button on GRN list row and GRN detail

### ERP-106: NIC e-invoice environment toggle
**Description:** Settings → Company tab: radio/toggle "E-Invoice Mode: Sandbox | Production". Stored in `company_settings.einvoice_env`. Backend reads this to select NIC base URL.
**Acceptance criteria:**
- [ ] Migration adds `einvoice_env VARCHAR DEFAULT 'sandbox'` to company_settings
- [ ] Settings UI shows the toggle (default: Sandbox)
- [ ] Switching to Production shows confirmation dialog: "You are switching to PRODUCTION. Real IRNs will be generated and cannot be test-cancelled. Confirm?"
- [ ] Backend `nic_client.py` reads `einvoice_env` from company_settings instead of hardcoded env var
- [ ] Sandbox: uses NIC sandbox URL; Production: uses NIC prod URL

### ERP-107: Admin — create new user
**Description:** Settings → Users tab. Admin enters name, email, temporary password, role. Creates Supabase Auth user + profiles record.
**Acceptance criteria:**
- [ ] "Users" tab visible only to admin role
- [ ] Form: Full Name, Email, Password, Role (dropdown: admin/sales/accounts/dispatch)
- [ ] On submit: calls `POST /api/v1/settings/users` which uses Supabase service-role client to create auth user + insert profile row
- [ ] Success: user appears in user list; can log in immediately
- [ ] Validation: email unique, password min 8 chars
- [ ] Service-role key used only server-side (never exposed to frontend)

### ERP-108: Admin — deactivate user
**Description:** User list row has "Deactivate" button. Sets `profiles.is_active = false`. Backend rejects JWT tokens from inactive users.
**Acceptance criteria:**
- [ ] "Deactivate" button on each user row (except the currently logged-in admin)
- [ ] Confirmation dialog: "Deactivate [name]? They will no longer be able to log in."
- [ ] Backend `get_current_user` checks `is_active`; returns 403 if false
- [ ] Deactivated user's records (invoices, payments etc.) remain intact
- [ ] Deactivated users show "Inactive" badge in list; can be reactivated

---

## Sprint 2 — Credit Notes & Customer Ledger
*Goal: Enable CN issuance and customer balance tracking — MVP blockers for first real customer.*

| ID | Title | Type | BRD | Points | Dependencies |
|---|---|---|---|---|---|
| ERP-201 | DB schema: credit_notes + credit_note_items + cn_seq | Task | FR-001–008 | 3 | — |
| ERP-202 | Backend CRUD: POST/GET credit notes | Story | FR-001–004 | 5 | ERP-201 |
| ERP-203 | Backend: CN reduces invoice balance_due + ledger entry | Story | FR-004 | 5 | ERP-202 |
| ERP-204 | Credit Note PDF (header "CREDIT NOTE", reversed GST) | Story | FR-006 | 5 | ERP-202 |
| ERP-205 | Frontend: Credit Notes list page + CN form | Story | FR-001–003 | 8 | ERP-202 |
| ERP-206 | Frontend: "Credit Note" button on Invoice row | Story | FR-001 | 3 | ERP-205 |
| ERP-207 | DB schema + view: customer_ledger | Task | FR-009–012 | 5 | ERP-201 |
| ERP-208 | Backend: GET /customers/{id}/ledger | Story | FR-009–012 | 3 | ERP-207 |
| ERP-209 | Frontend: Customer Ledger modal from Settings → Customers | Story | FR-009–012 | 5 | ERP-208 |

**Sprint 2 total: 42 pts** *(split across 2-week sprint, pair on ERP-203 + ERP-205 in parallel)*

### ERP-201: DB schema — credit_notes
**Migration:** `006_credit_notes.sql`
```sql
CREATE SEQUENCE cn_seq START 5001;
CREATE TABLE credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cn_no TEXT NOT NULL DEFAULT 'CN-' || nextval('cn_seq'),
  invoice_id UUID REFERENCES invoices(id),   -- nullable (standalone CN)
  company_id UUID NOT NULL REFERENCES companies(id),
  date DATE NOT NULL,
  reason TEXT,
  taxable_amt NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_gst  NUMERIC(12,2) NOT NULL DEFAULT 0,
  total      NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',      -- draft | issued | cancelled
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE credit_note_items ( ... same columns as invoice_items ... );
```
**Acceptance criteria:**
- [ ] Migration runs cleanly on empty and populated DB
- [ ] `cn_no` auto-assigned from sequence on insert
- [ ] RLS policies: same pattern as invoices (authenticated read/write, role checks in API)

### ERP-202: Backend CRUD — credit notes
**Acceptance criteria:**
- [ ] `POST /api/v1/credit-notes` — creates CN, calculates GST same as invoice (intra/inter-state from company vs our state)
- [ ] `GET /api/v1/credit-notes` — list with company name joined
- [ ] `GET /api/v1/credit-notes/{id}` — detail with items
- [ ] Only admin + accounts roles can create/edit
- [ ] CN total validated: cannot exceed linked invoice total

### ERP-203: CN → invoice balance + ledger
**Acceptance criteria:**
- [ ] On CN save: `invoices.balance_due -= cn.total`; invoice status recalculated
- [ ] Ledger entry inserted: `{entity_type: 'customer', entity_id: company_id, doc_type: 'cn', doc_id: cn.id, credit: cn.total}`
- [ ] All in a single DB transaction (use Supabase RPC or sequential calls with rollback awareness)
- [ ] If invoice is already fully paid, CN creates standalone credit entry only

### ERP-204: CN PDF
**Acceptance criteria:**
- [ ] PDF header "CREDIT NOTE" (red bar to distinguish from invoice)
- [ ] Shows CN#, date, linked invoice number, reason
- [ ] Items table: same layout as invoice; GST reversed (shows CGST/SGST or IGST depending on state)
- [ ] Total row shows "Credit Amount: ₹X,XXX.XX"
- [ ] `GET /api/v1/credit-notes/{id}/pdf` endpoint

### ERP-205: Credit Notes list + form
**Acceptance criteria:**
- [ ] Sidebar "Credit Notes" link under Sales section
- [ ] List: CN#, Customer, Date, Linked Invoice, Amount, Status
- [ ] "New CN" button opens form
- [ ] Form fields: Customer (required), Linked Invoice (optional — filtered to that customer), Date, Reason, line items
- [ ] If linked invoice selected: line items pre-fill from invoice; qty/rate editable
- [ ] Totals auto-calculate (same GST logic as InvoiceForm)
- [ ] Save → success toast with CN number

### ERP-206: "Credit Note" button on Invoice
**Acceptance criteria:**
- [ ] Invoice list row: "CN" action button (only for status ≠ cancelled)
- [ ] Clicking opens CN form with invoice pre-linked and items pre-filled
- [ ] Works from both Invoice list and Invoice detail view

### ERP-207: Customer Ledger schema
**Migration:** `007_customer_ledger.sql`
```sql
CREATE TABLE customer_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  doc_type TEXT NOT NULL,   -- invoice | payment | cn | advance | opening
  doc_id UUID,
  doc_no TEXT,
  doc_date DATE,
  debit NUMERIC(12,2) DEFAULT 0,
  credit NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- Populate from existing invoices + payments on migration
```
**Acceptance criteria:**
- [ ] Existing invoices backfilled as debit entries
- [ ] Existing payments backfilled as credit entries
- [ ] Running balance calculable via `SUM(debit) - SUM(credit)` per company_id
- [ ] Opening balance: insert a row with `doc_type='opening'` and `credit=<amount>` — editable per customer

### ERP-208: GET /customers/{id}/ledger
**Acceptance criteria:**
- [ ] Returns ledger rows ordered by doc_date ASC
- [ ] Includes running balance computed server-side per row
- [ ] Query params: `from_date`, `to_date` for date range filter
- [ ] Returns customer name and opening balance in response header

### ERP-209: Customer Ledger modal
**Acceptance criteria:**
- [ ] "Ledger" button on each customer row in Settings → Customers
- [ ] Modal: date range picker (default last 90 days) + table: Date | Doc Type | Doc No | Debit | Credit | Balance
- [ ] Doc No is a clickable link (goes to invoice / CN / advance)
- [ ] Footer shows: Total Debit | Total Credit | Closing Balance
- [ ] "Export CSV" button downloads the filtered ledger rows
- [ ] "Set Opening Balance" button allows entering opening balance for migration from Tally

---

## Sprint 3 — GST Reports & Aging
*Goal: GSTR-1, GSTR-3B, Receivables/Payables Aging — last MVP blocker.*

| ID | Title | Type | BRD | Points | Dependencies |
|---|---|---|---|---|---|
| ERP-301 | Reports sidebar section (route, role guard) | Task | FR-034 | 2 | — |
| ERP-302 | Backend: GSTR-1 data computation | Story | FR-029–031 | 8 | — |
| ERP-303 | Frontend: GSTR-1 report page (table + Excel + JSON download) | Story | FR-029–031 | 5 | ERP-302 |
| ERP-304 | Backend: GSTR-3B computation | Story | FR-032–033 | 5 | — |
| ERP-305 | Frontend: GSTR-3B report page + Excel download | Story | FR-032–033 | 3 | ERP-304 |
| ERP-306 | Backend: Receivables Aging computation | Story | FR-035, FR-037 | 5 | — |
| ERP-307 | Frontend: Receivables Aging report page | Story | FR-035, FR-037–038 | 5 | ERP-306 |
| ERP-308 | Backend: Payables Aging computation | Story | FR-036–037 | 3 | ERP-306 |
| ERP-309 | Frontend: Payables Aging report page | Story | FR-036–037 | 3 | ERP-308 |

**Sprint 3 total: 39 pts**

### ERP-302: GSTR-1 backend
**Acceptance criteria:**
- [ ] `GET /api/v1/reports/gstr1?month=5&year=2026` returns structured data
- [ ] Response: `{ b2b: [...], b2c: { taxable, igst, cgst, sgst }, cdnr: [...] }`
- [ ] B2B: per invoice with customer GSTIN; B2C: aggregate by rate slab; CDNR: credit notes
- [ ] `GET /api/v1/reports/gstr1/excel` returns `.xlsx` (use `openpyxl`)
- [ ] `GET /api/v1/reports/gstr1/json` returns NIC-format JSON (schema per GST portal spec v1.1)
- [ ] NIC JSON validated against official schema structure before returning

### ERP-303: GSTR-1 frontend
**Acceptance criteria:**
- [ ] Month/Year picker (defaults to previous month)
- [ ] Three tabs: B2B Invoices | B2C Summary | Credit Notes
- [ ] Summary bar: total taxable, total CGST, total SGST, total IGST
- [ ] "Download Excel" and "Download JSON" buttons
- [ ] Loading state while data fetches; empty state if no invoices in period

### ERP-304: GSTR-3B backend
**Acceptance criteria:**
- [ ] `GET /api/v1/reports/gstr3b?month=5&year=2026`
- [ ] Returns: outward tax liability by GST rate slab (3%, 5%, 12%, 18%, 28%)
- [ ] Returns: inward supplies eligible for ITC (from POs — best-effort, PO line items used)
- [ ] Net tax payable = outward GST − ITC
- [ ] Excel export with standard GSTR-3B table format

### ERP-306: Receivables Aging backend
**Acceptance criteria:**
- [ ] `GET /api/v1/reports/aging/receivables?as_of=2026-06-14`
- [ ] Per customer: outstanding balance split into Current (<= due date), 1–30, 31–60, 61–90, 90+ days past due
- [ ] Uses `balance_due` from invoices (not customer_ledger) for accuracy
- [ ] CSV export endpoint: `GET /api/v1/reports/aging/receivables/csv`

---

## Sprint 4 — Proforma Invoice & Delivery Challan
*Goal: Both are new document types with their own number series and PDFs.*

| ID | Title | Type | BRD | Points | Dependencies |
|---|---|---|---|---|---|
| ERP-401 | DB schema: proforma_invoices + proforma_items + pi_seq | Task | FR-017–022 | 3 | — |
| ERP-402 | Backend: Proforma Invoice CRUD + PDF + convert endpoint | Story | FR-017–022 | 8 | ERP-401 |
| ERP-403 | Frontend: Proforma Invoice list + form + "Convert to Invoice" | Story | FR-017–022 | 8 | ERP-402 |
| ERP-404 | DB schema: delivery_challans + dc_items + dc_seq | Task | FR-023–028 | 3 | — |
| ERP-405 | Backend: Delivery Challan CRUD + PDF | Story | FR-023–028 | 5 | ERP-404 |
| ERP-406 | Frontend: Delivery Challan list + form | Story | FR-023–028 | 8 | ERP-405 |

**Sprint 4 total: 35 pts**

### ERP-402: Proforma Invoice backend
**Acceptance criteria:**
- [ ] `pi_seq` starts at 7001; PI number format `PI-7001`
- [ ] `POST /api/v1/proforma` — create with items; no stock or balance effect
- [ ] `GET /api/v1/proforma/{id}/pdf` — header "PROFORMA INVOICE"; shows PI#, validity date, standard line items with GST; footer "This is not a Tax Invoice"
- [ ] `POST /api/v1/proforma/{id}/convert` — creates invoice from PI items; marks PI status = `converted`; returns new invoice id

### ERP-405: Delivery Challan backend
**Acceptance criteria:**
- [ ] `dc_seq` starts at 8001; DC number format `DC-8001`
- [ ] `POST /api/v1/delivery-challans` — fields: company_id (customer), so_id (optional), vehicle_no, transporter_name, date, items (description, HSN, UOM, qty only — no rate/GST)
- [ ] `GET /api/v1/delivery-challans/{id}/pdf` — header "DELIVERY CHALLAN" (blue bar); items table shows no prices, no GST, no totals; footer: "E. & O.E. — For delivery purposes only"
- [ ] No stock movement, no invoice link created

### ERP-406: Delivery Challan frontend
**Acceptance criteria:**
- [ ] Sidebar "Delivery Challans" under Sales section
- [ ] Form: Customer (required), SO (optional), Date, Vehicle No, Transporter, line items (no Rate / GST columns)
- [ ] List: DC#, Customer, Date, SO#, Status
- [ ] Download PDF button per row

---

## Sprint 5 — Advance / PDC & BOM
*Goal: Financial advances tracking and manufacturing BOM foundations.*

| ID | Title | Type | BRD | Points | Dependencies |
|---|---|---|---|---|---|
| ERP-501 | DB schema: advance_receipts + ar_seq | Task | FR-013–016 | 3 | ERP-207 |
| ERP-502 | Backend: Advance receipt CRUD + ledger entry | Story | FR-013–015 | 5 | ERP-501 |
| ERP-503 | Frontend: Advance Receipt list + form | Story | FR-013–014 | 5 | ERP-502 |
| ERP-504 | Apply advance credit when recording invoice payment | Story | FR-015 | 5 | ERP-502, ERP-209 |
| ERP-505 | PDC flag on advance receipt | Story | FR-016 | 3 | ERP-503 |
| ERP-506 | DB schema: bom_headers + bom_items | Task | FR-049–052 | 3 | — |
| ERP-507 | Backend: BOM CRUD (create, list, version, activate) | Story | FR-049–051 | 5 | ERP-506 |
| ERP-508 | Frontend: BOM list + BOM editor (add/edit components) | Story | FR-049–051 | 8 | ERP-507 |

**Sprint 5 total: 37 pts**

### ERP-502: Advance receipt backend
**Acceptance criteria:**
- [ ] `ar_seq` starts 6001; format `AR-6001`
- [ ] `POST /api/v1/advance-receipts` — fields: company_id, date, amount, payment_mode, notes
- [ ] On create: inserts `customer_ledger` credit entry with `doc_type = 'advance'`
- [ ] `GET /api/v1/advance-receipts?company_id=<id>` — list with available balance (total credits minus applied amounts)

### ERP-504: Apply advance to invoice payment
**Acceptance criteria:**
- [ ] Invoice "Record Payment" modal: if customer has advance credit > 0, shows "Apply Advance Credit: ₹XX,XXX" checkbox
- [ ] User can apply part or all of advance credit; remaining amount entered as new payment
- [ ] On save: advance credit debited from `customer_ledger`; payment entry inserted; invoice balance_due updated
- [ ] Cannot apply more advance than is available; validation on backend

### ERP-507: BOM CRUD backend
**Acceptance criteria:**
- [ ] `POST /api/v1/bom` — create BOM for a product with list of components (product_id, qty, uom)
- [ ] `PUT /api/v1/bom/{id}` — creates a new version (v+1) and marks previous inactive
- [ ] Only one BOM version is `is_active = true` per product at a time
- [ ] `GET /api/v1/bom?product_id=<id>` — returns active BOM with component details

---

## Sprint 6 — Work Orders & Mobile UI
*Goal: Manufacturing core + mobile-first usability.*

| ID | Title | Type | BRD | Points | Dependencies |
|---|---|---|---|---|---|
| ERP-601 | DB schema: work_orders + wo_seq | Task | FR-053–057 | 3 | ERP-506 |
| ERP-602 | Backend: Work Order CRUD + stock-on-hand check | Story | FR-053–056 | 8 | ERP-601, ERP-507 |
| ERP-603 | Backend: WO complete → stock deduction (txn_type=production) | Story | FR-056 | 5 | ERP-602 |
| ERP-604 | Frontend: Work Orders list + WO form (from SO) | Story | FR-053–057 | 8 | ERP-602 |
| ERP-605 | Mobile: Dashboard responsive (2-col stat cards, collapsible chart) | Story | FR-058 | 3 | — |
| ERP-606 | Mobile: Invoice list responsive (priority columns, icon-only buttons) | Story | FR-059 | 3 | — |
| ERP-607 | Mobile: Inventory page responsive | Story | FR-060 | 3 | — |
| ERP-608 | Mobile: Hamburger sidebar on < 768px | Story | FR-061 | 5 | — |
| ERP-609 | Mobile: Modal scroll fix (overflow on mobile) | Bug | FR-062 | 2 | — |

**Sprint 6 total: 40 pts**

### ERP-602: Work Order backend
**Acceptance criteria:**
- [ ] `wo_seq` starts 1001; format `WO-1001`
- [ ] `POST /api/v1/work-orders` — fields: so_id, so_item_id, product_id, qty, start_date, target_date, assigned_to (user_id), status=open
- [ ] `GET /api/v1/work-orders/{id}` — returns WO + BOM requirements + current stock per component
- [ ] BOM requirement = `component.qty * wo.qty` (total material needed)
- [ ] Response includes `shortage` flag per component if `stock_balance < bom_requirement`

### ERP-603: WO completion → stock deduction
**Acceptance criteria:**
- [ ] `POST /api/v1/work-orders/{id}/complete` — status → done
- [ ] Inserts stock ledger entries: one row per BOM component with `txn_type = 'production'`, `qty = -(bom_qty * wo_qty)`
- [ ] Finished product added to stock: `txn_type = 'production_output'`, `qty = +wo_qty`
- [ ] All inserts in single transaction; WO status only changes if stock entries succeed

### ERP-604: Work Orders frontend
**Acceptance criteria:**
- [ ] Sidebar "Work Orders" under Manufacturing section (new section header)
- [ ] List: WO#, Product, SO#, Qty, Status, Target Date; filter by status
- [ ] "Create WO" from SO detail page: pre-fills product and qty from SO line item
- [ ] WO detail: BOM requirements table with stock-on-hand, shortage highlighted red
- [ ] "Mark Complete" button with confirmation dialog; triggers stock deduction
- [ ] Status chip colours: open (grey), in-progress (blue), done (green), cancelled (red)

### ERP-608: Mobile hamburger sidebar
**Acceptance criteria:**
- [ ] On screens < 768px: sidebar collapses to a slide-in drawer
- [ ] Hamburger icon (≡) in top-left of header; clicking opens drawer with overlay
- [ ] Clicking any nav link closes the drawer
- [ ] Desktop sidebar layout unchanged (>= 768px)
- [ ] Transition is smooth (200ms slide)

---

## Backlog (Unprioritised — Future Sprints)

These items are in scope per the BRD but not yet sprint-assigned. Scrum Master will assign them to Sprint 7+ after Sprint 3–4 velocity is measured.

| ID | Title | BRD | Points | Notes |
|---|---|---|---|---|
| ERP-701 | HSN-rate master (auto-fill GST% from HSN) | PRD F-12 | 5 | Reduces data entry errors |
| ERP-702 | Bulk CSV import: products | PRD F-13 | 8 | Needed for new customer onboarding |
| ERP-703 | Bulk CSV import: customers | PRD F-13 | 5 | — |
| ERP-704 | Bulk CSV import: opening stock | PRD F-13 | 5 | Pairs with ERP-209 opening balance |
| ERP-705 | Audit log (who changed what, when) | PRD F-16 | 8 | Compliance; deferred |
| ERP-706 | In-app notifications: overdue invoices | PRD F-18 | 5 | Could |
| ERP-707 | In-app notifications: low stock alert | PRD F-18 | 3 | Could |
| ERP-708 | Dashboard: date-range filter + chart drill-down | PRD F-03 | 5 | Enhancement |
| ERP-709 | Stock ledger: date filter + CSV export | PRD 4.2 | 3 | Partial fix |
| ERP-710 | Email PDF share (SMTP, configurable in Settings) | PRD F-09 | 13 | Deferred from MVP; Phase 3 |
| ERP-711 | Quotation → SO: show quot_no reference in SO list | PRD 4.2 | 2 | Minor UX polish |

---

## Definition of Done (all tickets)

A ticket is Done when ALL of the following are true:
1. Feature works end-to-end (frontend → API → DB → response)
2. Role guard enforced: only permitted roles can access the endpoint and UI button
3. Empty state handled (no data → helpful message, not blank screen)
4. Error state handled (API error → toast with message, not silent failure)
5. Mobile layout not broken by the change (test at 375px width)
6. No TypeScript / Python linting errors introduced
7. No regression in existing passing flows (invoice create/pay, SO→Invoice prefill, quotation PDF)

---

## Sprint Sequence Summary

| Sprint | Goal | Key Deliverables | Total Pts |
|---|---|---|---|
| 1 | Foundation & Quick Wins | Nav links, GRN list/PDF, e-invoice toggle, user management | 25 |
| 2 | Credit Notes & Customer Ledger | CN create/PDF, customer ledger modal | 42 |
| 3 | GST Reports & Aging | GSTR-1 (Excel+JSON), GSTR-3B, Aging reports | 39 |
| 4 | Proforma Invoice & Delivery Challan | PI convert-to-invoice, DC PDF | 35 |
| 5 | Advance / PDC & BOM | Advance receipts, apply-to-invoice, BOM editor | 37 |
| 6 | Work Orders & Mobile UI | WO with BOM check, mobile sidebar + responsive pages | 40 |
| 7+ | Backlog / polish | HSN master, CSV import, audit log, email share | TBD |

*End of BACKLOG v1.0 — ready for Architect review and then Developer sprint planning.*
