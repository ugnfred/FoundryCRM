# Business Requirements Document — Foundry ERP
**Role:** Business Analyst
**Version:** 1.1
**Date:** 2026-06-21
**Status:** UPDATED — BOM + Work Orders implemented; requirements amended to reflect delivery
**Based on:** PRD v1.2 (approved 2026-06-21) + CLARIFICATIONS.md (answered 2026-06-14)

---

## 1. Purpose & Background

Foundry ERP is a cloud-native, India-GST-compliant ERP system for small-to-medium foundry and discrete-manufacturing businesses. A working MVP is live in production. This BRD defines the requirements for **Phase 2** — closing critical gaps identified in the approved PRD and delivering a system ready for the first paying customer.

The Phase 2 increment covers:
- Hardening existing modules (GRN, navigation links, e-invoice prod switch)
- New financial documents (Credit Notes, Proforma Invoice, Delivery Challan)
- GST compliance reports (GSTR-1, GSTR-3B, Receivables/Payables Aging)
- Customer ledger & advance/PDC tracking
- BOM & Work Orders (manufacturing core)
- Mobile-responsive UI (key pages)
- User management improvements

Email PDF sharing is deferred to Phase 3 backlog.

---

## 2. Scope

### 2.1 In Scope

- **Credit Notes** — linked to invoices, auto-update customer ledger, GST-reversed PDF, GSTR-1 negative entry
- **Customer Ledger** — per-customer running balance of invoices, payments, credit notes, advances
- **Advance Receipt (AR-XXXX)** — standalone advance receipt document, per-customer credit ledger
- **PDC tracking** — record post-dated cheques as pending receipts (no automated alerts)
- **Proforma Invoice (PI-XXXX)** — separate number series, convertible to Tax Invoice, no stock/balance impact
- **Delivery Challan (DC-XXXX)** — separate series, concurrent with or before invoice, no GST amounts, own PDF
- **GSTR-1 report** — B2B + B2C, summary table (Excel download) + NIC-format JSON export
- **GSTR-3B report** — monthly tax liability summary, Excel download
- **Receivables Aging report** — by customer, by bucket (0–30, 31–60, 61–90, 90+ days)
- **Payables Aging report** — by supplier, same buckets
- **GRN list page** — sequential GRN#, separate list view, multiple GRNs per PO, GRN PDF
- **Invoice ↔ SO navigation links** — clickable SO# on invoice, invoice count on SO
- **NIC e-invoice prod switch** — UI toggle in Settings (sandbox/production)
- **BOM (Bill of Materials)** — fixed BOM per product; raw material linkage
- **Work Orders** — linked to Sales Order; tracks production job against BOM
- **Mobile-responsive UI** — Dashboard, Invoice list, Stock check (priority pages)
- **User management** — admin creates user with password; deactivate user (no history loss)

### 2.2 Out of Scope (v1)

- Email / WhatsApp PDF sharing (Phase 3 backlog)
- Payment gateway integration (Razorpay / PayU)
- Multi-GSTIN / Multi-branch
- TDS / TCS handling
- Recurring invoices
- Customer self-service portal
- GSTR-3B direct API filing to GST portal
- PDC reminder / alert notifications
- Work Order MRP / material planning

---

## 3. Business Requirements

| ID | Business Requirement | PRD Feature |
|---|---|---|
| BR-001 | The system shall enable accounts staff to issue GST-compliant Credit Notes linked to original invoices, maintaining audit trail and customer balance accuracy. | F-01 |
| BR-002 | The system shall maintain a real-time customer ledger showing all invoices, payments, credit notes, and advances for each customer. | F-01, F-10 |
| BR-003 | The system shall generate GSTR-1 reports in both Excel summary and NIC JSON format covering B2B and B2C transactions for any selected month. | F-02 |
| BR-004 | The system shall generate GSTR-3B monthly tax liability summary for download. | F-14 |
| BR-005 | The system shall provide Receivables Aging and Payables Aging reports with 0–30 / 31–60 / 61–90 / 90+ day buckets. | F-03, F-15 |
| BR-006 | Accounts staff shall be able to navigate directly between a Sales Order and its linked invoices (and vice versa) without manual searching. | F-04 |
| BR-007 | The system shall support switching e-invoice IRN generation between NIC Sandbox and NIC Production from the Settings UI, without code changes. | F-05 |
| BR-008 | All GRN records shall have sequential, traceable numbers; multiple GRNs per PO shall be supported; a GRN list page and PDF shall be available. | F-06 |
| BR-009 | Sales staff shall be able to generate a Delivery Challan (DC-XXXX) concurrently with or before an invoice, with its own PDF — no GST amounts shown. | F-07 |
| BR-010 | Sales staff shall be able to generate a Proforma Invoice (PI-XXXX) convertible to a Tax Invoice in one click; it shall not affect stock or customer balance. | F-08 |
| BR-011 | Accounts staff shall be able to record advance payments per customer as AR-XXXX documents and apply them against future invoices. | F-10 |
| BR-012 | ✅ **DONE** The system shall allow definition of a Bill of Materials (BOM) per product, listing raw material components and quantities. | F-11 |
| BR-013 | ✅ **DONE** Production staff shall be able to create Work Orders linked to a Sales Order, track manufacturing progress, and trigger raw material consumption from stock. | F-19 |
| BR-014 | Key pages (Dashboard, Invoice list, Stock check) shall be usable on a mobile browser without horizontal scrolling or unreadable text. | F-17 |
| BR-015 | Admin shall be able to create new user accounts with a set password and deactivate existing users without deleting any historical records. | User Mgmt |

---

## 4. Functional Requirements

### 4.1 Credit Notes Module

| ID | Requirement |
|---|---|
| FR-001 | User can create a Credit Note linked to a specific invoice (required) or standalone. |
| FR-002 | CN line items default to the original invoice items; user can edit qty/rate. |
| FR-003 | CN calculates GST reversal using the same intra/inter-state logic as the original invoice. |
| FR-004 | On save, CN reduces the invoice's `balance_due` and updates the customer ledger. |
| FR-005 | CN has its own sequential number series: CN-XXXX (starting CN-5001). |
| FR-006 | CN PDF: header "CREDIT NOTE", references original invoice number, shows reversed GST. |
| FR-007 | CN appears as a negative entry in GSTR-1 under the relevant month. |
| FR-008 | Only admin and accounts roles can create/edit CNs. |

### 4.2 Customer Ledger

| ID | Requirement |
|---|---|
| FR-009 | A customer ledger view is accessible from the customer record in Settings → Customers. |
| FR-010 | Ledger shows: date, document type (Invoice/Payment/CN/Advance), document number, debit, credit, running balance. |
| FR-011 | Ledger is filterable by date range and exportable to Excel/CSV. |
| FR-012 | Opening balance entry can be set per customer (for migrating from Tally). |

### 4.3 Advance Receipt & PDC

| ID | Requirement |
|---|---|
| FR-013 | Accounts can record an advance payment against a customer (AR-XXXX series, start AR-6001). |
| FR-014 | Advance is stored on the customer ledger as a credit entry. |
| FR-015 | When recording a payment on an invoice, the user can apply available advance credit (dropdown shows balance). |
| FR-016 | PDC can be recorded as an advance with a "PDC" flag and a cheque date; shown in ledger as pending until cheque date. |

### 4.4 Proforma Invoice

| ID | Requirement |
|---|---|
| FR-017 | Proforma Invoice uses PI-XXXX series (start PI-7001), never INV-XXXX. |
| FR-018 | PI form is identical to Invoice form in fields and line items. |
| FR-019 | PI does not affect stock ledger or customer outstanding balance. |
| FR-020 | PI is not included in GSTR-1 or any tax report. |
| FR-021 | One-click "Convert to Invoice" on a PI creates an INV-XXXX with all line items pre-filled; PI status set to "converted". |
| FR-022 | PI PDF header says "PROFORMA INVOICE"; shows PI number, date, validity. |

### 4.5 Delivery Challan

| ID | Requirement |
|---|---|
| FR-023 | Delivery Challan uses DC-XXXX series (start DC-8001). |
| FR-024 | DC can be created manually at any time (not auto-generated from SO dispatch). |
| FR-025 | DC references a Sales Order (optional) and a vehicle number / transporter name. |
| FR-026 | DC PDF header says "DELIVERY CHALLAN"; shows items, qty, UOM — no GST amounts, no tax totals. |
| FR-027 | DC does not affect stock ledger or invoice status. |
| FR-028 | DC has a separate list page with DC#, customer, date, SO reference, status. |

### 4.6 GST Reports

| ID | Requirement |
|---|---|
| FR-029 | GSTR-1 report: user selects month + year; system computes B2B invoices (with GSTIN), B2C invoices (without GSTIN), and Credit Notes. |
| FR-030 | GSTR-1 Excel export: columns per NIC GSTR-1 format (GSTIN, invoice#, date, taxable, CGST, SGST, IGST, cess). |
| FR-031 | GSTR-1 JSON export: NIC-compatible JSON ready for upload to GST portal. |
| FR-032 | GSTR-3B report: user selects month; system shows outward tax liability (from invoices) and inward tax credit (from POs). |
| FR-033 | GSTR-3B Excel export with monthly totals per GST rate slab. |
| FR-034 | All GST reports accessible from a new "Reports" section in sidebar (admin + accounts roles). |

### 4.7 Aging Reports

| ID | Requirement |
|---|---|
| FR-035 | Receivables Aging: as-of date (default today); rows = customers; columns = Current, 1–30, 31–60, 61–90, 90+ days, Total. |
| FR-036 | Payables Aging: same structure but for suppliers and purchase invoices (when added). |
| FR-037 | Both reports exportable to Excel/CSV. |
| FR-038 | Clicking a customer row in aging drills down to their customer ledger. |

### 4.8 GRN Improvements

| ID | Requirement |
|---|---|
| FR-039 | GRN numbers are sequential: GRN-XXXX (start GRN-9001), generated by DB sequence. |
| FR-040 | A dedicated GRN list page shows: GRN#, PO#, supplier, received date, status. |
| FR-041 | Multiple GRNs per PO are supported; PO shows total received vs ordered per item. |
| FR-042 | GRN PDF: header "GOODS RECEIPT NOTE"; shows PO#, supplier, items received, quantities, acknowledgement signature line. |

### 4.9 Invoice ↔ SO Navigation

| ID | Requirement |
|---|---|
| FR-043 | Invoice list shows a "Sales Order" column; if so_id is set, SO number is a clickable link. |
| FR-044 | Clicking the SO link navigates to Sales Orders page with that SO row highlighted. |
| FR-045 | Sales Order list shows an "Invoices" column; clicking shows count as link, navigates to Invoices filtered by that SO. |

### 4.10 NIC E-Invoice Prod Switch

| ID | Requirement |
|---|---|
| FR-046 | Settings → Company tab has an "E-Invoice Environment" toggle: Sandbox / Production. |
| FR-047 | The backend reads this setting (stored in company_settings) and selects the correct NIC base URL. |
| FR-048 | Switching to Production shows a confirmation dialog warning that real IRNs will be generated. |

### 4.11 BOM (Bill of Materials) ✅ IMPLEMENTED

| ID | Requirement | Status | Implementation Note |
|---|---|---|---|
| FR-049 | Admin can define a BOM for any product: list of raw material products + qty per unit of finished product. | ✅ Done | `POST /api/v1/bom/` — `BOMIn` model with `product_id` + `items[]`; role-guarded to admin+accounts |
| FR-050 | BOM is versioned (v1, v2…); only one version is active at a time. | ✅ Done | `bom_headers.version` INT; `PUT /bom/{id}` creates v+1 and deactivates old; `UNIQUE(product_id, version)` DB constraint |
| FR-051 | BOM list page: product name, version, number of components, active status. | ✅ Done | `GET /api/v1/bom/` with optional `product_id` filter; frontend shows version badge (Active/Inactive), component table |
| FR-052 | When a Work Order is created, the BOM is used to estimate raw material requirements. | ✅ Done | `create_work_order` auto-links active BOM via `bom_headers.is_active = True`; detail view shows required vs on-hand per component |

**Additional FR discovered during implementation:**

| ID | Requirement | Status |
|---|---|---|
| FR-049a | BOM product filter dropdown on list page | ✅ Done |
| FR-049b | "New Version" button on active BOM re-opens BOMEditor with existing items pre-filled | ✅ Done |
| FR-049c | BOM creation deactivates all prior versions for that product atomically | ✅ Done |

**Design decisions:**
- Fixed BOM per product (not per-order custom) — confirmed by owner during development
- All products (not just "raw materials") can be BOM components; the foundry selects correct ones manually
- No hard-delete on BOMs (soft-delete via `is_active = False` and version history)

### 4.12 Work Orders ✅ IMPLEMENTED

| ID | Requirement | Status | Implementation Note |
|---|---|---|---|
| FR-053 | A Work Order (WO-XXXX) is created from a confirmed Sales Order line item. | ✅ Done | WOForm supports optional `so_id`; auto-prefills product+qty from SO's first item |
| FR-054 | WO fields: SO reference, product, qty to produce, start date, target date, assigned to (user), status (open/in-progress/done/cancelled). | ✅ Done | `work_orders` table; `WOIn` Pydantic model; all fields present |
| FR-055 | WO shows BOM-estimated raw material qty needed vs current stock (shortage alert). | ✅ Done | `get_work_order` augments each BOM item with `required_qty`, `on_hand`, `shortage`; WODetail shows red badge + shortage banner |
| FR-056 | On WO completion, raw material consumption is deducted from stock ledger (txn_type = "production"). | ✅ Done | `complete_work_order` endpoint; checks stock before deducting; raises HTTP 400 on shortage; also adds `production_output` entry for finished product |
| FR-057 | WO list page with status filter; WO detail shows progress, BOM consumption. | ✅ Done | Filter buttons (All / Open / In Progress / Done / Cancelled); WO# is clickable to open WODetail modal |

**Additional FR discovered during implementation:**

| ID | Requirement | Status |
|---|---|---|
| FR-057a | WO list shows WO#, Product, Qty, SO Ref, Target Date (overdue in red), Status | ✅ Done |
| FR-057b | "Start" button transitions open → in_progress | ✅ Done |
| FR-057c | "Complete" button (with confirm dialog) disabled when stock shortage exists | ✅ Done |
| FR-057d | "Cancel" button for open WOs | ✅ Done |
| FR-057e | Stock `production_output` txn creates finished-product stock entry on WO completion | ✅ Done |

**Design decisions:**
- WO number series: `WO-1001, WO-1002, …` via DB sequence `wo_seq` (start 1001)
- If no BOM exists for a product, WO still works — only `production_output` stock txn fires (no raw material deduction)
- Stock shortage check is enforced server-side: `POST /work-orders/{id}/complete` returns HTTP 400 with component name + deficit if stock is insufficient

### 4.13 Mobile-Responsive UI

| ID | Requirement |
|---|---|
| FR-058 | Dashboard stat cards stack to 2-column grid on screens < 768px. |
| FR-059 | Invoice list on mobile: shows inv_no, customer, total, status, Pay button; other columns hidden. |
| FR-060 | Inventory / Stock list on mobile: shows product name, balance; action buttons as icon-only. |
| FR-061 | Sidebar collapses to a hamburger menu on mobile. |
| FR-062 | All modals (InvoiceForm, SOForm, etc.) scroll correctly on mobile without overflow. |

### 4.14 User Management

| ID | Requirement |
|---|---|
| FR-063 | Admin can create a new user: enter name, email, password, role. |
| FR-064 | New user record is created in Supabase Auth + profiles table with assigned role. |
| FR-065 | Admin can deactivate a user: sets `is_active = false` on their profile; they cannot log in. |
| FR-066 | Deactivated user's historical records (invoices, payments, etc.) remain intact and attributed to them. |

---

## 5. Non-Functional Requirements

| ID | Requirement | Category |
|---|---|---|
| NFR-001 | All monetary calculations use Decimal precision (no float) in backend; `pn()` guard in frontend. | Reliability |
| NFR-002 | GSTR-1 JSON output must conform to NIC schema version 1.1 (validate against official XSD). | Compliance |
| NFR-003 | All new tables follow existing RLS patterns from `002_rls_policies.sql` — no unauthenticated access. | Security |
| NFR-004 | Credit Note, Proforma, DC, GRN, AR — all use DB sequences for number generation (no application-layer counters). | Reliability |
| NFR-005 | Mobile pages must score ≥ 80 on Lighthouse Mobile performance on a Moto G4 equivalent (4G). | Performance |
| NFR-006 | GSTR-1 report generation for 500 invoices must complete in < 10 seconds. | Performance |
| NFR-007 | BOM and Work Order data must be soft-deletable — no hard deletes on production records. | Compliance |
| NFR-008 | All new API endpoints must validate role using `require_roles()` — no open endpoints. | Security |
| NFR-009 | Customer ledger query for 5 years of history (≈10,000 rows) must return in < 3 seconds. | Performance |
| NFR-010 | All destructive actions (cancel CN, close WO, deactivate user) must show a confirmation dialog. | Usability |

---

## 6. System Requirements

| Module | New DB Tables / Columns | New API Endpoints |
|---|---|---|
| Credit Notes | `credit_notes`, `credit_note_items`, seq `cn_seq` (5001) | POST /credit-notes, GET /credit-notes, GET /credit-notes/{id}/pdf |
| Customer Ledger | `customer_ledger` view (or materialized) | GET /customers/{id}/ledger |
| Advance / PDC | `advance_receipts`, seq `ar_seq` (6001) | POST /advance-receipts, GET /advance-receipts |
| Proforma Invoice | `proforma_invoices`, `proforma_items`, seq `pi_seq` (7001) | POST /proforma, GET /proforma/{id}/pdf, POST /proforma/{id}/convert |
| Delivery Challan | `delivery_challans`, `dc_items`, seq `dc_seq` (8001) | POST /delivery-challans, GET /delivery-challans, GET /delivery-challans/{id}/pdf |
| GRN | Add seq `grn_seq` (9001) to existing `grn` table; add `grn_no` column | GET /grns (new list endpoint) |
| Reports | No new tables (reads from existing) | GET /reports/gstr1?month=&year=, GET /reports/gstr1/json, GET /reports/gstr3b, GET /reports/aging/receivables, GET /reports/aging/payables |
| BOM | ✅ `bom_headers`, `bom_items` — migration 012_bom.sql | ✅ GET/POST /bom, PUT /bom/{id}, GET /bom/active |
| Work Orders | ✅ `work_orders`, seq `wo_seq` (1001), `txn_type` enum updated — migration 013, 015 | ✅ GET/POST /work-orders, PATCH /work-orders/{id}/status, POST /work-orders/{id}/complete |
| E-Invoice Env | Add `einvoice_env` column to `company_settings` | (settings endpoint updated) |
| User Management | (use Supabase Admin API) | POST /settings/users, DELETE /settings/users/{id} |

---

## 7. Use Cases

### UC-001: Issue a Credit Note

**Actor:** Accounts staff
**Preconditions:** Invoice INV-3010 exists with status = sent or partially_paid; user has accounts role.
**Main Flow:**
1. User opens Invoice INV-3010 → clicks "Credit Note" button.
2. System opens CN form pre-filled with invoice line items.
3. User adjusts qty/rate for returned goods; system recalculates GST.
4. User clicks Save; system creates CN-5001, reduces INV-3010 balance_due, posts to customer ledger.
5. User downloads CN-5001 PDF.

**Alternate Flow — Standalone CN:**
1. User goes to Credit Notes → New CN; selects customer without linking invoice.
2. Enters items manually; saves. Posts as credit to customer ledger only.

**Postconditions:** Customer ledger shows CN-5001 as credit; INV-3010 balance_due reduced; GSTR-1 for that month shows CN as negative entry.

---

### UC-002: Generate GSTR-1 Report

**Actor:** Accounts staff / Admin
**Preconditions:** At least one invoice exists for the selected month.
**Main Flow:**
1. User opens Reports → GSTR-1; selects Month = May 2026.
2. System fetches all invoices and CNs for May 2026; splits into B2B (with GSTIN) and B2C.
3. System displays summary table: count, taxable, CGST, SGST, IGST per rate slab.
4. User clicks "Download Excel" → XLSX file downloaded.
5. User clicks "Download JSON" → NIC-format JSON downloaded for portal upload.

**Postconditions:** Report reflects all invoices in the period; JSON passes NIC schema validation.

---

### UC-003: Create Proforma Invoice → Convert to Tax Invoice

**Actor:** Sales staff
**Preconditions:** Customer has requested a proforma before placing order.
**Main Flow:**
1. User goes to Proforma Invoices → New PI; selects customer, adds line items.
2. System saves as PI-7001; user downloads PI PDF.
3. Customer approves and pays advance.
4. User records advance (AR-6001) against the customer.
5. User opens PI-7001 → clicks "Convert to Invoice".
6. System creates INV-3050 with all PI line items; marks PI-7001 as "converted".
7. On INV-3050 payment screen, advance balance AR-6001 is available to apply.

**Postconditions:** PI-7001 status = converted; INV-3050 created; advance credit applied to invoice.

---

### UC-004: Receive Partial GRN Against PO

**Actor:** Accounts / Store staff
**Preconditions:** PO-4005 exists with status = sent; 100 units ordered.
**Main Flow:**
1. User opens PO-4005 → clicks "GRN".
2. System opens GRN form; user enters qty received (60 of 100 units); saves.
3. System creates GRN-9001; updates PO-4005 status = partial; adds 60 units to stock ledger.
4. Later, remaining 40 units arrive; user creates GRN-9002 on same PO.
5. PO-4005 status = received (fully received).

**Postconditions:** Two GRNs linked to PO-4005; stock ledger has two grn entries; PO status = received.

---

### UC-005: Create Work Order from Sales Order

**Actor:** Production / Admin
**Preconditions:** SO-2015 confirmed; product P-001 has an active BOM.
**Main Flow:**
1. User opens SO-2015 → clicks "Create Work Order" on line item for P-001, qty 50.
2. System creates WO-1001 referencing SO-2015; shows BOM requirements: 200kg Iron Scrap, 50kg Alloy.
3. System shows stock check: Iron Scrap = 180kg (shortage: 20kg); Alloy = 60kg (sufficient).
4. User acknowledges shortage; marks WO in-progress.
5. On completion, user clicks "Mark Complete"; system deducts actual consumption from stock.

**Postconditions:** WO-1001 status = done; stock reduced by consumed raw materials; SO-2015 linked to WO.

---

### UC-006: Apply Advance to Invoice

**Actor:** Accounts staff
**Preconditions:** Customer Acme Ltd has advance credit AR-6001 of ₹50,000; invoice INV-3060 total ₹80,000.
**Main Flow:**
1. User opens INV-3060 → clicks "Record Payment".
2. Payment modal shows: balance due ₹80,000; available advance credit ₹50,000.
3. User selects "Apply Advance: ₹50,000" + enters bank transfer ₹30,000.
4. System records payment; advance credit consumed; INV-3060 status = paid.

**Postconditions:** Customer ledger: AR-6001 consumed; INV-3060 paid; balance = ₹0.

---

## 8. Traceability Matrix

| PRD Feature | BR | FR | UC |
|---|---|---|---|
| F-01 Credit Notes | BR-001, BR-002 | FR-001 – FR-008 | UC-001 |
| F-02 GSTR-1 | BR-003 | FR-029 – FR-031, FR-034 | UC-002 |
| F-03 Receivables Aging | BR-005 | FR-035, FR-037, FR-038 | — |
| F-04 Invoice↔SO link | BR-006 | FR-043 – FR-045 | — |
| F-05 NIC prod switch | BR-007 | FR-046 – FR-048 | — |
| F-06 GRN improvements | BR-008 | FR-039 – FR-042 | UC-004 |
| F-07 Delivery Challan | BR-009 | FR-023 – FR-028 | — |
| F-08 Proforma Invoice | BR-010 | FR-017 – FR-022 | UC-003 |
| F-10 Advance / PDC | BR-011 | FR-013 – FR-016 | UC-006 |
| F-11 BOM | BR-012 | FR-049 – FR-052 | UC-005 |
| F-14 GSTR-3B | BR-004 | FR-032 – FR-033, FR-034 | — |
| F-15 Payables Aging | BR-005 | FR-036, FR-037 | — |
| F-17 Mobile UI | BR-014 | FR-058 – FR-062 | — |
| F-19 Work Orders | BR-013 | FR-053 – FR-057 | UC-005 |
| Customer Ledger | BR-002 | FR-009 – FR-012 | UC-001, UC-006 |
| User Management | BR-015 | FR-063 – FR-066 | — |

---

---

## 9. BOM + Work Orders — Acceptance Criteria (v1.1)

The following criteria must pass before the BOM/Work Orders feature set is marked UAT-ready:

### BOM
- [ ] Admin can create a BOM for a product with at least 2 components
- [ ] BOM list shows version badge (Active) and component table
- [ ] "New Version" on an active BOM creates v+1 and deactivates v
- [ ] Only one BOM version is active per product at any time
- [ ] BOM filter by product works on list page
- [ ] No Radix UI crash on BOM list page (SelectItem value fix applied)

### Work Orders
- [ ] WO can be created standalone (no SO link) with product + qty
- [ ] WO can be created from a Sales Order (SO# pre-links)
- [ ] If an active BOM exists for the product, it auto-links on WO creation
- [ ] WO detail shows BOM components with Required / On Hand / Shortage columns
- [ ] Shortage alert banner appears when any component has insufficient stock
- [ ] "Mark Complete" is disabled when shortage exists
- [ ] Completing a WO deducts raw material stock (production txn_type)
- [ ] Completing a WO adds finished product to stock (production_output txn_type)
- [ ] WO status filter (All / Open / In Progress / Done / Cancelled) works on list
- [ ] Cancelling a WO sets status = cancelled (no stock movement)

*End of BRD v1.1*
