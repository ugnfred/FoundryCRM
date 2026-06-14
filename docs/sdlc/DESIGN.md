# UI/UX Design Specification — Foundry ERP Phase 2
**Role:** Senior UI/UX Designer
**Version:** 1.0
**Date:** 2026-06-14
**Covers:** All Phase 2 features per BRD v1.0 and BACKLOG v1.0

---

## Table of Contents

1. [Design System Summary](#1-design-system-summary)
2. [Navigation Structure](#2-navigation-structure)
3. [Screen Designs](#3-screen-designs)
4. [PDF Design Specs](#4-pdf-design-specs)
5. [Component Inventory](#5-component-inventory)
6. [UX Principles](#6-ux-principles)

---

## 1. Design System Summary

### 1.1 Color Palette

#### Core (existing, unchanged)
| Token | Hex | Usage |
|---|---|---|
| `primary` | `#2563eb` | Buttons, active nav, links, chart stroke |
| `primary/10` | `#eff6ff` | Active nav bg, icon bg tint |
| `destructive` | `#dc2626` | Delete buttons, error toasts, overdue row text |
| `muted-foreground` | `#6b7280` | Secondary labels, helper text |
| `border` | `#e5e7eb` | Table borders, card borders, input borders |
| `gray-50` | `#f9fafb` | Table header bg, page bg |
| `white` | `#ffffff` | Card bg, sidebar bg |
| `orange-500` | `#f97316` | Outstanding amount highlight |
| `green-700` | `#15803d` | Paid amounts, confirm action buttons |
| `purple-700` | `#7e22ce` | Dispatched status, WO in-progress |

#### New — Document Type Accent Colors (Phase 2)

These colors appear in PDF header bars and document-type badge backgrounds. They must never be used as status chips (§1.3 owns status colors).

| Document Type | Accent Hex | Badge bg | Badge text | Rationale |
|---|---|---|---|---|
| Invoice (INV) | `#2563eb` | `#eff6ff` | `#1d4ed8` | Existing blue — tax document |
| Credit Note (CN) | `#dc2626` | `#fef2f2` | `#991b1b` | Red = reversal / reduction |
| Proforma Invoice (PI) | `#0891b2` | `#ecfeff` | `#0e7490` | Cyan = non-binding document |
| Delivery Challan (DC) | `#7c3aed` | `#f5f3ff` | `#5b21b6` | Violet = logistics / dispatch |
| GRN | `#059669` | `#ecfdf5` | `#065f46` | Green = goods received / stock in |
| Work Order (WO) | `#d97706` | `#fffbeb` | `#92400e` | Amber = manufacturing / in-production |
| Advance Receipt (AR) | `#0284c7` | `#e0f2fe` | `#075985` | Sky blue = advance money |
| Purchase Order (PO) | `#64748b` | `#f8fafc` | `#334155` | Slate = purchasing (existing) |
| Quotation | `#64748b` | `#f8fafc` | `#334155` | Slate = pre-sales (existing) |

**Usage rule:** Apply `DocTypeBadge` component (§5) — never inline `className` color for document type labels. This ensures a single-source change propagates everywhere.

### 1.2 Typography

#### UI (browser)
- **Font stack:** `Inter, system-ui, -apple-system, sans-serif` (Tailwind default via shadcn/ui)
- **Page heading (h1):** `text-xl font-semibold text-gray-900` — used in page-level `<h1>` inside `<main>`
- **Section heading:** `text-base font-semibold text-gray-900` — used in `CardTitle`
- **Table header:** `text-xs font-semibold text-gray-600 uppercase tracking-wide` — matches existing `DataTable`
- **Body / table cell:** `text-sm text-gray-900`
- **Muted / helper:** `text-xs text-muted-foreground` (`#6b7280`)
- **Monetary amount:** `text-sm font-semibold tabular-nums` — always right-aligned, always `₹` prefix

#### PDFs (reportlab / weasyprint)
- **Font:** Helvetica / Helvetica-Bold (existing PDF style — no web fonts in PDF)
- **Company name in header:** Helvetica-Bold 14pt white
- **Document title:** Helvetica-Bold 18pt white
- **Section labels:** Helvetica-Bold 8pt `#4b5563`
- **Table header:** Helvetica-Bold 8pt white on `#374151` row bg
- **Table cell:** Helvetica 9pt `#111827`
- **Footer:** Helvetica 7pt `#6b7280`

### 1.3 Status Chip Color Map

All status chips use the `Badge` component from `@/components/ui/badge`. The existing `statusColor()` utility in `@/lib/utils` must be extended with these entries.

| Status value | `className` on Badge | Meaning |
|---|---|---|
| `draft` | `bg-gray-100 text-gray-700 border-gray-200` | Not yet sent/issued |
| `sent` | `bg-blue-100 text-blue-700 border-blue-200` | Sent to customer |
| `confirmed` | `bg-blue-100 text-blue-700 border-blue-200` | Order confirmed |
| `partially_paid` | `bg-yellow-100 text-yellow-800 border-yellow-200` | Partially settled |
| `paid` | `bg-green-100 text-green-700 border-green-200` | Fully paid |
| `overdue` | `bg-red-100 text-red-700 border-red-200` | Past due date |
| `cancelled` | `bg-gray-200 text-gray-500 border-gray-300 line-through` | Voided |
| `converted` | `bg-purple-100 text-purple-700 border-purple-200` | PI converted to Invoice |
| `issued` | `bg-green-100 text-green-700 border-green-200` | CN issued |
| `partial` | `bg-yellow-100 text-yellow-800 border-yellow-200` | GRN/PO partially received |
| `received` | `bg-green-100 text-green-700 border-green-200` | GRN/PO fully received |
| `open` | `bg-gray-100 text-gray-700 border-gray-200` | WO open, not started |
| `in_progress` | `bg-blue-100 text-blue-700 border-blue-200` | WO in production |
| `done` | `bg-green-100 text-green-700 border-green-200` | WO complete |
| `active` | `bg-green-100 text-green-700 border-green-200` | BOM version active |
| `inactive` | `bg-gray-100 text-gray-500 border-gray-200` | BOM version superseded |
| `pending` | `bg-yellow-100 text-yellow-800 border-yellow-200` | PDC — cheque not yet due |
| `inactive_user` | `bg-gray-200 text-gray-500 border-gray-300` | Deactivated user account |

### 1.4 Spacing & Layout Conventions

These are derived from the existing codebase — developers must follow them for visual consistency.

| Context | Value |
|---|---|
| Page top-level wrapper | `className="space-y-4"` (existing) or `"space-y-6"` for pages with cards |
| Page header row (count label + action button) | `flex items-center justify-between` |
| Card internal padding | `pt-6` via `CardContent` (shadcn default) |
| Form field group | `space-y-1.5` (Label + input stacked) |
| Form grid | `grid grid-cols-2 gap-4 lg:grid-cols-4` (existing InvoiceForm pattern) |
| Line-items table inside a form | `rounded-lg border overflow-x-auto` wrapper |
| Table cell padding | `px-4 py-3` (DataTable cells), `px-2 py-1.5` (form table cells) |
| Modal max-width | `max-w-4xl` for forms, `max-w-2xl` for confirmation dialogs, `max-w-5xl` for report modals |
| Modal max-height | `max-h-[90vh] overflow-y-auto` |
| Button gap in action cell | `flex gap-1` |
| Border radius | `rounded-lg` for cards, tables, modals; `rounded-md` for inputs, badges |
| Box shadow | `shadow-sm` default; `shadow-md` on card hover |

### 1.5 Icon Library

All icons from `lucide-react`. New icons needed for Phase 2:

| Usage | Icon name |
|---|---|
| Credit Note | `FileMinus` |
| Proforma Invoice | `FileSearch` |
| Delivery Challan | `Truck` (already imported in SOForm) |
| GRN list | `PackageCheck` |
| Reports section | `BarChart2` |
| GSTR-1 | `FileSpreadsheet` |
| Aging report | `Clock` |
| BOM | `Layers` |
| Work Order | `Hammer` |
| Manufacturing section | `Factory` |
| User management | `Users` |
| Ledger | `BookOpen` |
| Advance receipt | `Banknote` |
| Hamburger menu | `Menu` |
| Close drawer | `X` |
| Shortage/alert | `AlertTriangle` (already in Dashboard) |
| Expand / drill-down | `ChevronRight` (already in Sidebar) |
| Convert to invoice | `ArrowRightCircle` |

---

## 2. Navigation Structure

### 2.1 Full Sidebar Structure (Phase 2)

The flat nav list in `Sidebar.jsx` must be restructured into labelled sections. Section headers are non-clickable `<div>` labels (`text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 py-1 mt-3`).

```
FOUNDRY ERP [logo] [company name]
─────────────────────────────────
  Dashboard                          (all roles)

  ── SALES ──────────────────────
  ├── Quotations                     (admin, sales, accounts)
  ├── Sales Orders                   (admin, sales, accounts)
  ├── Invoices                       (admin, sales, accounts)
  ├── Credit Notes          ← new   (admin, accounts)
  ├── Proforma Invoices     ← new   (admin, sales, accounts)
  └── Delivery Challans     ← new   (admin, sales, dispatch)

  ── PURCHASES ───────────────────
  ├── Purchase Orders                (admin, accounts)
  └── GRN                  ← new   (admin, accounts, dispatch)

  ── MANUFACTURING ───────────────  ← new section
  ├── Bill of Materials     ← new   (admin)
  └── Work Orders           ← new   (admin, sales, dispatch)

  ── FINANCE ─────────────────────  ← new section (was flat)
  └── Advance Receipts      ← new   (admin, accounts)

  ── INVENTORY ───────────────────
  └── Inventory                      (admin, sales, accounts, dispatch)

  ── REPORTS ─────────────────────  ← new section
  ├── GSTR-1                ← new   (admin, accounts)
  ├── GSTR-3B               ← new   (admin, accounts)
  ├── Receivables Aging     ← new   (admin, accounts)
  └── Payables Aging        ← new   (admin, accounts)

  ── SYSTEM ──────────────────────
  ├── E-Invoice                      (admin, accounts)
  └── Settings                       (admin)
─────────────────────────────────
  [role badge]  e.g. ◇ accounts
```

**Route map (new routes only):**
| Label | Route | Component file |
|---|---|---|
| Credit Notes | `/credit-notes` | `pages/CreditNotes/index.jsx` |
| Proforma Invoices | `/proforma` | `pages/ProformaInvoices/index.jsx` |
| Delivery Challans | `/delivery-challans` | `pages/DeliveryChallans/index.jsx` |
| GRN | `/grns` | `pages/GRN/index.jsx` |
| Bill of Materials | `/bom` | `pages/BOM/index.jsx` |
| Work Orders | `/work-orders` | `pages/WorkOrders/index.jsx` |
| Advance Receipts | `/advance-receipts` | `pages/AdvanceReceipts/index.jsx` |
| GSTR-1 | `/reports/gstr1` | `pages/Reports/GSTR1.jsx` |
| GSTR-3B | `/reports/gstr3b` | `pages/Reports/GSTR3B.jsx` |
| Receivables Aging | `/reports/aging/receivables` | `pages/Reports/ReceivablesAging.jsx` |
| Payables Aging | `/reports/aging/payables` | `pages/Reports/PayablesAging.jsx` |

### 2.2 Mobile Sidebar (Hamburger Drawer)

On screens `< 768px` (Tailwind `md` breakpoint), the sidebar is hidden and replaced by a slide-in drawer triggered by a hamburger icon in the Header.

**Behavior:**
- The `<aside>` gains `hidden md:flex` so it is invisible on mobile.
- A `MobileSidebar` drawer component renders a full-height overlay from the left.
- Opening: `translateX(0)` with `transition-transform duration-200 ease-out`.
- Closing: `translateX(-100%)`.
- A semi-transparent overlay `bg-black/40` covers the rest of the screen; tapping it closes the drawer.
- Any nav `<NavLink>` click fires `onClose()` to close the drawer automatically.
- The Header component gains a `<button>` with `<Menu className="h-5 w-5" />` visible only on `md:hidden`.

See wireframe in §3.12.

---

## 3. Screen Designs

> **Conventions used in wireframes:**
> - `[ ]` = input field or checkbox
> - `[v]` = dropdown / select
> - `[ BTN ]` = button (filled = primary, outline shown where relevant)
> - `[x]` = icon button
> - `Badge` = status chip rendered by `<Badge>`
> - `---` = horizontal rule / divider
> - Column widths given as approximate % of table width

---

### 3.1 Credit Note Form

**Route:** Modal opened from `/credit-notes` (New CN button) or from Invoice list (CN button on row)
**Component:** `pages/CreditNotes/CreditNoteForm.jsx`
**Max-width:** `max-w-4xl`
**Roles:** admin, accounts only

```
┌─────────────────────────────────────────────────────────────────┐
│  New Credit Note                                           [✕]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Customer *              Linked Invoice (optional)               │
│  [v Acme Castings Ltd ▼]  [v INV-3010 — ₹45,000 ▼]            │
│                                                                  │
│  CN Date *               Reason                                  │
│  [2026-06-14      ]      [Goods returned — quality issue   ]    │
│                                                                  │
├─ Line Items ────────────────────────────────────── [+ Add Row] ─┤
│  ┌─────────┬────────────────┬──────┬─────┬──────┬───────┬───┐  │
│  │ Product │ Description    │ HSN  │ Qty │ Rate │ GST % │   │  │
│  ├─────────┼────────────────┼──────┼─────┼──────┼───────┼───┤  │
│  │[Pick▼] │[Iron Casting  ]│[7325]│ [5] │[800] │ [18]  │[🗑]│  │
│  │[Pick▼] │[Alloy Bar     ]│[7228]│ [2] │[1200]│ [18]  │[🗑]│  │
│  └─────────┴────────────────┴──────┴─────┴──────┴───────┴───┘  │
│                                                                  │
│                            Taxable    ₹6,400.00                 │
│                            CGST 9%    ₹576.00                   │
│                            SGST 9%    ₹576.00                   │
│                     ─────────────────────────────               │
│                     Credit Amount     ₹7,552.00                 │
│                                                                  │
│  ⓘ This CN will reduce balance on INV-3010 from ₹45,000        │
│    to ₹37,448.  Customer ledger updated automatically.          │
│                                                                  │
│                              [ Cancel ]  [ Save Credit Note ]   │
└─────────────────────────────────────────────────────────────────┘
```

**Field list:**
| Field | Type | Validation | Pre-fill from invoice |
|---|---|---|---|
| `company_id` | Select (customers) | Required | Yes |
| `invoice_id` | Select (invoices for that customer) | Optional | Yes (if opened from Invoice row) |
| `date` | Date | Required, default today | No |
| `reason` | Text input | Optional, max 200 chars | No |
| Line item: `product_id` | Select (products) | Optional | Yes |
| Line item: `description` | Text | Required per row | Yes |
| Line item: `hsn_code` | Text (6 digits) | Optional | Yes |
| Line item: `qty` | Number (>0) | Required | Yes (editable) |
| Line item: `rate` | Number (>=0) | Required | Yes (editable) |
| Line item: `gst_rate` | Number (0/3/5/12/18/28) | Required | Yes |

**UX notes:**
- When `invoice_id` is selected, immediately call `GET /invoices/{id}` and pre-fill line items. Show a `text-xs text-muted-foreground` note: "Items pre-filled from INV-XXXX. Adjust qty/rate for the returned portion."
- GST split (CGST+SGST vs IGST) determined by Place of Supply from original invoice if linked; else default to company state.
- The info banner (ⓘ row) is `bg-blue-50 border border-blue-200 rounded-md px-3 py-2 text-xs text-blue-800`. Show only when `invoice_id` is selected.
- "Save Credit Note" button shows spinner and becomes disabled while `mutation.isPending`.
- On success: toast "CN-XXXX created", close modal, invalidate `['credit-notes']` and `['invoices']` queries.
- `CN total > invoice total` → backend returns 422; frontend shows toast `variant: 'destructive'`: "Credit note amount cannot exceed invoice total (₹XX,XXX.XX)".

---

### 3.2 Credit Note List

**Route:** `/credit-notes`
**Component:** `pages/CreditNotes/index.jsx`

```
┌──────────────────────────────────────────────────────────────────┐
│  [Search credit notes…                ]          [ + New CN ]    │
├──────────────────────────────────────────────────────────────────┤
│  CN #     │ Customer          │ Date       │ Invoice   │ Amount  │ Status  │       │
├───────────┼───────────────────┼────────────┼───────────┼─────────┼─────────┼───────┤
│ CN-5001   │ Acme Castings Ltd │ 14 Jun 26  │ INV-3010  │ ₹7,552  │ issued  │[PDF][✕]│
│ CN-5002   │ Royal Metals      │ 10 Jun 26  │ —         │ ₹2,124  │ draft   │[PDF][✕]│
│ CN-5003   │ Sharma Foundry    │ 05 Jun 26  │ INV-2987  │ ₹18,000 │ cancelled│[PDF]  │
└──────────────────────────────────────────────────────────────────┘
  3 records                                        < Page 1 of 1 >
```

**Column definitions:**
| Column | `accessorKey` | Width % | Notes |
|---|---|---|---|
| CN # | `cn_no` | 10% | Sortable |
| Customer | `companies.name` | 22% | Sortable |
| Date | `date` | 11% | Formatted `formatDate()` |
| Linked Invoice | `invoices.inv_no` | 12% | Blue link; `—` if standalone |
| Amount | `total` | 12% | Right-aligned `formatCurrency()` |
| Status | `status` | 10% | `<Badge>` via `statusColor()` |
| Actions | — | 10% | PDF download, Cancel (admin/accounts only) |

**Action buttons per row:**
- `[PDF]` — `<Button size="sm" variant="ghost"><Download h-3 w-3 /></Button>` — always visible
- `[✕]` Cancel — `<Button size="sm" variant="ghost" className="text-destructive">` — visible only when status ≠ `cancelled`; triggers `ConfirmDialog` (§5)

**Row highlighting:** `status === 'cancelled'` → `className="opacity-50"` on the row (not red, because cancelled is intentional, not urgent).

**Empty state message:** "No credit notes yet. Use the CN button on an Invoice row to issue your first credit note."

---

### 3.3 Customer Ledger Modal

**Trigger:** "Ledger" button on each customer row in Settings → Customers tab
**Component:** `pages/Settings/CustomerLedgerModal.jsx`
**Max-width:** `max-w-3xl`
**Roles:** admin, accounts

```
┌────────────────────────────────────────────────────────────────────┐
│  Ledger — Acme Castings Ltd                                 [✕]   │
│  GSTIN: 27AADCA1234F1Z5                                           │
├────────────────────────────────────────────────────────────────────┤
│  From [ 14 Mar 2026 ]  To [ 14 Jun 2026 ]   [ Apply ]            │
│                                                                     │
│  [Set Opening Balance]              [Export CSV]                   │
├─────────────────────────────────────────────────────────────────────┤
│  Date       │ Type     │ Doc No    │ Debit      │ Credit  │Balance │
├─────────────┼──────────┼───────────┼────────────┼─────────┼────────┤
│ —           │ Opening  │ —         │            │ ₹10,000 │₹-10,000│
│ 01 Apr 26   │ Invoice  │ INV-2901  │ ₹45,000    │         │₹35,000 │
│ 10 Apr 26   │ Payment  │ PMT-2901  │            │ ₹45,000 │₹0      │
│ 15 May 26   │ Invoice  │ INV-3010  │ ₹52,000    │         │₹52,000 │
│ 14 Jun 26   │ CN       │ CN-5001   │            │ ₹7,552  │₹44,448 │
├─────────────┼──────────┼───────────┼────────────┼─────────┼────────┤
│ Totals      │          │           │ ₹97,000    │₹62,552  │        │
│             │          │  Closing Balance:                │₹44,448 │
└─────────────────────────────────────────────────────────────────────┘
```

**Column definitions:**
| Column | Width | Notes |
|---|---|---|
| Date | 14% | `formatDate()`, `—` for opening balance |
| Type | 12% | `DocTypeBadge` (Invoice/Payment/CN/Advance/Opening) |
| Doc No | 15% | Blue clickable link → navigate to that document; `—` for opening |
| Debit | 15% | Right-aligned, `₹` formatted; blank cell if 0 |
| Credit | 15% | Right-aligned, `₹` formatted; blank cell if 0 |
| Balance | 15% | Right-aligned; positive = customer owes us (red text); negative = we owe customer (green text) |

**UX notes:**
- Date range: default `from` = 90 days ago, `to` = today. Updating either field does NOT auto-apply; user clicks `[Apply]` to refetch. This prevents excessive API calls.
- "Set Opening Balance" opens a nested `AlertDialog` with a single number input: "Opening Balance (credit to customer): [₹ ___]". Saves via `POST /customers/{id}/ledger/opening`. Shows confirmation "Opening balance updated" toast.
- "Export CSV" triggers `GET /customers/{id}/ledger?from=&to=&format=csv` — browser download.
- Doc No links: Invoice → `/invoices` (filter/highlight); CN → `/credit-notes`; Advance → `/advance-receipts`. Use `navigate()` + close the modal.
- Running balance column: computed server-side (per FR-012 / ERP-208). Do NOT recompute on the frontend.
- Total row uses `border-t-2 font-semibold`.
- Closing balance cell: if balance > 0, `text-orange-600`; if balance ≤ 0, `text-green-700` (credit balance = we owe them).

---

### 3.4 GSTR-1 Report Page

**Route:** `/reports/gstr1`
**Component:** `pages/Reports/GSTR1.jsx`
**Roles:** admin, accounts

```
┌──────────────────────────────────────────────────────────────────────┐
│  GSTR-1 Report                                                        │
│                                                                        │
│  Period:  [v May ▼]  [v 2026 ▼]   [ Generate Report ]               │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  SUMMARY BAR                                                    │  │
│  │  Taxable: ₹4,32,000   CGST: ₹38,880   SGST: ₹38,880          │  │
│  │  IGST: ₹12,600        Total Invoices: 24   CNs: 2             │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  [B2B Invoices]  [B2C Summary]  [Credit Notes (CDNR)]               │
│  ─────────────────────────────────────────────────────               │
│                                                                        │
│  ── B2B Invoices tab (active) ────────────────────────────────────   │
│  ┌──────────┬─────────┬────────────┬──────────┬───────┬───────────┐  │
│  │ GSTIN    │ Inv No  │ Inv Date   │ Taxable  │ CGST  │ SGST/IGST │  │
│  ├──────────┼─────────┼────────────┼──────────┼───────┼───────────┤  │
│  │27AADCA…  │INV-2901 │01 Apr 2026 │₹45,000   │₹4,050 │₹4,050     │  │
│  │29BBBCA…  │INV-2945 │12 Apr 2026 │₹18,000   │       │₹3,240 IGST│  │
│  └──────────┴─────────┴────────────┴──────────┴───────┴───────────┘  │
│                                                                        │
│  [ Download Excel ]   [ Download JSON (NIC format) ]                  │
└──────────────────────────────────────────────────────────────────────┘
```

**Tab: B2B Invoices — columns:**
| Column | Width | Notes |
|---|---|---|
| GSTIN | 18% | Customer GSTIN |
| Invoice No | 12% | |
| Invoice Date | 12% | `formatDate()` |
| Invoice Type | 8% | R (regular) / SEZWP / SEZWOP |
| Taxable Value | 14% | Right-aligned |
| CGST | 10% | Right-aligned; blank for IGST transactions |
| SGST | 10% | Right-aligned; blank for IGST transactions |
| IGST | 10% | Right-aligned; blank for intra-state |
| Cess | 6% | Right-aligned; blank if 0 |

**Tab: B2C Summary — columns:**
| Column | Notes |
|---|---|
| GST Rate | 5%, 12%, 18%, 28% |
| Taxable | Aggregate per slab |
| CGST | |
| SGST | |
| IGST | |

**Tab: Credit Notes (CDNR) — columns:**
| Column | Notes |
|---|---|
| GSTIN | Customer GSTIN (CDNR only for B2B CNs) |
| CN No | |
| CN Date | |
| Invoice No | Original invoice reference |
| Taxable (negative) | Show in red / parentheses |
| CGST / SGST / IGST | |

**Summary bar:** `bg-blue-50 border border-blue-200 rounded-lg p-4` — 5-column grid of stat values. Updates when data loads.

**UX notes:**
- Month selector: `<select>` with 12 month options (Jan–Dec, display names). Year selector: current year and 2 years back.
- Default period: previous calendar month (auto-set on mount).
- `[Generate Report]` fires `GET /reports/gstr1?month=5&year=2026`. Show `Skeleton` rows while loading.
- Empty state (no invoices in period): "No invoices found for May 2026. Verify that invoices are dated within this period." — rendered inside each tab panel.
- `[Download Excel]` → `GET /reports/gstr1/excel?month=5&year=2026` → blob download `GSTR1_May2026.xlsx`.
- `[Download JSON]` → `GET /reports/gstr1/json?month=5&year=2026` → blob download `GSTR1_May2026_NIC.json`.
- Download buttons are disabled until report is generated (not just mounted). Show `Loader2` spinner icon on buttons while downloading.
- Tabs use shadcn/ui `Tabs` + `TabsList` + `TabsContent`. Active tab underline uses `text-primary border-b-2 border-primary`.

---

### 3.5 Receivables Aging Report

**Route:** `/reports/aging/receivables`
**Component:** `pages/Reports/ReceivablesAging.jsx`
**Roles:** admin, accounts

```
┌──────────────────────────────────────────────────────────────────────┐
│  Receivables Aging                                                    │
│                                                                        │
│  As of date:  [ 14 Jun 2026 ]   [ Refresh ]   [ Export CSV ]        │
│                                                                        │
│  ┌─────────────────┬──────────┬───────┬───────┬───────┬──────┬──────┐│
│  │ Customer        │ Current  │ 1-30d │31-60d │61-90d │ 90+d │Total ││
│  ├─────────────────┼──────────┼───────┼───────┼───────┼──────┼──────┤│
│  │ Acme Castings   │ ₹52,000  │       │       │       │      │₹52,000││
│  │ Royal Metals    │          │₹18,000│₹5,200 │       │      │₹23,200││
│  │ Sharma Foundry  │          │       │       │₹8,400 │₹15,000│₹23,400││
│  │ Kapoor Alloys   │          │       │       │       │₹42,000│₹42,000││
│  ├─────────────────┼──────────┼───────┼───────┼───────┼──────┼──────┤│
│  │ TOTAL           │ ₹52,000  │₹18,000│₹5,200 │₹8,400 │₹57,000│₹1,40,600││
│  └─────────────────┴──────────┴───────┴───────┴───────┴──────┴──────┘│
└──────────────────────────────────────────────────────────────────────┘
```

**Column definitions:**
| Column | `accessorKey` | Width % | Notes |
|---|---|---|---|
| Customer | `customer_name` | 22% | Clickable — opens Customer Ledger modal |
| Current | `current` | 13% | Due date >= as_of; `text-gray-900` |
| 1–30 days | `bucket_1_30` | 11% | 1–30 days past due; `text-yellow-700` |
| 31–60 days | `bucket_31_60` | 11% | `text-orange-600` |
| 61–90 days | `bucket_61_90` | 11% | `text-red-600` |
| 90+ days | `bucket_90plus` | 11% | `text-red-700 font-semibold` |
| Total | `total` | 12% | `font-semibold` |

**Row highlighting:** Rows where `bucket_90plus > 0` get `className="bg-red-50"`. All other rows `hover:bg-gray-50`.

**Total row:** `className="bg-gray-100 font-semibold border-t-2"` — sticky at bottom if table scrolls.

**UX notes:**
- "As of date" defaults to today. Changing it and clicking `[Refresh]` re-fetches. Do NOT auto-refetch on date change (avoid accidental API spam).
- `[Export CSV]` → `GET /reports/aging/receivables/csv?as_of=2026-06-14`.
- Blank cells (₹0 buckets) are rendered as empty strings, not "₹0.00" — this avoids visual noise. Only non-zero amounts are shown.
- Clicking a Customer name calls `setSelectedCustomer(row)` to open the `CustomerLedgerModal`. Pass customer ID as prop.
- Payables Aging (`/reports/aging/payables`) is identical in layout but labels "Supplier" instead of "Customer" and uses purchase invoices. Build as a shared `AgingReportPage` component accepting `type` prop (`'receivables' | 'payables'`).

---

### 3.6 Proforma Invoice Form

**Route:** Modal from `/proforma` (New PI button) or standalone page
**Component:** `pages/ProformaInvoices/ProformaForm.jsx`
**Max-width:** `max-w-4xl`
**Roles:** admin, sales, accounts

The form is **structurally identical** to `InvoiceForm.jsx`. The differences are:

```
┌─────────────────────────────────────────────────────────────────┐
│  New Proforma Invoice                                      [✕]  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ⓘ  PI-7001 — This is a Proforma Invoice. It does NOT    │   │
│  │     affect stock or customer balance. Not a Tax Invoice.  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Customer *              Validity Date         PI Date *         │
│  [v Acme Castings ▼]    [2026-07-14      ]   [2026-06-14  ]   │
│                                                                  │
│  Place of Supply *                                               │
│  [v 27 — Maharashtra ▼]                                         │
│                                                                  │
├─ Line Items ─────────────────────────────────────── [+ Add Row] ┤
│  [identical to InvoiceForm line items table]                    │
│  Columns: Product | Description | HSN | UOM | Qty | Rate | GST%│
│                                                                  │
│                            Taxable    ₹XX,XXX.XX                │
│                            CGST 9%    ₹X,XXX.XX                 │
│                            SGST 9%    ₹X,XXX.XX                 │
│                     Credit Amount     ₹XX,XXX.XX                │
│                                                                  │
│              [ Cancel ]  [ Save Proforma ]                       │
└─────────────────────────────────────────────────────────────────┘
```

**Differences from InvoiceForm:**
| Field | Invoice | Proforma |
|---|---|---|
| `due_date` | Present (required) | Absent; replaced by `validity_date` (optional) |
| `so_id` | Present (hidden) | Absent |
| Info banner | None | Blue `ⓘ` banner always shown |
| Save button label | "Save Invoice" | "Save Proforma" |
| Title | "New Invoice" | "New Proforma Invoice" |

**On the PI list/detail page, the PI shows a "Convert to Invoice" CTA:**

```
┌───────────────────────────────────────────────────────────────┐
│  PI-7001  │  Acme Castings  │  14 Jun 26  │  ₹52,416  │ sent  │
│           [Download PDF]  [Convert to Invoice ▶]             │
└───────────────────────────────────────────────────────────────┘
```

- `[Convert to Invoice ▶]` button: `variant="outline" className="text-green-700 border-green-300"` with `ArrowRightCircle` icon.
- Clicking shows `ConfirmDialog`: "Convert PI-7001 to a Tax Invoice? This creates INV-XXXX with all line items pre-filled. The Proforma will be marked as converted."
- On confirm: `POST /proforma/{id}/convert` → backend returns `{ invoice_id, inv_no }` → navigate to `/invoices` with success toast: "INV-3050 created from PI-7001".
- PI status set to `converted` — `[Convert to Invoice]` button hidden when `status === 'converted'`.

---

### 3.7 Delivery Challan Form

**Route:** Modal from `/delivery-challans`
**Component:** `pages/DeliveryChallans/DCForm.jsx`
**Max-width:** `max-w-3xl`
**Roles:** admin, sales, dispatch

Key design decision: **no Rate, no GST, no totals** — the form and PDF are deliberately price-free.

```
┌──────────────────────────────────────────────────────────────────┐
│  New Delivery Challan                                       [✕]  │
│                                                                   │
│  Customer *              Sales Order (optional)                   │
│  [v Acme Castings ▼]    [v SO-2015 ▼]                          │
│                                                                   │
│  DC Date *               Vehicle No          Transporter         │
│  [2026-06-14      ]     [MH04 AB 1234  ]    [Shree Logistics ] │
│                                                                   │
├─ Items ──────────────────────────────────────────── [+ Add Row] ─┤
│  ┌──────────────────────────────┬──────┬─────┬──────────────────┐ │
│  │ Description                  │ HSN  │ UOM │ Qty              │ │
│  ├──────────────────────────────┼──────┼─────┼──────────────────┤ │
│  │ [Iron Casting Grade A      ] │[7325]│[NOS]│ [50]             │ │
│  │ [Alloy Bar 25mm             ] │[7228]│[KGS]│ [100]            │ │
│  └──────────────────────────────┴──────┴─────┴──────────────────┘ │
│                                                                   │
│  Note: No prices or GST shown on delivery challans.              │
│                                                                   │
│                          [ Cancel ]  [ Save Delivery Challan ]   │
└──────────────────────────────────────────────────────────────────┘
```

**Field list:**
| Field | Type | Validation |
|---|---|---|
| `company_id` | Select (customers) | Required |
| `so_id` | Select (confirmed SOs for that customer) | Optional |
| `date` | Date | Required, default today |
| `vehicle_no` | Text | Optional, max 20 chars |
| `transporter_name` | Text | Optional, max 100 chars |
| Line item: `description` | Text | Required per row |
| Line item: `hsn_code` | Text | Optional |
| Line item: `uom` | Text | Optional, default "NOS" |
| Line item: `qty` | Number >0 | Required |

**No `product_id` auto-fill for Rate or GST** — the picker only fills `description`, `hsn_code`, `uom` fields.

**UX notes:**
- The "Note:" line at the bottom of the form is `text-xs text-muted-foreground italic` — a persistent reminder to the user that this is not an invoice.
- DC list columns: DC #, Customer, Date, SO Ref, Vehicle No, Status, Actions (PDF download).
- Empty state: "No delivery challans yet. Create one for goods being dispatched."

---

### 3.8 Work Order List + Detail

#### 3.8a Work Order List

**Route:** `/work-orders`
**Component:** `pages/WorkOrders/index.jsx`

```
┌──────────────────────────────────────────────────────────────────────┐
│  [Search work orders…       ]  Status: [v All ▼]   [ + New WO ]    │
├──────────────────────────────────────────────────────────────────────┤
│  WO #    │ Product       │ SO Ref  │ Qty │ Start    │ Target   │ Assigned │ Status      │        │
├──────────┼───────────────┼─────────┼─────┼──────────┼──────────┼──────────┼─────────────┼────────┤
│ WO-1001  │ Iron Casting  │ SO-2015 │  50 │01 Jun 26 │14 Jun 26 │ Ravi K   │ in_progress │[View]  │
│ WO-1002  │ Alloy Bar     │ SO-2018 │ 200 │08 Jun 26 │20 Jun 26 │ Suresh M │ open        │[View]  │
│ WO-1003  │ Casting GrB   │ SO-1998 │  25 │10 May 26 │15 May 26 │ Ravi K   │ done        │[View]  │
└──────────────────────────────────────────────────────────────────────┘
```

**Column definitions:**
| Column | `accessorKey` | Width | Notes |
|---|---|---|---|
| WO # | `wo_no` | 9% | Sortable |
| Product | `product.name` | 16% | |
| SO Ref | `sales_orders.so_no` | 10% | Blue link → Sales Orders page |
| Qty | `qty` | 6% | Right-aligned |
| Start Date | `start_date` | 11% | `formatDate()` |
| Target Date | `target_date` | 11% | `formatDate()`; red text if past and status ≠ done |
| Assigned | `assigned_user.name` | 12% | |
| Status | `status` | 11% | `<Badge>` — open/in_progress/done/cancelled |
| Actions | — | 8% | `[View]` opens WO Detail modal |

**Row highlighting:**
- `status === 'done'` → `className="opacity-60"` (de-emphasise completed WOs)
- Target date past and status ≠ 'done' → `className="bg-amber-50"` (overdue production)

**Status filter:** `<select>` next to search bar with options: All / Open / In Progress / Done / Cancelled. Filters `data` array client-side.

#### 3.8b Work Order Detail Modal

**Component:** `pages/WorkOrders/WODetailModal.jsx`
**Max-width:** `max-w-3xl`

```
┌──────────────────────────────────────────────────────────────────┐
│  Work Order: WO-1001                                        [✕]  │
│  Iron Casting Grade A — Qty: 50 units                           │
│  SO: SO-2015  │  Start: 01 Jun 2026  │  Target: 14 Jun 2026    │
│  Assigned: Ravi K  │  Status: in_progress                       │
├─ BOM Requirements ───────────────────────────────────────────────┤
│  ┌──────────────┬──────────┬──────────┬───────────┬────────────┐ │
│  │ Material     │ Per Unit │ Required │ In Stock  │ Shortage   │ │
│  ├──────────────┼──────────┼──────────┼───────────┼────────────┤ │
│  │ Iron Scrap   │ 4.0 kg   │ 200 kg   │ 180 kg    │ ⚠ 20 kg   │ │
│  │ Carbon Alloy │ 1.0 kg   │  50 kg   │  60 kg    │ OK ✓      │ │
│  │ Flux Powder  │ 0.2 kg   │  10 kg   │  12 kg    │ OK ✓      │ │
│  └──────────────┴──────────┴──────────┴───────────┴────────────┘ │
│                                                                   │
│  ⚠ Shortage detected: 20 kg Iron Scrap below requirement.       │
│    Raise a Purchase Order before completing this work order.     │
│                                                                   │
│  ── Status Progression ───────────────────────────────────────── │
│  [Mark In Progress]          [Mark Complete]  [Cancel WO]        │
└──────────────────────────────────────────────────────────────────┘
```

**BOM Requirements table columns:**
| Column | Notes |
|---|---|
| Material | Product name of raw material |
| Per Unit | `bom_item.qty` (e.g. "4.0 kg") |
| Required | `bom_item.qty * wo.qty` |
| In Stock | `current_stock_balance` from API |
| Shortage | If `in_stock < required`: `text-red-600 font-semibold` + `⚠` icon; else `text-green-700` + `✓` |

**Row highlighting in BOM table:** Shortage rows → `bg-red-50`.

**Alert banner (shortage detected):** `bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-sm text-amber-800` — shown only when any component has a shortage. Hidden if all OK.

**Status action buttons:**
| Button | Condition | Style |
|---|---|---|
| `[Mark In Progress]` | status === 'open' | `variant="outline" text-blue-700` |
| `[Mark Complete]` | status === 'in_progress' | `variant="outline" text-green-700`; triggers `ConfirmDialog` |
| `[Cancel WO]` | status ≠ 'done', ≠ 'cancelled' | `variant="ghost" text-destructive`; triggers `ConfirmDialog` |

**Mark Complete confirmation dialog text:** "Complete WO-1001? This will deduct raw materials from stock:\n- Iron Scrap: −180 kg (NOTE: 20 kg short, actual available will be used)\n- Carbon Alloy: −50 kg\n- Flux Powder: −10 kg\nAnd add Iron Casting Grade A: +50 units to finished goods."

---

### 3.9 BOM Editor

**Route:** `/bom` (list) + modal editor
**Component:** `pages/BOM/index.jsx` + `pages/BOM/BOMEditorModal.jsx`
**Max-width:** `max-w-3xl`
**Roles:** admin only

#### BOM List

```
┌──────────────────────────────────────────────────────────────────┐
│  [Search BOMs…              ]                     [ + New BOM ]  │
├──────────────────────────────────────────────────────────────────┤
│  Product           │ Version │ Components │ Status │             │
├────────────────────┼─────────┼────────────┼────────┼────────────┤
│ Iron Casting Gr A  │ v2      │ 3 items    │ active │ [Edit][v3] │
│ Alloy Bar 25mm     │ v1      │ 2 items    │ active │ [Edit][v2] │
│ Iron Casting Gr A  │ v1      │ 3 items    │inactive│ [View]     │
└──────────────────────────────────────────────────────────────────┘
```

**Columns:** Product name, Version, Component count, Status (`active`/`inactive` badge), Actions.
- `[Edit]` — opens BOM Editor for the active version.
- `[v3]` (version up button) — opens BOM Editor as a new version draft.
- `[View]` — read-only modal for inactive versions.

**Empty state:** "No BOMs defined. Create a BOM to link raw materials to your finished products."

#### BOM Editor Modal

```
┌──────────────────────────────────────────────────────────────────┐
│  BOM Editor — Iron Casting Grade A (v2)                    [✕]  │
│                                                                   │
│  Finished Product:  Iron Casting Grade A                        │
│  Version:           v2  (creating new version will deactivate v1)│
│                                                                   │
├─ Components ────────────────────────────────────── [+ Add Row] ─┤
│  ┌──────────────────────────┬────────────┬──────┬──────────────┐ │
│  │ Raw Material             │ Qty per unit│ UOM  │              │ │
│  ├──────────────────────────┼────────────┼──────┼──────────────┤ │
│  │ [v Iron Scrap       ▼]  │ [4.0      ]│ [kg] │ [🗑]         │ │
│  │ [v Carbon Alloy     ▼]  │ [1.0      ]│ [kg] │ [🗑]         │ │
│  │ [v Flux Powder      ▼]  │ [0.2      ]│ [kg] │ [🗑]         │ │
│  └──────────────────────────┴────────────┴──────┴──────────────┘ │
│                                                                   │
│  ⓘ UOM must match the raw material's stock UOM.                 │
│                                                                   │
│                          [ Cancel ]  [ Save BOM v2 ]             │
└──────────────────────────────────────────────────────────────────┘
```

**Field list:**
| Field | Type | Notes |
|---|---|---|
| `product_id` | Display only (locked) | Shown as product name; not changeable in edit |
| Component `product_id` | Select (all products with type = raw_material) | Required per row |
| Component `qty` | Number > 0, up to 4 decimal places | Required |
| Component `uom` | Text, default from product.uom | Editable |

**UX notes:**
- Raw material selector shows only products flagged as raw materials (or all products if no type flag exists).
- Duplicate component detection: if same product_id added twice, show inline error `text-destructive text-xs`: "This material is already in the BOM."
- "Save BOM v2" calls `PUT /bom/{id}` which creates a new version. The version label in the title is computed from the backend response (current max version + 1), shown after save via toast: "BOM v2 saved and activated. v1 is now inactive."

---

### 3.10 Mobile Dashboard

**Breakpoint:** Applied when `window.innerWidth < 768px` (Tailwind `< md`)
**Component:** Existing `pages/Dashboard/index.jsx` — modified with responsive Tailwind classes

```
Mobile viewport (375px wide)
┌──────────────────────────────────┐
│ ≡  Foundry ERP          [avatar] │  ← Header, hamburger left
├──────────────────────────────────┤
│  ┌────────────┐  ┌─────────────┐ │
│  │ Total Rev  │  │ Outstanding │ │  ← 2-col stat card grid
│  │ ₹8,32,400  │  │ ₹1,44,200  │ │
│  └────────────┘  └─────────────┘ │
│  ┌────────────┐  ┌─────────────┐ │
│  │Open Quots  │  │Active Orders│ │
│  │     12     │  │      8      │ │
│  └────────────┘  └─────────────┘ │
│  ┌─────────────────────────────┐ │
│  │ Overdue Invoices            │ │  ← Full-width card (odd one out)
│  │         3                   │ │
│  └─────────────────────────────┘ │
│                                   │
│  ┌─────────────────────────────┐ │
│  │ Revenue Trend (6 Months)    │ │  ← Chart card: height reduced to 160px
│  │  [AreaChart — 100% width]   │ │     on mobile (ResponsiveContainer)
│  └─────────────────────────────┘ │
│  ┌─────────────────────────────┐ │
│  │ Top Customers               │ │  ← Customers table: hide Paid/Billed
│  │ Customer  │ Outstanding     │ │    on mobile; show name + outstanding
│  └─────────────────────────────┘ │
└──────────────────────────────────┘
```

**Responsive class changes to `Dashboard/index.jsx`:**
- Stat card grid: change `grid grid-cols-2 gap-4 lg:grid-cols-5` — this is already half right.
  - Correct class: `grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-5`
  - The 5th card (Overdue) gets `col-span-2 md:col-span-1` so it spans full width on mobile.
- Chart height: `<ResponsiveContainer width="100%" height={240}>` — add breakpoint via `useWindowWidth` hook: `height={isMobile ? 160 : 240}`.
- Top Customers table: wrap columns in responsive classes using `hidden sm:table-cell` for Billed and Paid columns.

---

### 3.11 Mobile Invoice List

**Route:** `/invoices` — same component, responsive column visibility
**Breakpoint:** `< 768px`

```
Mobile viewport (375px wide)
┌────────────────────────────────────┐
│ [Search invoices…                ] │
├──────────────┬─────────┬───────────┤
│ Invoice #    │ Total   │ Status    │
│ + Customer   │         │ + Actions │
├──────────────┼─────────┼───────────┤
│ INV-3010     │ ₹45,000 │ sent      │
│ Acme Castings│         │[Pay][PDF] │
├──────────────┼─────────┼───────────┤
│ INV-3011     │ ₹18,200 │ overdue   │
│ Royal Metals │         │[Pay][PDF] │
└──────────────┴─────────┴───────────┘
```

**Mobile column strategy:**
- Hidden on mobile (`hidden md:table-cell`): Date, Due Date, Balance
- Visible on all sizes: Invoice #, Total, Status, Actions
- Customer name: shown as a second line inside the Invoice # cell using `<div className="text-xs text-muted-foreground mt-0.5">{row.original.companies?.name}</div>`
- Action buttons on mobile: icon-only (no label text)
  - `[Pay]` → `<Button size="icon" variant="outline"><CreditCard className="h-4 w-4"/></Button>`
  - `[PDF]` → `<Button size="icon" variant="ghost"><Download className="h-4 w-4"/></Button>`
  - `[Edit]` → `<Button size="icon" variant="ghost"><Pencil className="h-4 w-4"/></Button>`

**Implementation:** Add `meta: { hiddenOnMobile: true }` to column definitions for Date, Due Date, Balance. In the DataTable cell renderer, apply `hidden md:table-cell` to those `<td>` elements.

---

### 3.12 Mobile Sidebar (Hamburger Drawer)

**Component:** `components/layout/MobileSidebar.jsx`
**Trigger:** `<Menu>` button in `Header.jsx` (visible only `md:hidden`)

```
Desktop (≥ 768px):              Mobile (< 768px) — drawer closed:
┌─────┬──────────────────┐      ┌──────────────────────────┐
│Sidebar│  Main content  │      │≡  Foundry ERP   [avatar] │
│  w-60 │                │      ├──────────────────────────┤
│       │                │      │     Main content         │
│       │                │      │                          │
└─────┴──────────────────┘      └──────────────────────────┘

Mobile — drawer open:
┌──────────────┬─────────────────┐
│ Foundry ERP  │░░░░░░░░░░░░░░░░│  ← Overlay bg-black/40
│ ─────────    │░░░░░░░░░░░░░░░░│    clicking overlay closes
│ Dashboard    │░░░░░░░░░░░░░░░░│
│ ── SALES ─── │░░░░░░░░░░░░░░░░│
│ Quotations   │░░░░░░░░░░░░░░░░│
│ Sales Orders │░░░░░░░░░░░░░░░░│
│ Invoices     │░░░░░░░░░░░░░░░░│
│ Credit Notes │░░░░░░░░░░░░░░░░│
│  ...         │░░░░░░░░░░░░░░░░│
│              │░░░░░░░░░░░░░░░░│
│ [◇ accounts] │░░░░░░░░░░░░░░░░│
└──────────────┴─────────────────┘
  w-64 fixed   overlay
```

**Implementation spec:**

```jsx
// MobileSidebar.jsx — structure
<>
  {/* Overlay */}
  {open && (
    <div
      className="fixed inset-0 z-40 bg-black/40 md:hidden"
      onClick={onClose}
    />
  )}

  {/* Drawer */}
  <aside
    className={cn(
      "fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transform transition-transform duration-200 ease-out md:hidden",
      open ? "translate-x-0" : "-translate-x-full"
    )}
  >
    {/* Same content as Sidebar.jsx */}
    {/* Brand, nav sections, role badge */}
    {/* Each NavLink onClick fires onClose() */}
  </aside>
</>
```

**Header.jsx changes:**
```jsx
// Add to Header — visible only on mobile
<button
  className="md:hidden p-2 rounded-md hover:bg-gray-100"
  onClick={() => setMobileNavOpen(true)}
  aria-label="Open navigation"
>
  <Menu className="h-5 w-5" />
</button>
```

**State:** `mobileNavOpen` lives in `Layout.jsx` and is passed as prop to both `Header` and `MobileSidebar`.

**The desktop `<aside>` in `Sidebar.jsx`** gains `className="hidden md:flex h-screen w-60 flex-col border-r bg-white"` (add `hidden md:flex`).

---

## 4. PDF Design Specs

All PDFs follow the existing style established in the Invoice PDF:
- Blue `#2563eb` header bar spanning full page width
- Company name top-left of header in white, company logo to the left of name
- Document title top-right of header in white Helvetica-Bold 18pt
- White background body
- `#374151` table header rows with white text
- Alternating `#f9fafb` / white body rows
- Footer: company address + page number

### 4.1 Credit Note PDF

**Header bar color:** `#dc2626` (red — signals reversal/debit to customer)
**Title text:** `CREDIT NOTE`

**Header block layout:**
```
LEFT COLUMN                          RIGHT COLUMN
─────────────────                    ────────────────────────
[Company Logo]                       CN No:    CN-5001
[Company Name] (bold 14pt)           CN Date:  14 Jun 2026
[Company Address]                    Against:  INV-3010
[GSTIN: 27AADCA...]                  INV Date: 01 Apr 2026
[Company State]                      Reason:   Goods returned
```

**Customer block (below header bar):**
```
Bill To:
[Customer Name]
[Customer Address]
[GSTIN: XX...]
[State: Maharashtra]
```

**Items table columns:**
| Column | Width |
|---|---|
| # | 5% |
| Description | 30% |
| HSN Code | 10% |
| UOM | 7% |
| Qty | 8% |
| Rate (₹) | 12% |
| Taxable (₹) | 13% |
| GST % | 7% |
| GST Amt (₹) | 8% |

**Totals block (right-aligned):**
```
Taxable Amount:    ₹X,XXX.XX
CGST @ 9%:         ₹X,XXX.XX
SGST @ 9%:         ₹X,XXX.XX
─────────────────────────────
Credit Amount:     ₹XX,XXX.XX    ← bold, larger font
```
(Or IGST if inter-state; never show both CGST+SGST and IGST simultaneously.)

**GST Summary table (below totals):**
| GST Rate | Taxable | CGST | SGST | IGST |
|---|---|---|---|---|
| 18% | ₹X,XXX | ₹X,XXX | ₹X,XXX | — |

**Footer:**
```
This document reverses the GST charged in Invoice [INV-XXXX].
For [Company Name] | [City] | GSTIN: [GSTIN]    Page 1 of 1
```

**No watermark** on Credit Note (it is a formal issued document).

---

### 4.2 Proforma Invoice PDF

**Header bar color:** `#0891b2` (cyan — non-binding, not tax)
**Title text:** `PROFORMA INVOICE`

**Header block layout:**
```
LEFT COLUMN                          RIGHT COLUMN
─────────────────                    ────────────────────────
[Company Logo]                       PI No:      PI-7001
[Company Name]                       PI Date:    14 Jun 2026
[Company Address]                    Valid Until:14 Jul 2026
[GSTIN: ...]                         Place of Supply: Maharashtra
```

**Customer block:** Identical to Invoice PDF.

**Items table columns:** Identical to Invoice PDF (Description, HSN, UOM, Qty, Rate, Taxable, GST%, GST Amount).

**Totals block:** Identical to Invoice PDF (Taxable, GST breakdown, Grand Total).

**Watermark:** Diagonal watermark across the body of the document:
- Text: `NOT A TAX INVOICE`
- Color: `#0891b2` at 15% opacity
- Font: Helvetica-Bold 48pt
- Rotation: 45 degrees
- Position: Centered on page body

**Footer:**
```
This is a Proforma Invoice only. It does not constitute a Tax Invoice
and has no legal force for GST purposes. Subject to change.
For [Company Name] | GSTIN: [GSTIN]               Page 1 of 1
```

---

### 4.3 Delivery Challan PDF

**Header bar color:** `#7c3aed` (violet — logistics/dispatch)
**Title text:** `DELIVERY CHALLAN`

**Header block layout:**
```
LEFT COLUMN                          RIGHT COLUMN
─────────────────                    ────────────────────────
[Company Logo]                       DC No:        DC-8001
[Company Name]                       DC Date:      14 Jun 2026
[Company Address]                    Against SO:   SO-2015 (if set)
[GSTIN: ...]                         Vehicle No:   MH04 AB 1234
                                     Transporter:  Shree Logistics
```

**Customer block:**
```
Deliver To:
[Customer Name]
[Customer Delivery Address]
```

**Items table columns:**
| Column | Width |
|---|---|
| # | 5% |
| Description of Goods | 45% |
| HSN Code | 15% |
| UOM | 10% |
| Qty | 15% |
| Remarks | 10% |

**CRITICAL: No Rate, Price, or GST columns.** No totals block. No GST summary table.

**Signature block (bottom of page):**
```
Dispatched by:                    Received by:
Name: ____________________        Name: ____________________
Sign: ____________________        Sign: ____________________
Date: ____________________        Date: ____________________

For [Company Name]                [Customer Name]
```

**Footer:**
```
E. & O.E. — For delivery purposes only. Not a Tax Invoice.
[Company Name] | [City] | GSTIN: [GSTIN]           Page 1 of 1
```

**No watermark** (DC is a legitimate dispatch document).

---

### 4.4 GRN PDF

**Header bar color:** `#059669` (green — goods received, stock in)
**Title text:** `GOODS RECEIPT NOTE`

**Header block layout:**
```
LEFT COLUMN                          RIGHT COLUMN
─────────────────                    ────────────────────────
[Company Logo]                       GRN No:       GRN-9001
[Company Name]                       GRN Date:     14 Jun 2026
[Company Address]                    Against PO:   PO-4005
[GSTIN: ...]                         PO Date:      01 Jun 2026
                                     Supplier:     [Supplier Name]
```

**Supplier block:**
```
Received From:
[Supplier Name]
[Supplier Address]
[GSTIN: ...]
```

**Items table columns:**
| Column | Width |
|---|---|
| # | 5% |
| Description | 32% |
| HSN Code | 10% |
| UOM | 8% |
| PO Qty | 12% |
| Previously Received | 13% |
| This GRN Qty | 12% |
| Remarks | 8% |

**Totals block:** None (GRN is a quantity document, not financial).

**Signature block:**
```
Checked by:                       Approved by:
Name: ____________________        Name: ____________________
Sign: ____________________        Sign: ____________________

Store Keeper                      Quality Control / Manager
Date: ____________________        Date: ____________________
```

**Footer:**
```
Goods received in apparent good condition unless noted above.
[Company Name] | [City] | GSTIN: [GSTIN]           Page 1 of 1
```

---

## 5. Component Inventory

Net-new React components required for Phase 2 (components that do not yet exist in the codebase).

---

### 5.1 `DocTypeBadge`

**File:** `frontend/src/components/shared/DocTypeBadge.jsx`

**What it renders:** A colored pill badge for document type labels (Invoice, CN, PI, DC, GRN, WO, AR). Uses the document type color table from §1.1.

**Props:**
```ts
{
  type: 'invoice' | 'cn' | 'pi' | 'dc' | 'grn' | 'wo' | 'ar' | 'po' | 'payment' | 'advance' | 'opening'
  className?: string
}
```

**Implementation note:** Maintains a `colorMap` object keyed by `type`. Returns `<span className={cn(base, colorMap[type], className)}>`. Uses `text-xs font-medium px-2 py-0.5 rounded-full` as base.

---

### 5.2 `ConfirmDialog`

**File:** `frontend/src/components/shared/ConfirmDialog.jsx`

**What it renders:** A reusable shadcn `AlertDialog` for destructive or significant actions. Accepts a title, description (can include the item name), and confirm/cancel callbacks.

**Props:**
```ts
{
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string                // e.g. "Cancel CN-5001?"
  description: string          // e.g. "This action cannot be undone."
  confirmLabel?: string        // default "Confirm"
  confirmVariant?: 'default' | 'destructive'  // default 'destructive'
  onConfirm: () => void
  isPending?: boolean          // shows spinner on confirm button
}
```

**Usage example:**
```jsx
<ConfirmDialog
  open={showCancel}
  onOpenChange={setShowCancel}
  title={`Cancel ${cn.cn_no}?`}
  description="The credit note will be voided. The linked invoice balance will be restored."
  confirmLabel="Cancel Credit Note"
  onConfirm={() => cancelMutation.mutate(cn.id)}
  isPending={cancelMutation.isPending}
/>
```

---

### 5.3 `CustomerLedgerModal`

**File:** `frontend/src/pages/Settings/CustomerLedgerModal.jsx`

**What it renders:** Full-screen modal with date range filter and ledger table (see §3.3).

**Props:**
```ts
{
  open: boolean
  onClose: () => void
  customer: {
    id: string
    name: string
    gstin?: string
  }
}
```

---

### 5.4 `MobileSidebar`

**File:** `frontend/src/components/layout/MobileSidebar.jsx`

**What it renders:** Slide-in drawer navigation for mobile (see §3.12).

**Props:**
```ts
{
  open: boolean
  onClose: () => void
  role: string    // from useAuth()
  company?: { name: string; logo_url?: string }
}
```

---

### 5.5 `AgingReportPage`

**File:** `frontend/src/pages/Reports/AgingReportPage.jsx`

**What it renders:** Shared aging report table used by both Receivables and Payables pages.

**Props:**
```ts
{
  type: 'receivables' | 'payables'
  // type determines: API endpoint, entity label ('Customer'/'Supplier'),
  // title, and CSV filename
}
```

---

### 5.6 `BOMEditorModal`

**File:** `frontend/src/pages/BOM/BOMEditorModal.jsx`

**What it renders:** BOM component editor with dynamic row add/remove (see §3.9).

**Props:**
```ts
{
  open: boolean
  onClose: () => void
  bom?: {         // undefined = new BOM
    id: string
    product_id: string
    version: number
    items: Array<{ product_id: string; qty: number; uom: string }>
  }
  products: Array<{ id: string; name: string; uom: string }>
}
```

---

### 5.7 `WODetailModal`

**File:** `frontend/src/pages/WorkOrders/WODetailModal.jsx`

**What it renders:** Work Order detail with BOM requirements table and status action buttons (see §3.8b).

**Props:**
```ts
{
  open: boolean
  onClose: () => void
  wo: {
    id: string
    wo_no: string
    product: { name: string }
    qty: number
    start_date: string
    target_date: string
    status: 'open' | 'in_progress' | 'done' | 'cancelled'
    assigned_user?: { name: string }
    so?: { so_no: string }
  }
}
```

---

### 5.8 `SectionHeader` (Sidebar section label)

**File:** `frontend/src/components/layout/Sidebar.jsx` (inline component, not a separate file)

**What it renders:** Non-clickable section divider label inside the sidebar nav.

```jsx
// Usage inside Sidebar nav list
function SectionHeader({ label }) {
  return (
    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 pt-4 pb-1">
      {label}
    </div>
  )
}
```

---

### 5.9 `GSTRSummaryBar`

**File:** `frontend/src/pages/Reports/GSTRSummaryBar.jsx`

**What it renders:** The blue summary stat bar on the GSTR-1 page (see §3.4).

**Props:**
```ts
{
  taxable: number
  cgst: number
  sgst: number
  igst: number
  invoiceCount: number
  cnCount: number
}
```

---

## 6. UX Principles

These are binding rules for all Phase 2 development. Deviating requires explicit design approval.

---

### P-1: Destructive actions always require a named confirmation

Any action that cannot be undone (cancel a document, deactivate a user, complete a Work Order that deducts stock, convert a PI to an Invoice) **must** show a `ConfirmDialog` (§5.2) that includes the specific document number or entity name in the title.

**Correct:** `title="Cancel CN-5001?"` — `description="This credit note will be voided and the linked invoice balance restored."`
**Wrong:** Generic `"Are you sure?"` dialog, or no dialog at all, or a JavaScript `window.confirm()`.

Reference: NFR-010, ERP-108, ERP-604.

---

### P-2: Monetary amounts are always right-aligned with ₹ prefix and Indian formatting

All currency displays must use `formatCurrency()` from `@/lib/utils`, which produces `₹1,20,000.00` (Indian comma grouping: 1,00,000 system). Column headers for amount columns carry `text-right` alignment; cells carry `text-right tabular-nums`.

**Correct:** `₹1,20,000.00` right-aligned in a `<td className="text-right tabular-nums">`
**Wrong:** `Rs. 120000`, `$120,000`, `120000.00`, left-aligned currency.

This applies to: table cells, totals blocks, stat cards, PDF line item amounts.

---

### P-3: Status chips follow the color map in §1.3 — no ad-hoc colors

All status values must be rendered using `<Badge className={statusColor(value)}>`. The `statusColor()` utility function in `@/lib/utils.js` is the single source of truth. Adding a new status requires: (a) adding it to the color map in `utils.js`, and (b) adding it to the map table in §1.3 of this document.

**Correct:** `<Badge className={statusColor('in_progress')}>in progress</Badge>`
**Wrong:** `<Badge className="bg-blue-500 text-white">in progress</Badge>` (ad-hoc color, breaks single source of truth).

---

### P-4: Empty states are informative and action-oriented

Every `DataTable` must have an `emptyMessage` prop with a specific, helpful message that names the document type and, where applicable, tells the user what to do first.

**Correct:** `"No delivery challans yet. Create one for goods being dispatched."` with the `<Inbox>` icon (already in DataTable).
**Wrong:** `"No records found."` or `"No data."` (too generic; provides no user guidance).

For pages where the empty state can be caused by a filter (e.g., status filter on Work Orders, date range on GSTR-1), show a different message: `"No records match your current filter. Try clearing the filter."`.

---

### P-5: Forms pre-fill from linked documents and show the source

When a form pre-fills from another document (CN from Invoice, WO from SO line item, Invoice from PI via Convert, Invoice from SO prefill), it must:
1. **Show the source** in the modal title: `"New Credit Note — from INV-3010"` or via an info banner (blue `ⓘ` panel) naming the source document.
2. **Allow editing** all pre-filled fields — pre-fill is a convenience, not a lock.
3. **Not silently override** user edits: if the user has already changed a value, switching the linked invoice dropdown must show a `ConfirmDialog`: "Replace current line items with those from INV-XXXX?"

This prevents data loss from accidental re-selection and makes the audit trail transparent.
