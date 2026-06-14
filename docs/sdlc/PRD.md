# Product Requirements Document — Foundry ERP
**Role:** Product Manager
**Version:** 1.0
**Date:** 2026-06-14
**Status:** DRAFT — awaiting owner approval

---

## 1. Executive Summary & Product Vision

Foundry ERP is a cloud-native, India-GST-compliant ERP system purpose-built for small-to-medium foundry and discrete-manufacturing businesses. The system replaces a typical patchwork of spreadsheets, Tally, and WhatsApp-driven order tracking with a single, role-aware web application that covers the complete order-to-cash and procure-to-pay cycles.

**Vision:** Be the go-to lightweight ERP for Indian foundries and job-shops that need GST compliance, real inventory visibility, and PDF documentation without the cost or complexity of SAP or Odoo.

**Current state:** A working MVP is live in production (Railway + Vercel + Supabase). Core modules are functional. The next phase is hardening existing features, closing critical gaps (multi-company, credit notes, reports), and shipping a mobile-friendly experience.

---

## 2. Market & Competitor Scan

| Competitor | Strengths | Weaknesses / Our Opportunity |
|---|---|---|
| **Tally Prime** | Ubiquitous in India; CA-trusted; strong GST filing | Desktop-only; no web/mobile; poor UX for shop-floor; no SO/PO workflow; requires local IT |
| **Zoho Books / Inventory** | Polished UI; cloud; GST-ready; mobile app | Generic (not manufacturing-aware); no BOM/routing; expensive per-user; MRP lacking |
| **ERPNext / Frappe** | Open-source; full manufacturing module; BOM, WO, MRP | High setup complexity; heavy infra; steep learning curve; poor SME onboarding |
| **SAP Business One** | Enterprise-grade; manufacturing-strong | Far too expensive (₹15L+); needs implementation partner; over-engineered for SME |
| **Marg ERP** | Popular in trading; GST-ready; affordable | No cloud; dated UI; manufacturing workflow limited |
| **Busy Accounting** | GST invoicing; India-focused | Desktop; no inventory; no web |
| **Odoo Manufacturing** | BOM, Work Orders, MRP, quality | Complex deployment; per-user cost adds up; not India-GST-native |
| **Our Foundry ERP** | Cloud-first; role-based; GST-native (CGST/SGST/IGST); PDF/e-invoice/EWB built-in; open-source stack; zero per-seat cost | No BOM/routing yet; no mobile app; single-company; no reports module |

**Market position:** We occupy the white space between Tally (cheap but desktop/manual) and Odoo (powerful but complex). Target is the 50–500-employee foundry that needs cloud access, proper GST e-invoicing, and a clean SO→Invoice→Payment workflow without a 6-month implementation.

---

## 3. Target Users & Jobs-to-be-Done

| Persona | Role in App | Primary Jobs-to-be-Done |
|---|---|---|
| **Owner / Director** | admin | See live P&L, overdue receivables, top customers; approve large orders; set company settings |
| **Sales Executive** | sales | Create quotations; follow up; convert to SO; track delivery status |
| **Accounts / Finance** | accounts | Raise invoices; record payments; reconcile; generate e-invoice/EWB; manage POs |
| **Store / Dispatch** | dispatch | Check stock levels; view delivery schedules; confirm dispatch |
| **Purchase Manager** | accounts | Create POs; receive GRN; manage supplier payments |

---

## 4. Feature Inventory

### 4.1 HAVE — Fully Implemented

| Feature | Evidence (file) |
|---|---|
| Quotation create / edit / PDF / status flow (Draft→Sent→Accept/Lost) | `frontend/src/pages/Quotations/`, `backend/app/routers/quotations.py` |
| Convert quotation → Sales Order (copies all line items) | `quotations.py:111` `convert_to_so` |
| Sales Order create / edit / status buttons (Confirm / Dispatch) | `frontend/src/pages/SalesOrders/index.jsx` |
| SO → Invoice prefill (one-click, pre-populates all line items) | `orders.py:102` `get_invoice_prefill` |
| Invoice create / edit with GST split (CGST+SGST intra / IGST inter) | `invoices.py:_calc_gst` |
| Invoice PDF download (logo, company details, bank footer) | `backend/app/services/pdf.py` |
| Payment recording (multi-mode: bank/cash/cheque/UPI) | `invoices.py:record_payment` |
| Overpayment guard | `invoices.py` balance_due check |
| Auto-overdue flagging on list load | `invoices.py:list_invoices` |
| Overdue row highlighting (red) | `frontend/src/pages/Invoices/index.jsx` |
| SO auto-close when all invoices paid | `invoices.py:_sync_so_status` |
| Purchase Order create / edit | `frontend/src/pages/PurchaseOrders/`, `backend/app/routers/purchase_orders.py` |
| GRN (Goods Receipt Note) — receive against PO, update stock | `purchase_orders.py:create_grn` |
| Stock ledger (running balance, all txn types) | `backend/app/routers/inventory.py`, `supabase/migrations/001_initial_schema.sql` |
| Stock adjustment / opening stock entry | `inventory.py:adjust_stock` |
| Inventory page with low-stock alerts | `frontend/src/pages/Inventory/index.jsx` |
| E-Invoice IRN generation (NIC sandbox) | `backend/app/services/nic_client.py` |
| E-Way Bill creation | `backend/app/routers/einvoice.py`, `frontend/src/pages/EInvoice/EWBModal.jsx` |
| IRN cancellation | `einvoice.py:cancel_irn` |
| Company settings (GSTIN, logo, bank, state dropdown) | `frontend/src/pages/Settings/index.jsx` |
| Logo upload to Supabase Storage | `Settings/index.jsx` + `supabase/migrations/003_storage_policy.sql` |
| Logo in PDF & sidebar | `pdf.py`, `Sidebar.jsx` |
| Customer / Supplier master (CRUD, soft-delete) | `settings.py`, `Settings/index.jsx` |
| Product master (CRUD, soft-delete) | `settings.py`, `Settings/index.jsx` |
| Role-based access control (admin / sales / accounts / dispatch) | `backend/app/auth.py`, `supabase/migrations/002_rls_policies.sql` |
| Row-level security on all 19 tables | `002_rls_policies.sql` |
| Dashboard: revenue, outstanding, overdue card, top customers, chart | `frontend/src/pages/Dashboard/index.jsx` |
| Revenue trend chart (last 6 months, YYYY-MM keyed) | `Dashboard/index.jsx` |
| Empty states with inbox icon across all tables | `frontend/src/components/shared/DataTable.jsx` |
| Supabase JWT auth, user profile + role on signup | `001_initial_schema.sql:handle_new_user` |

### 4.2 PARTIAL — Exists but Incomplete

| Feature | What's Missing | Evidence |
|---|---|---|
| E-Invoice NIC integration | Currently sandbox only; no prod URL switch in UI; IRN/EWB logs not surfaced to user | `nic_client.py`, env var `NIC_EINVOICE_BASE_URL` |
| Quotation → SO | SO does not carry `quot_no` reference visibly in the UI list | `SalesOrders/index.jsx` |
| Invoice → SO navigation link | Removed in last session; SO column shows `—` for existing invoices | `Invoices/index.jsx` |
| GRN | GRN# is random 6-digit (not sequential); no GRN list/view page | `purchase_orders.py:create_grn` |
| Payment modes | UPI / cheque modes accepted but no reconciliation or payment listing per invoice | `payments` table |
| Dashboard | No date-range filter; no drill-down from chart to invoices | `Dashboard/index.jsx` |
| User management | Can change role but cannot invite new user or deactivate account | `Settings/index.jsx` |
| Stock ledger | No export; no date filter on ledger modal | `Inventory/LedgerModal.jsx` |

### 4.3 MISSING — Not Yet Built

| Feature | Business Need |
|---|---|
| **Credit Notes / Debit Notes** | GST-mandated for sales returns and purchase returns |
| **Reports module** | GST-R1 summary, GSTR-3B, receivables aging, payables aging, P&L summary |
| **BOM (Bill of Materials)** | Foundry needs to define what raw materials go into each product |
| **Work Orders / Production Orders** | Track shop-floor manufacturing jobs against customer orders |
| **Delivery Challan** | Document for goods dispatched before invoicing (common in manufacturing) |
| **Proforma Invoice** | Pre-invoice for advance payment requests |
| **Recurring invoices** | For retainer/AMC-type billing |
| **Multi-branch / Multi-GSTIN** | Larger foundries have multiple plants with different GSTINs |
| **Mobile-responsive UI** | Dispatch staff use phones; current UI is desktop-only |
| **Email / WhatsApp share** | Send PDF via email or WhatsApp link directly from app |
| **Customer portal** | Self-service for customers to view their invoices and pay online |
| **Advance / PDC tracking** | Track post-dated cheques and advances against orders |
| **HSN-rate master** | Auto-fill GST rate when HSN code is entered |
| **Bulk import (CSV)** | Import existing products, customers, opening stock from Excel |
| **Audit log** | Who changed what and when across all records |
| **Notifications / alerts** | In-app or email alerts for overdue invoices, low stock, PO due |
| **Payment gateway integration** | Razorpay / PayU for online collection |
| **TDS / TCS handling** | Required for certain B2B transactions above threshold |

---

## 5. Prioritized Feature List (MoSCoW + MVP)

> **MVP** = must be complete before first paid customer onboarding.

| ID | Feature | MVP? | Priority | Rationale |
|---|---|---|---|---|
| F-01 | Credit Notes (sales returns) | ✅ MVP | **Must** | GST law mandates CN for returns; customers will ask on day 1 |
| F-02 | GSTR-1 summary report | ✅ MVP | **Must** | Every GST-registered business files monthly; without this, ERP is incomplete |
| F-03 | Receivables aging report | ✅ MVP | **Must** | Core accounts need to chase overdue; dashboard card is not enough |
| F-04 | Fix Invoice↔SO navigation link | ✅ MVP | **Must** | Currently broken (shows `—`); core UX for accounts staff |
| F-05 | NIC e-invoice go-live switch in UI | ✅ MVP | **Must** | Currently sandbox only; needed for IRN on real invoices |
| F-06 | GRN sequential numbering + list page | ✅ MVP | **Must** | Random GRN# is unprofessional; no list = no traceability |
| F-07 | Delivery Challan PDF | ✅ MVP | **Must** | Legally required when goods move before invoice in manufacturing |
| F-08 | Proforma Invoice | ✅ MVP | **Must** | Standard in Indian B2B; customers ask before paying advance |
| F-09 | Email PDF share | ✅ MVP | **Must** | Without email, staff copy PDF and mail manually — defeats purpose |
| F-10 | Advance / PDC tracking | — | **Should** | Very common in foundry; partial orders paid upfront |
| F-11 | BOM (Bill of Materials) | — | **Should** | Differentiator for manufacturing; links product to raw materials |
| F-12 | HSN-rate master (auto-fill GST%) | — | **Should** | Reduces data entry errors; currently user types GST% manually |
| F-13 | Bulk CSV import | — | **Should** | Every new customer needs to onboard existing data |
| F-14 | GSTR-3B summary | — | **Should** | Companion to GSTR-1; used for monthly tax payment |
| F-15 | Payables aging report | — | **Should** | Symmetry with receivables; needed by accounts |
| F-16 | Audit log | — | **Should** | Compliance and dispute resolution |
| F-17 | Mobile-responsive UI | — | **Should** | Dispatch staff on-the-go; not full app, just key pages |
| F-18 | Notifications (overdue, low stock) | — | **Could** | Nice-to-have; email/in-app alerts |
| F-19 | Work Orders / Production | — | **Could** | Valuable but scope-intensive; phase 2 |
| F-20 | Payment gateway (Razorpay) | — | **Could** | Online collection; needs merchant account setup |
| F-21 | Customer self-service portal | — | **Could** | Phase 3 feature |
| F-22 | Multi-branch / Multi-GSTIN | — | **Won't** (v1) | Significant schema change; not needed for initial customers |
| F-23 | TDS / TCS handling | — | **Won't** (v1) | Complex edge case; few SME foundries hit the threshold |
| F-24 | Recurring invoices | — | **Won't** (v1) | Foundry is project-based, not recurring |

---

## 6. Non-Functional Requirements

### 6.1 Compliance
- **GST:** CGST + SGST for intra-state; IGST for inter-state; correct treatment at line-item level. ✅ done
- **E-Invoice (IRN):** Mandatory for turnover > ₹5 crore. NIC API integration required. ✅ sandbox, needs prod switch.
- **E-Way Bill:** Mandatory for goods movement > ₹50,000. ✅ done.
- **GSTR-1:** Monthly return of outward supplies by HSN, by B2B / B2C. ❌ missing.
- **Books audit trail:** Every financial record must show who created it and when.

### 6.2 Performance
- All list views must load in < 2 seconds for up to 10,000 records.
- PDF generation must complete in < 5 seconds.
- Stock ledger queries must handle 100,000 rows without pagination issues.

### 6.3 Security
- Supabase RLS enforced on all 19 tables — no data leaks across users.
- JWT auth with role claims; backend re-validates role on every request.
- No service-role key exposed to frontend.
- Soft-delete only (no hard deletes on financial records).

### 6.4 Usability
- All forms must show inline validation errors before submission.
- Every destructive action (deactivate company, cancel invoice) must have a confirmation dialog.
- Keyboard-navigable forms for power users (accounts team enters 20+ invoices/day).
- Empty states must guide users to the next action (not just "no data").

### 6.5 Reliability
- All financial calculations use `Decimal` precision (no floating-point). ✅ done in backend.
- Frontend uses `parseFloat` with `isNaN` guard (`pn()` helper). ✅ done.
- DB transactions for multi-table writes (invoice + items + stock ledger).

---

## 7. Open Questions for the Business Analyst

1. **Credit Notes:** Should a CN reduce the original invoice (linked) or stand alone? Does it auto-adjust the customer's outstanding balance?
2. **GSTR-1 scope:** Is a downloadable JSON (for upload to GST portal) sufficient, or does the owner want direct GST portal API filing?
3. **Delivery Challan:** Is it always before the invoice, or sometimes concurrent? Should it auto-generate from a dispatched SO?
4. **Proforma Invoice:** Does it use the same sequence as tax invoices (INV-XXXX) or a separate one (PI-XXXX)? Should it be convertible to a tax invoice?
5. **Email sharing:** SMTP (company's own) or a transactional email service (SendGrid/AWS SES)? Who manages API keys?
6. **Multi-user invite:** Should the admin invite users by email (Supabase magic link) or create credentials manually?
7. **Advance payments:** Are advances tracked per customer (running ledger) or per order? How does advance adjust against invoice?
8. **BOM:** Does the foundry use a fixed BOM per product, or does it vary per order (custom castings)? This affects schema significantly.
9. **Stock valuation:** FIFO, weighted average, or standard cost? Affects P&L accuracy.
10. **Mobile priority:** Which pages must work on mobile first? (Likely: Invoice list, Stock check, Dashboard)

---

## 8. Success Metrics / KPIs

| Metric | Target | Measure |
|---|---|---|
| Time to create an invoice | < 2 minutes | Usability testing with accounts staff |
| GST calculation accuracy | 100% match with Tally for same data | UAT validation against known invoices |
| Invoice-to-payment cycle visibility | 100% of outstanding invoices visible in dashboard | Functional acceptance |
| E-invoice IRN success rate (prod) | > 99% on valid invoices | NIC API response logs |
| Onboarding time (new company) | < 1 day | Time from signup to first invoice raised |
| Page load time (list views) | < 2s on 4G | Lighthouse / network throttle test |
| Zero data-loss incidents | 0 | Supabase backup + audit log review |
| User adoption (accounts role) | Daily active use within 2 weeks of go-live | Supabase auth logs |

---

*End of PRD v1.0 — awaiting owner review and approval before BA begins BRD.*
