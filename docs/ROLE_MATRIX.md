# Foundry ERP — Role & Access Matrix

**Last updated:** June 2026  
**Version:** v1.0

---

## Roles Overview

The system has **5 roles**. Each user is assigned exactly one role. The role controls which menu items are visible and which actions can be performed.

| Role | Who it's for |
|------|-------------|
| `admin` | Owner / Manager — full access to everything |
| `sales` | Sales team — quotes, orders, dispatch visibility |
| `accounts` | Finance/Accounts team — billing, payments, purchase |
| `dispatch` | Warehouse/Dispatch team — delivery challans, inventory |
| `production` | Production/Shop-floor team — work orders, BOM, inventory |

---

## Menu Access by Role

| Menu Item | admin | sales | accounts | dispatch | production |
|-----------|:-----:|:-----:|:--------:|:--------:|:----------:|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| Quotations | ✅ | ✅ | — | — | — |
| Proforma Invoice | ✅ | ✅ | — | — | — |
| Sales Orders | ✅ | ✅ | ✅ | — | — |
| Invoices | ✅ | — | ✅ | — | — |
| Credit Notes | ✅ | — | ✅ | — | — |
| Advance Receipts | ✅ | — | ✅ | — | — |
| Delivery Challan | ✅ | ✅ | — | ✅ | — |
| Work Orders | ✅ | — | — | — | ✅ |
| Bill of Materials | ✅ | — | — | — | ✅ |
| Purchase Orders | ✅ | — | ✅ | — | — |
| GRN | ✅ | — | ✅ | — | — |
| Inventory | ✅ | ✅ | ✅ | ✅ | ✅ |
| E-Invoice | ✅ | — | ✅ | — | — |
| Reports | ✅ | ✅ | ✅ | — | — |
| Settings | ✅ | — | — | — | — |

---

## Write Permissions by Module

Beyond visibility, certain actions (Create, Edit, Delete, Status changes) are also role-gated.

| Module | Who can Write |
|--------|--------------|
| Quotations | admin, sales |
| Proforma Invoice | admin, sales |
| Sales Orders | admin, sales |
| Invoices | admin, accounts |
| Credit Notes | admin, accounts |
| Advance Receipts | admin, accounts |
| Delivery Challans | admin, sales, dispatch |
| Work Orders | admin, production |
| Bill of Materials | admin, production |
| Purchase Orders | admin, accounts |
| GRN | admin, accounts |
| Inventory (adjustments) | admin, accounts |
| E-Invoice | admin, accounts |
| Settings (users, company) | admin only |

---

## Role Summary Cards

### 👑 Admin
- Full access — all menus, all write operations
- Can create/edit/deactivate users
- Can change company settings, logo, GSTIN, bank details
- Can manage products and customers

### 🧑‍💼 Sales
- Manages the full sales pipeline: Quote → Proforma → Sales Order → Delivery Challan
- Can see inventory (read-only visibility)
- Can see reports (own activity)
- Cannot see financials: invoices, payments, credit notes
- Cannot see purchase side or production

### 🧾 Accounts
- Manages billing and collections: Invoices, Advance Receipts, Credit Notes
- Can see Sales Orders (to convert to invoice)
- Manages procurement: Purchase Orders, GRNs
- Can generate E-Invoices (GST)
- Cannot see Quotations, Proforma, Delivery Challans
- Cannot see production side

### 🚚 Dispatch
- Only sees Delivery Challans and Inventory
- Focused on what needs to be shipped today
- Cannot create or edit financial documents

### 🏭 Production
- Manages Work Orders and Bill of Materials
- Can see Inventory (to check component stock)
- Can complete Work Orders (which updates inventory)
- Cannot see any sales or finance documents

---

## Managing Users

Users are managed by **admin** only under **Settings → Users & Roles**.

- **Create user**: Enter name, email, password, select role → user can log in immediately
- **Change role**: Click the role badge next to a user and select a new role
- **Deactivate user**: Toggle the active switch → user is immediately blocked from logging in
- **Reactivate user**: Toggle back to active

> **Note:** The `production` role requires the Supabase enum to include 'production'.  
> Migration: `ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'production';`  
> Run once in Supabase Dashboard → SQL Editor.
