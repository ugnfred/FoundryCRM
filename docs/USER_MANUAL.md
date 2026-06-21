# Foundry ERP — User Manual

**Last updated:** June 2026  
**Application:** Foundry ERP (Royal Met Alloys)  
**Version:** v1.0

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Dashboard](#2-dashboard)
3. [Sales Flow](#3-sales-flow)
   - 3.1 Quotations
   - 3.2 Proforma Invoice
   - 3.3 Sales Orders
   - 3.4 Delivery Challan
4. [Finance Flow](#4-finance-flow)
   - 4.1 Invoices
   - 4.2 Advance Receipts
   - 4.3 Credit Notes
   - 4.4 E-Invoice
5. [Purchase Flow](#5-purchase-flow)
   - 5.1 Purchase Orders
   - 5.2 GRN (Goods Receipt Note)
6. [Production Flow](#6-production-flow)
   - 6.1 Bill of Materials (BOM)
   - 6.2 Work Orders
7. [Inventory](#7-inventory)
8. [Reports](#8-reports)
9. [Settings](#9-settings)
10. [Common Workflows End-to-End](#10-common-workflows-end-to-end)

---

## 1. Getting Started

### Logging In
1. Go to the application URL
2. Enter your email and password
3. Click **Sign In**
4. You will land on the Dashboard — menus shown depend on your role

### Logging Out
Click the **→** (logout) icon in the top-right corner of the screen.

### Navigation
- The left sidebar shows all menus available to your role
- The company name and logo appear at the top of the sidebar
- Your current role is shown at the bottom of the sidebar

---

## 2. Dashboard

The dashboard gives a live snapshot of the business.

| Card | What it shows |
|------|--------------|
| Total Revenue | Sum of all paid invoices |
| Outstanding | Balance due across all open invoices |
| Open Quotations | Count of Draft + Sent quotations |
| Active Orders | Sales Orders in Confirmed or Dispatched status |
| Overdue Invoices | Invoices past their due date |

**Revenue Trend chart** — line chart showing invoiced revenue by month for the last 6 months.

**Top Customers by Revenue** — table listing customers ranked by total billed amount, with paid and outstanding columns.

**Recent Invoices** — the 5 most recently created invoices with customer name and amount.

---

## 3. Sales Flow

The typical sales journey: **Quotation → Proforma Invoice → Sales Order → Delivery Challan**

```
Customer Enquiry
      ↓
  Quotation  ──────────────────────→  (rejected / expired)
      ↓ Convert
Proforma Invoice  ────────────────→  (advance payment collected)
      ↓ Confirm
  Sales Order
      ↓              ↓
Delivery Challan   Invoice
 (Dispatch team)  (Accounts team)
```

---

### 3.1 Quotations

**Who uses it:** Sales, Admin

A quotation is the first formal document sent to a prospective customer with pricing.

**Statuses:** Draft → Sent → Converted / Expired

#### Creating a Quotation
1. Go to **Quotations** → click **New Quotation**
2. Select customer (or type to search)
3. Set validity date
4. Add line items: select product, enter quantity, unit price, GST rate
5. The system auto-calculates subtotal, GST, and total
6. Click **Save** — status is Draft
7. Click **Mark as Sent** once you have shared it with the customer

#### Actions
- **Edit** — modify while in Draft or Sent status
- **Convert to Proforma** — creates a Proforma Invoice from this quotation
- **Download PDF** — generates a formatted quotation PDF
- **Delete** — only Draft quotations can be deleted

#### Detail Drawer
Click any row to open the detail panel on the right side:
- Shows the document chain (linked Proforma Invoice if converted)
- Customer details, terms, line items, GST breakdown
- Action buttons: Convert, Edit, PDF, Delete

---

### 3.2 Proforma Invoice

**Who uses it:** Sales, Admin

A proforma invoice is a pre-billing document issued before the actual invoice — commonly used to collect advance payment or for import/export documentation.

**Statuses:** Draft → Sent → Confirmed → Converted (to Invoice)

#### Creating a Proforma Invoice
Two ways:
- From a Quotation: click **Convert to Proforma** in the quotation drawer
- Direct: Go to **Proforma Invoice** → click **New Proforma**

Steps (if creating directly):
1. Select customer
2. Set proforma date and due date
3. Add line items with quantity, rate, and GST
4. Save → Draft

#### Actions
- **Confirm** — marks the proforma as agreed upon
- **Convert to Invoice** — creates a tax invoice from this proforma
- **Download PDF** — indigo-colored PDF
- **Edit / Delete**

---

### 3.3 Sales Orders

**Who uses it:** Sales, Accounts, Admin

A Sales Order (SO) is the confirmed internal document that drives production and dispatch.

**Statuses:** Confirmed → Dispatched → Completed / Cancelled

#### Creating a Sales Order
Two ways:
- From a Proforma Invoice: click **Convert to SO**
- Direct: Go to **Sales Orders** → click **New Sales Order**

Steps:
1. Select customer
2. Select products and quantities
3. Set delivery date, shipping address, payment terms
4. Save — status is Confirmed

#### Actions
- **Mark as Dispatched** — when goods have left the warehouse (after DC is created)
- **Create Delivery Challan** — opens DC form pre-filled from this SO
- **Create Invoice** — opens invoice form pre-filled from this SO
- **Cancel** — marks SO as cancelled (cannot undo)
- **Download PDF**, **Edit**

#### Detail Drawer
Shows the full document chain: linked Proforma → current SO → linked Invoices and DCs.

---

### 3.4 Delivery Challan (DC)

**Who uses it:** Sales, Dispatch, Admin

A Delivery Challan documents the physical movement of goods from warehouse to customer. It is not a billing document — no GST amounts.

**Statuses:** Draft → Dispatched → Returned

#### Creating a DC
- From a Sales Order: click **Create DC** in the SO drawer
- Direct: Go to **Delivery Challan** → click **New DC**

Steps:
1. Select customer and linked Sales Order
2. Set dispatch date
3. Enter vehicle number, transporter name, LR number (lorry receipt) if applicable
4. Add items and quantities being dispatched
5. Save

#### Actions
- **Mark as Dispatched** — confirms goods have left
- **Mark as Returned** — if goods come back
- **Download PDF**, **Edit**, **Delete** (Draft only)

---

## 4. Finance Flow

```
Sales Order
    ↓
  Invoice  ←──── Proforma Invoice (Convert)
    ↓
Payment Collected
    ↓             ↓
  (Close)    Advance Receipt
                  (recorded earlier)

If returns/adjustments:
  Invoice → Credit Note
```

---

### 4.1 Invoices

**Who uses it:** Accounts, Admin

A tax invoice is the GST-compliant billing document raised against the customer.

**Statuses:** Draft → Sent → Partially Paid → Paid / Overdue

#### Creating an Invoice
Three ways:
- From Sales Order: click **Create Invoice** in the SO drawer
- From Proforma Invoice: click **Convert to Invoice**
- Direct: Go to **Invoices** → click **New Invoice**

Steps:
1. Select customer
2. Link to Sales Order (optional)
3. Set invoice date, due date
4. Add line items — product, qty, rate, GST rate
5. Apply any advance receipt adjustment
6. Save

#### Recording a Payment
In the invoice detail drawer:
1. Click **Record Payment**
2. Enter amount, payment date, mode (NEFT/RTGS/Cheque/Cash/UPI), reference number
3. Save — balance due updates automatically
4. Once balance = 0, status changes to **Paid**

#### Detail Drawer
Shows:
- Payment progress bar (paid %)
- Due date (highlighted red if overdue)
- Line items + GST summary
- Payment history table

#### Actions
- **Record Payment**, **Send**, **Download PDF** (teal-colored)
- **Edit** (Draft only), **Cancel**

---

### 4.2 Advance Receipts

**Who uses it:** Accounts, Admin

Records advance payments received from customers before the invoice is raised.

#### Creating an Advance Receipt
1. Go to **Advance Receipts** → click **New Receipt**
2. Select customer
3. Enter amount, date, payment mode, reference number
4. Check **PDC** (Post-Dated Cheque) if applicable — the amount will show in a special badge
5. Save

The advance can then be applied when creating an invoice (reduces balance due).

---

### 4.3 Credit Notes

**Who uses it:** Accounts, Admin

A credit note reduces the amount owed by a customer — issued for returns, pricing errors, or quality claims.

**Linked to:** An existing invoice

#### Creating a Credit Note
1. Go to **Credit Notes** → click **New Credit Note**
2. Select the original invoice it's against
3. Customer is auto-filled from the invoice
4. Add items and quantities being credited
5. Save

The credit amount is displayed in red in the detail drawer.

---

### 4.4 E-Invoice

**Who uses it:** Accounts, Admin

E-Invoice is the GST-mandated electronic invoice system. Invoices are uploaded to the NIC portal and get an IRN (Invoice Reference Number) and QR code.

#### Workflow
1. Go to **E-Invoice**
2. Select invoices that need to be submitted
3. Click **Generate E-Invoice** — the system calls the NIC/IRP API
4. On success: IRN and QR code are saved against the invoice
5. Download the signed PDF with QR code for sending to customer

> **Note:** Requires valid GST credentials configured in Settings → Company.  
> Sandbox mode is available for testing (configured in Settings → Company → E-Invoice Environment).

---

## 5. Purchase Flow

```
Purchase requirement identified
          ↓
   Purchase Order (PO)
          ↓ Supplier delivers
   Goods Receipt Note (GRN)
          ↓
   Inventory updated automatically
```

---

### 5.1 Purchase Orders

**Who uses it:** Accounts, Admin

A Purchase Order is a formal document sent to a supplier to order materials/components.

**Statuses:** Draft → Sent → Partially Received → Received / Cancelled

#### Creating a PO
1. Go to **Purchase Orders** → click **New PO**
2. Select supplier (from companies list)
3. Set order date and expected delivery date
4. Add line items — product, qty, rate, GST
5. Save

#### Detail Drawer
Shows:
- Received qty vs ordered qty progress bar per line item
- Supplier details
- Action to create GRN

#### Actions
- **Create GRN** — when goods arrive
- **Download PDF**, **Edit**, **Cancel**

---

### 5.2 GRN (Goods Receipt Note)

**Who uses it:** Accounts, Admin

A GRN records what was physically received from a supplier against a PO.

#### Creating a GRN
- From a Purchase Order: click **Create GRN** in the PO drawer (pre-fills items)
- Direct: Go to **GRN** → click **New GRN**

Steps:
1. Select the PO (required)
2. Set receipt date and vehicle/transporter details
3. For each item, enter **qty received** (can be partial)
4. Save — inventory is updated with received quantities

If partial: PO status goes to **Partially Received**, and a second GRN can be created for the balance.

---

## 6. Production Flow

```
Product demand (Sales Order)
          ↓
  Bill of Materials (BOM)
  (defines components needed)
          ↓
   Work Order created
  (links product + BOM + SO)
          ↓
  Components checked vs stock
          ↓
   Work Order Completed
          ↓
  Finished goods → Inventory +
  Components consumed → Inventory -
```

---

### 6.1 Bill of Materials (BOM)

**Who uses it:** Production, Admin

A BOM defines what raw materials/components are needed to manufacture one unit of a finished product. BOMs are versioned — you can create a new version without deleting the old one.

#### Creating a BOM
1. Go to **Bill of Materials** → click **New BOM**
2. Select the finished product
3. Add components: select component product, quantity, UOM (unit of measure)
4. Add notes if needed
5. Save — this becomes the **active version** for that product

#### Versioning
- Only one BOM version per product is **Active** at a time
- Click **New Version** on an active BOM to create an updated version (old version becomes Inactive)
- Work Orders always use the current active BOM

---

### 6.2 Work Orders

**Who uses it:** Production, Admin

A Work Order is a manufacturing job — it specifies what to make, how many, by when, and links to the BOM and Sales Order.

**Statuses:** Open → In Progress → Done / Cancelled

#### Creating a Work Order
1. Go to **Work Orders** → click **New Work Order**
2. Select the product to manufacture
3. Enter quantity
4. Set target date
5. Link to a Sales Order (optional but recommended)
6. Save — status is **Open**

#### Detail Drawer
Shows:
- Job details and target date
- BOM requirements table: component, required qty, in-stock qty, shortage
- **Shortage alert** if any component is insufficient for the run

#### Workflow
1. **Start** — change status to In Progress (production begins)
2. If shortages: procure materials first (create PO → GRN)
3. **Mark Complete** — deducts components from inventory, adds finished product to inventory
   - Blocked if there are material shortages
   - Confirms with a dialog before completing (irreversible)
4. **Cancel** — cancels the job (status Cancelled, no stock impact)

---

## 7. Inventory

**Who uses it:** All roles (view), Accounts/Admin (adjustments)

The Inventory module shows real-time stock levels for all products.

#### What you see
- Product name and SKU
- Current stock quantity and UOM
- Reorder level (if configured)
- Stock value (qty × last purchase price)

#### Stock is updated automatically by:
- **GRN created** → stock increases for received items
- **Work Order completed** → finished product stock increases, component stock decreases
- **Manual adjustment** → admin/accounts can record stock corrections (e.g., physical count variance)

#### Manual Adjustment
1. Go to **Inventory**
2. Click **Adjust** on a product
3. Enter adjustment quantity (positive = add, negative = reduce)
4. Add reason (e.g., "Physical count variance", "Damaged goods write-off")
5. Save

---

## 8. Reports

**Who uses it:** Sales, Accounts, Admin

Reports provide summarized views of business data for decision-making.

| Report | Description |
|--------|------------|
| Sales Summary | Revenue by period, customer, product |
| Outstanding Receivables | Invoices with balance due, aged (30/60/90 days) |
| GST Report | GSTR-1 and GSTR-3B summary for filing |
| Inventory Report | Stock levels and valuation |
| Customer Ledger | Full transaction history per customer |

#### Generating a Report
1. Go to **Reports**
2. Select report type
3. Set date range (From Date / To Date)
4. Optionally filter by customer, product, or status
5. Click **Generate**
6. Download as PDF or Excel

---

## 9. Settings

**Who uses it:** Admin only

Settings manages master data and system configuration.

### Company Settings
- Company name, GSTIN, PAN, CIN
- Address, city, pincode, state code
- Contact: phone, email
- Bank details: bank name, account number, IFSC
- UPI ID for payment QR on invoices
- Company logo (URL)
- E-Invoice environment: Sandbox or Production

### Users & Roles
- View all users with their role and active status
- **Create User**: name, email, password, role
- **Change Role**: click role badge → select new role → save
- **Deactivate / Reactivate**: toggle active status

### Products (Master)
- Create and manage the product catalog
- Fields: name, SKU, UOM, HSN code, GST rate, purchase price, sale price
- Deactivate products that are no longer sold/used (they won't appear in dropdowns)

### Customers / Suppliers (Companies)
- A single "Companies" list serves as both customer and supplier master
- Fields: name, GSTIN, PAN, address, contact person, phone, email
- Set opening balance for customer ledger
- Deactivate inactive companies

---

## 10. Common Workflows End-to-End

### Scenario A — New Customer Order (Full Sales Cycle)

| Step | Module | Action | Role |
|------|--------|--------|------|
| 1 | Quotations | Create quotation, mark Sent | Sales |
| 2 | Quotations | Convert to Proforma Invoice | Sales |
| 3 | Proforma Invoice | Confirm, collect advance | Accounts |
| 4 | Proforma Invoice | Convert to Sales Order | Sales |
| 5 | Sales Orders | Create Work Order (if manufacturing) | Production |
| 6 | Work Orders | Complete WO → stock ready | Production |
| 7 | Sales Orders | Create Delivery Challan | Dispatch |
| 8 | Delivery Challan | Mark as Dispatched | Dispatch |
| 9 | Sales Orders | Create Invoice | Accounts |
| 10 | Invoices | Record Payment → mark Paid | Accounts |

---

### Scenario B — Quick Invoice (No Quotation)

| Step | Module | Action | Role |
|------|--------|--------|------|
| 1 | Invoices | Create Invoice directly | Accounts |
| 2 | Invoices | Record Payment | Accounts |

---

### Scenario C — Purchase and Stock Replenishment

| Step | Module | Action | Role |
|------|--------|--------|------|
| 1 | Purchase Orders | Create PO, send to supplier | Accounts |
| 2 | GRN | Create GRN when goods arrive | Accounts |
| 3 | Inventory | Stock levels updated automatically | — |

---

### Scenario D — Material Return / Credit

| Step | Module | Action | Role |
|------|--------|--------|------|
| 1 | Credit Notes | Create CN against original invoice | Accounts |
| 2 | Inventory | Adjust stock if goods returned | Accounts |

---

### Scenario E — New Production Run

| Step | Module | Action | Role |
|------|--------|--------|------|
| 1 | BOM | Verify/update BOM for the product | Production |
| 2 | Work Orders | Create WO, set qty and target date | Production |
| 3 | Work Orders | Check shortage report in WO drawer | Production |
| 4 | Purchase Orders | Raise PO for any shortages | Accounts |
| 5 | GRN | Receive materials, stock updated | Accounts |
| 6 | Work Orders | Start WO → In Progress | Production |
| 7 | Work Orders | Mark Complete → finished goods added | Production |

---

## Appendix — Document Number Series

| Document | Series | Example |
|----------|--------|---------|
| Quotation | QT-YYYY-NNNN | QT-2026-0001 |
| Proforma Invoice | PI-YYYY-NNNN | PI-2026-0001 |
| Sales Order | SO-YYYY-NNNN | SO-2026-0001 |
| Invoice | INV-NNNN | INV-3001 |
| Credit Note | CN-YYYY-NNNN | CN-2026-0001 |
| Delivery Challan | DC-YYYY-NNNN | DC-2026-0001 |
| Purchase Order | PO-YYYY-NNNN | PO-2026-0001 |
| GRN | GRN-YYYY-NNNN | GRN-2026-0001 |
| Work Order | WO-YYYY-NNNN | WO-2026-0001 |
| Advance Receipt | AR-YYYY-NNNN | AR-2026-0001 |

---

## Appendix — GST Rates Used

| Rate | Applies to |
|------|-----------|
| 0% | Exempt goods |
| 5% | Basic commodities |
| 12% | Standard manufactured goods |
| 18% | Engineering components (most items) |
| 28% | Luxury / special goods |

GST is split as CGST + SGST for intrastate, IGST for interstate (based on customer state code vs company state code).

---

*Document maintained by: Admin / IT*  
*For support, contact the system administrator.*
