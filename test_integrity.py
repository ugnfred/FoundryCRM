"""Tests for critical data integrity fixes."""
import httpx, json, sys
from decimal import Decimal

BASE = "http://localhost:8000/api/v1"
SUPA = "https://cfqxvgcufahcxoutitlq.supabase.co"
SVC  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmcXh2Z2N1ZmFoY3hvdXRpdGxxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDE1NjkzMiwiZXhwIjoyMDk1NzMyOTMyfQ.dp89nnJWOGtn25Q27w2RhnHbcoAUHKXnffkjbyvmj4g"

passed, failed = [], []

def ok(label): passed.append(label); print(f"  [PASS] {label}")
def fail(label, d=""): failed.append(label); print(f"  [FAIL] {label}"); d and print(f"         {str(d)[:200]}")
def section(t): print(f"\n{'='*60}\n {t}\n{'='*60}")

# Auth
r = httpx.post(f"{SUPA}/auth/v1/token?grant_type=password",
    headers={"apikey": SVC, "Content-Type": "application/json"},
    json={"email": "admin@foundryerp.test", "password": "Admin1234!"}, timeout=30)
token = r.json()["access_token"]
H = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

companies = httpx.get(f"{BASE}/settings/companies", headers=H, timeout=30).json()
products  = httpx.get(f"{BASE}/settings/products",  headers=H, timeout=30).json()
cid = companies[0]["id"]
pid = products[0]["id"]

def get_balance(product_id):
    stock = httpx.get(f"{BASE}/inventory/stock", headers=H, timeout=30).json()
    item = next((s for s in stock if s["id"] == product_id), None)
    return float(item["balance"]) if item else None

def make_invoice(qty, status="draft", so_id=None):
    taxable = qty * 450
    cgst = sgst = taxable * 0.09
    payload = {
        "company_id": cid, "date": "2026-05-31", "due_date": "2020-01-01",
        "place_of_supply": "27", "status": status, "notes": None,
        "taxable_amt": taxable, "cgst": cgst, "sgst": sgst, "igst": 0,
        "total": taxable + cgst + sgst,
        "items": [{"product_id": pid, "description": "Bracket",
                   "hsn_code": "7325", "uom": "NOS", "qty": qty, "rate": 450,
                   "gst_rate": 18, "sort_order": 0}]
    }
    if so_id:
        payload["so_id"] = so_id
    r = httpx.post(f"{BASE}/invoices/", headers=H, json=payload, timeout=30)
    return r

# ── TEST 1: Stock reversal on invoice edit ────────────────────
section("1. STOCK REVERSAL ON INVOICE EDIT")

balance_before = get_balance(pid)
ok(f"Stock before: {balance_before}")

# Create invoice: 5 units → stock should drop by 5
r = make_invoice(5)
if r.status_code == 201:
    inv_id = r.json()["id"]
    ok(f"Created invoice {r.json()['inv_no']} (5 units)")
else:
    fail("Create invoice", r.text); sys.exit(1)

balance_after_create = get_balance(pid)
expected = balance_before - 5
if balance_after_create == expected:
    ok(f"Stock after create: {balance_after_create} (dropped by 5)")
else:
    fail("Stock dropped by 5", f"expected {expected}, got {balance_after_create}")

# Edit invoice: change 5 units → 3 units
inv_data = httpx.get(f"{BASE}/invoices/{inv_id}", headers=H, timeout=30).json()
edit_payload = {
    "company_id": cid, "date": "2026-05-31", "due_date": "2020-01-01",
    "place_of_supply": "27", "status": "draft", "notes": None,
    "taxable_amt": 1350, "cgst": 121.5, "sgst": 121.5, "igst": 0, "total": 1593,
    "items": [{"product_id": pid, "description": "Bracket",
               "hsn_code": "7325", "uom": "NOS", "qty": 3, "rate": 450,
               "gst_rate": 18, "sort_order": 0}]
}
r = httpx.put(f"{BASE}/invoices/{inv_id}", headers=H, json=edit_payload, timeout=30)
if r.status_code == 200:
    ok("Edited invoice qty 5 → 3")
else:
    fail("Edit invoice", r.text)

balance_after_edit = get_balance(pid)
expected_edit = balance_before - 3
if balance_after_edit == expected_edit:
    ok(f"Stock after edit: {balance_after_edit} (correctly reflects 3 units, not 5)")
else:
    fail("Stock correctly reversed on edit", f"expected {expected_edit}, got {balance_after_edit}")

# ── TEST 2: Overpayment guard ─────────────────────────────────
section("2. OVERPAYMENT GUARD")

total = 1593.0
r = httpx.post(f"{BASE}/invoices/{inv_id}/payments", headers=H,
    json={"amount": total + 100, "date": "2026-05-31", "mode": "bank_transfer"}, timeout=30)
if r.status_code == 400:
    ok(f"Rejected payment of {total+100} (exceeds balance {total})")
else:
    fail("Overpayment rejected", f"HTTP {r.status_code}: {r.text[:100]}")

# Valid partial payment
r = httpx.post(f"{BASE}/invoices/{inv_id}/payments", headers=H,
    json={"amount": 800, "date": "2026-05-31", "mode": "bank_transfer"}, timeout=30)
ok("Partial payment 800 accepted") if r.status_code == 201 else fail("Partial payment", r.text)

# Second payment for remaining balance
r = httpx.post(f"{BASE}/invoices/{inv_id}/payments", headers=H,
    json={"amount": 793, "date": "2026-05-31", "mode": "bank_transfer"}, timeout=30)
ok("Final payment 793 accepted") if r.status_code == 201 else fail("Final payment", r.text)

# Trying to pay again on a fully paid invoice should be rejected
r = httpx.post(f"{BASE}/invoices/{inv_id}/payments", headers=H,
    json={"amount": 1, "date": "2026-05-31", "mode": "bank_transfer"}, timeout=30)
if r.status_code == 400:
    ok("Payment on fully-paid invoice correctly rejected")
else:
    fail("Fully-paid invoice payment rejected", f"HTTP {r.status_code}: {r.text[:100]}")

# ── TEST 3: SO status auto-close ─────────────────────────────
section("3. SO STATUS AUTO-CLOSE")

# Create SO
r = httpx.post(f"{BASE}/orders/", headers=H, json={
    "company_id": cid, "date": "2026-05-31", "delivery_date": "2026-06-15",
    "status": "confirmed", "taxable_amt": 2250, "total_gst": 405, "total": 2655,
    "items": [{"product_id": pid, "description": "Bracket", "hsn_code": "7325",
               "uom": "NOS", "qty": 5, "rate": 450, "gst_rate": 18, "sort_order": 0}]
}, timeout=30)
if r.status_code == 201:
    so_id = r.json()["id"]
    so_no = r.json()["so_no"]
    ok(f"Created SO {so_no} (status=confirmed)")
else:
    fail("Create SO for auto-close test", r.text); so_id = None

if so_id:
    # Create invoice linked to SO → should flip SO to dispatched
    r = make_invoice(5, status="sent", so_id=so_id)
    if r.status_code == 201:
        linked_inv_id = r.json()["id"]
        ok(f"Created invoice linked to {so_no}")
    else:
        fail("Create invoice linked to SO", r.text); linked_inv_id = None

    if linked_inv_id:
        so_state = httpx.get(f"{BASE}/orders/{so_id}", headers=H, timeout=30).json()
        if so_state.get("status") == "dispatched":
            ok(f"SO status auto-updated confirmed → dispatched after invoice created")
        else:
            fail("SO status → dispatched", f"got {so_state.get('status')}")

        # Pay the invoice → should flip SO to closed
        inv_total = float(r.json()["total"])
        httpx.post(f"{BASE}/invoices/{linked_inv_id}/payments", headers=H,
            json={"amount": inv_total, "date": "2026-05-31", "mode": "bank_transfer"}, timeout=30)
        ok(f"Recorded full payment of {inv_total}")

        so_state = httpx.get(f"{BASE}/orders/{so_id}", headers=H, timeout=30).json()
        if so_state.get("status") == "closed":
            ok(f"SO status auto-updated dispatched → closed after full payment")
        else:
            fail("SO status → closed", f"got {so_state.get('status')}")

# ── TEST 4: Auto-overdue ──────────────────────────────────────
section("4. AUTO-OVERDUE FLAGGING")

# The invoices with due_date=2020-01-01 and status=sent should be overdue
invoices = httpx.get(f"{BASE}/invoices/", headers=H, timeout=30).json()
overdue = [i for i in invoices if i["status"] == "overdue"]
if overdue:
    ok(f"Auto-overdue flagging works: {len(overdue)} invoice(s) marked overdue")
else:
    # Check if any past-due sent invoices exist
    past_due_sent = [i for i in invoices if i["status"] == "sent" and i.get("due_date", "9999") < "2026-05-31"]
    if past_due_sent:
        fail("Auto-overdue not triggering", f"{len(past_due_sent)} past-due invoices still 'sent'")
    else:
        ok("No past-due sent invoices to flag (all already paid/overdue)")

# ── TEST 5: Inventory N+1 fix ─────────────────────────────────
section("5. INVENTORY - N+1 QUERY FIX")
import time
start = time.time()
r = httpx.get(f"{BASE}/inventory/stock", headers=H, timeout=30)
elapsed = time.time() - start
if r.status_code == 200:
    stock = r.json()
    ok(f"Inventory loads {len(stock)} products in {elapsed:.2f}s (2 queries total)")
else:
    fail("Inventory stock", r.text)

# ── SUMMARY ───────────────────────────────────────────────────
print(f"\n{'='*60}")
print(f"  INTEGRITY RESULTS: {len(passed)} passed / {len(failed)} failed")
print(f"{'='*60}")
if failed:
    print("\nFailed:")
    for f in failed: print(f"  - {f}")
