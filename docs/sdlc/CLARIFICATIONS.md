# BA Clarifications — Foundry ERP
**Role:** Business Analyst
**Date:** 2026-06-14
**Status:** ANSWERED — BRD in progress

The BA has read the approved PRD. The questions below must be answered before the BRD can be written. Please reply with your answers (numbered) and say "write the BRD" when done.

---

## Group A — Credit Notes (F-01)

**A1.** Should a Credit Note be linked to a specific invoice, or can it be standalone (e.g. for goodwill adjustments)?
> *Linked means it reduces that invoice's balance_due. Standalone means it creates a credit on the customer ledger.*

**A2.** When a credit note is issued, should it automatically update the customer's outstanding balance, or does the accounts team manually apply it to a future invoice?

**A3.** Does the CN need its own GST treatment (i.e. reverse the original CGST/SGST/IGST split), and does it need to appear in GSTR-1 as a negative entry?

---

## Group B — GST Reports (F-02, F-14)

**B1.** For GSTR-1 — is a **downloadable summary table** (PDF/Excel) sufficient for now, or do you need a **JSON export** in the exact NIC format (for direct upload to the GST portal)?

**B2.** Should GSTR-1 cover only B2B invoices (with customer GSTIN) or also B2C (without GSTIN)?

**B3.** Is GSTR-3B in scope for this phase, or should it be a later feature? *(GSTR-3B requires input tax credit from purchase side — more complex.)*

---

## Group C — Delivery Challan (F-07)

**C1.** Is a Delivery Challan always raised **before** the invoice (goods dispatched, invoice follows), or can it be raised **alongside** the invoice?

**C2.** Should a Delivery Challan auto-generate from a Sales Order when it is marked "Dispatched", or is it always created manually?

**C3.** Does the DC need its own sequential number (DC-XXXX) and a separate PDF format, or can it reuse the quotation-style PDF with a "DELIVERY CHALLAN" header?

---

## Group D — Proforma Invoice (F-08)

**D1.** Should Proforma Invoices use a **separate number series** (PI-0001) or share the invoice sequence (INV-XXXX)?

**D2.** Must a Proforma be **convertible** to a Tax Invoice (one click, same line items, new INV number), or is it a standalone document?

**D3.** Should a Proforma affect stock or the customer's outstanding balance? *(Typically: No — it is not a legal document.)*

---

## Group E — Email / PDF Sharing (F-09)

**E1.** Which email method do you prefer?
- (a) **SMTP** — configure your own Gmail / Outlook / company mail server in Settings
- (b) **SendGrid / AWS SES** — transactional email, requires API key and domain setup

**E2.** Which documents should be emailable: Quotation, Proforma, Invoice, Delivery Challan — or all of them?

**E3.** Should the email body be a fixed template, or should the accounts staff be able to type a custom message each time?

---

## Group F — GRN (F-06)

**F1.** Should GRN have its own list page (like PO/Invoice list), or is viewing GRN history from within the PO sufficient?

**F2.** Can a single PO have **multiple GRNs** (partial deliveries)? *(The current schema supports this, but the UI only shows one GRN action.)*

**F3.** Does a GRN need a PDF / printed copy for the store keeper to sign?

---

## Group G — Advance & PDC Tracking (F-10)

**G1.** Are advances tracked **per customer** (customer has a running credit balance) or **per sales order** (advance tied to a specific order)?

**G2.** When an advance is received, does it appear as a payment on the customer's account, or is it a separate "advance receipt" document?

**G3.** Are post-dated cheques (PDC) just tracked as notes, or do they need reminder alerts when the cheque date arrives?

---

## Group H — User Management

**H1.** How should new users be added?
- (a) Admin creates a username + password directly in the app
- (b) Admin enters email → user receives a magic link (Supabase invite)

**H2.** Should the admin be able to **deactivate** a user (prevent login) without deleting their historical records?

---

## Group I — Scope Confirmation

**I1.** The PRD marks BOM, Work Orders, Mobile UI, and Payment Gateway as "Should / Could" — are any of these needed **before** the first real customer goes live, or can they wait for v2?

**I2.** The PRD marks Multi-GSTIN, TDS/TCS, and Recurring Invoices as "Won't (v1)". Do you confirm these are out of scope for the BRD?

**I3.** Is there any feature not mentioned in the PRD that you know the first customer will ask for on Day 1?

---

*Please answer each question (use the codes A1, B2, etc.) and say "write the BRD" when done.*
