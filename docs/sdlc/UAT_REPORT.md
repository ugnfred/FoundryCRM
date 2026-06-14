# UAT Report — Foundry ERP v1.0
**Date:** 2026-06-15
**BA Validator:** AI Business Analyst Agent
**PM Reviewer:** AI Product Manager Agent
**Scope:** Sprints 1–6 (ERP-101 through ERP-609)

---

## PM Certification: ⚠️ CONDITIONAL

Product is certified for production subject to 3 critical fixes listed below.
All core business modules are present and functional.

---

## BA UAT Summary

| Sprint | Stories | Pass | Partial | Fail |
|--------|---------|------|---------|------|
| Sprint 1 | 8 | 7 | 1 | 0 |
| Sprint 2 | 9 | 7 | 2 | 0 |
| Sprint 3 | 9 | 7 | 2 | 0 |
| Sprint 4 | 6 | 6 | 0 | 0 |
| Sprint 5 | 8 | 8 | 0 | 0 |
| Sprint 6 | 9 | 5 | 4 | 0 |
| **Total** | **49** | **40** | **9** | **0** |

---

## Critical Defects (must fix before go-live)

| ID | Gap | File | Description |
|----|-----|------|-------------|
| GAP-01 | GSTR-1 NIC JSON | `backend/app/routers/reports.py → _build_nic_gstr1()` | Blank seller GSTIN, GST rate hardcoded to 18, CDNR section missing — GST portal upload will fail |
| GAP-02 | IRN generation | `backend/app/services/nic_client.py → _build_irn_payload()` | `item["amount"]` KeyError — crashes on first real IRN |
| GAP-03 | Advance balance | `backend/app/routers/advance_receipts.py` + `invoices.py` | available_balance does not subtract already-applied amounts — allows double-application |

## Medium Defects (fix in next sprint)

| ID | Ticket | Description |
|----|--------|-------------|
| D-03 | ERP-202 | CN total not validated against invoice — can exceed invoice amount |
| D-07 | ERP-604 | "Create WO from SO" not implemented; WOForm has no SO prefill |

## Low Defects (backlog)

| ID | Ticket | Description |
|----|--------|-------------|
| D-01 | ERP-103 | GRN list missing Status column |
| D-02 | ERP-105 | GRN PDF "Qty Ordered" column hardcoded as — |
| D-04 | ERP-209 | Customer Ledger doc numbers are plain text, not clickable links |
| D-05 | ERP-302 | GSTR-1 uses from_date/to_date vs month/year per spec |
| D-06 | ERP-306 | Aging export is Excel not CSV as specified |
| D-08 | ERP-604 | Sidebar has no "Manufacturing" section grouping |
| D-09 | ERP-605 | Dashboard chart not collapsible on mobile |
| D-10 | ERP-606 | Invoice list columns not responsive (no column hiding on mobile) |
| D-11 | ERP-607 | Inventory page mobile responsiveness unconfirmed |

---

## GST Compliance Assessment

| Area | Status | Notes |
|------|--------|-------|
| CGST/SGST/IGST split | ✅ Correct | `_calc_gst()` compares state codes correctly |
| E-Invoice IRN (sandbox) | ✅ Works | NIC client with env toggle |
| E-Invoice IRN (production) | ❌ Blocked | GAP-02: KeyError in `_build_irn_payload()` |
| GSTR-1 Excel | ✅ Correct | B2B, B2CS, CDNR, HSN sections all present |
| GSTR-1 NIC JSON | ❌ Defective | GAP-01: blank GSTIN, hardcoded rate, no CDNR |
| GSTR-3B | ✅ Functional | PO-based ITC approximation (disclosed in BRD) |
| Credit Notes in GSTR-1 | ✅ Excel only | CDNR/CDNS in Excel; absent from NIC JSON |
| E-Way Bill | ✅ Correct | EWBModal + generate_ewaybill confirmed |

---

## Accepted Limitations (v1)

- HSN-rate master not built (ERP-701, unscheduled) — free-text HSN entry
- Audit log not built (ERP-705, unscheduled)
- Payment listing per invoice not built
- Mobile column responsiveness partial (sidebar done, table columns not)
- Email/PDF sharing deferred to Phase 3 per BRD agreement
