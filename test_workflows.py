import httpx, json, sys, os

os.environ.setdefault("PYTHONIOENCODING", "utf-8")

BASE = "http://localhost:8000/api/v1"
SUPA = "https://cfqxvgcufahcxoutitlq.supabase.co"
SVC  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmcXh2Z2N1ZmFoY3hvdXRpdGxxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDE1NjkzMiwiZXhwIjoyMDk1NzMyOTMyfQ.dp89nnJWOGtn25Q27w2RhnHbcoAUHKXnffkjbyvmj4g"

passed, failed = [], []

def ok(label):
    passed.append(label)
    print(f"  [PASS] {label}")

def fail(label, detail=""):
    failed.append(label)
    print(f"  [FAIL] {label}")
    if detail: print(f"         {detail[:200]}")

def section(title):
    print(f"\n{'='*60}\n {title}\n{'='*60}")

# ── AUTH ──────────────────────────────────────────────────────
section("0. AUTH")
r = httpx.post(f"{SUPA}/auth/v1/token?grant_type=password",
    headers={"apikey": SVC, "Content-Type": "application/json"},
    json={"email": "admin@foundryerp.test", "password": "Admin1234!"}, timeout=30)
token = r.json().get("access_token")
if token: ok("Admin sign-in")
else: fail("Admin sign-in", r.text); sys.exit(1)

H = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# ── SETTINGS: Company ─────────────────────────────────────────
section("1. SETTINGS - Company")
r = httpx.put(f"{BASE}/settings/company", headers=H, json={
    "name": "Foundry Works Pvt Ltd", "gstin": "27AABCF1234L1ZT",
    "state_code": "27", "address": "Plot 45, MIDC, Pune 411019",
    "pan": "AABCF1234L", "phone": "020-12345678",
    "email": "accounts@foundryworks.in", "bank_name": "HDFC Bank",
    "bank_account": "50100123456789", "bank_ifsc": "HDFC0001234",
    "upi_id": "foundryworks@hdfcbank", "cin": None
}, timeout=30)
if r.status_code == 200 and r.json().get("name") == "Foundry Works Pvt Ltd":
    ok("Save company settings")
else:
    fail("Save company settings", f"HTTP {r.status_code}: {r.text}")

r = httpx.get(f"{BASE}/settings/company", headers=H, timeout=30)
if r.status_code == 200 and r.json().get("gstin") == "27AABCF1234L1ZT":
    ok("Company settings persist and are retrievable")
else:
    fail("Company settings persist", r.text)

# ── SETTINGS: Customer ────────────────────────────────────────
section("2. SETTINGS - Customer")
r = httpx.post(f"{BASE}/settings/companies", headers=H, json={
    "name": "Acme Engineering Ltd", "gstin": "27AABCA1234B1ZT",
    "state_code": "27", "city": "Mumbai",
    "phone": "9876543210", "email": "purchase@acme.in", "type": "buyer"
}, timeout=30)
if r.status_code == 201:
    company_id = r.json()["id"]
    ok(f"Create customer (id={company_id[:8]})")
else:
    fail("Create customer", f"HTTP {r.status_code}: {r.text}"); company_id = None

r = httpx.get(f"{BASE}/settings/companies", headers=H, timeout=30)
companies = r.json() if r.status_code == 200 else []
acme = next((c for c in companies if c.get("name") == "Acme Engineering Ltd"), None)
if acme:
    ok(f"Customer appears in companies list ({len(companies)} total)")
    company_id = acme["id"]
else:
    fail("Customer appears in list", str(companies)[:100])

# ── SETTINGS: Product ─────────────────────────────────────────
section("3. SETTINGS - Product")
r = httpx.post(f"{BASE}/settings/products", headers=H, json={
    "name": "Cast Iron Bracket 50mm", "hsn_code": "7325",
    "uom": "NOS", "base_rate": 450.00, "gst_rate": 18, "category": "Castings"
}, timeout=30)
if r.status_code == 201:
    product_id = r.json()["id"]
    ok(f"Create product (id={product_id[:8]})")
else:
    fail("Create product", f"HTTP {r.status_code}: {r.text}"); product_id = None

r = httpx.get(f"{BASE}/settings/products", headers=H, timeout=30)
products = r.json() if r.status_code == 200 else []
bracket = next((p for p in products if p.get("name") == "Cast Iron Bracket 50mm"), None)
if bracket:
    ok(f"Product appears in products list ({len(products)} total)")
    product_id = bracket["id"]
    if float(bracket["base_rate"]) == 450.0 and float(bracket["gst_rate"]) == 18:
        ok("Product pricing (rate=450, gst=18%) saved correctly")
    else:
        fail("Product pricing", f"rate={bracket['base_rate']} gst={bracket['gst_rate']}")
else:
    fail("Product appears in list")

# ── SETTINGS: Users ───────────────────────────────────────────
section("4. SETTINGS - Users")
r = httpx.get(f"{BASE}/settings/users", headers=H, timeout=30)
users = r.json() if r.status_code == 200 else []
if len(users) >= 1:
    ok(f"Users list loads ({len(users)} users)")
else:
    fail("Users list loads", r.text)

other = next((u for u in users if "nirrmal" in u.get("email", "")), None)
if other:
    r = httpx.put(f"{BASE}/settings/users/{other['id']}/role?role=accounts", headers=H, timeout=30)
    if r.status_code == 200: ok("Update user role (sales -> accounts)")
    else: fail("Update user role", r.text)
    httpx.put(f"{BASE}/settings/users/{other['id']}/role?role=sales", headers=H, timeout=30)
    ok("Reset user role back to sales")

# ── QUOTATION ─────────────────────────────────────────────────
section("5. QUOTATION - Create & pricing")
if not company_id or not product_id:
    fail("Quotation tests skipped (missing company_id or product_id)")
else:
    quot_payload = {
        "company_id": company_id,
        "date": "2026-05-31",
        "valid_until": "2026-06-30",
        "status": "draft",
        "notes": "Test quotation",
        "terms": "30 days net",
        "taxable_amt": 9000.00,
        "total_gst": 1620.00,
        "total": 10620.00,
        "items": [
            {"product_id": product_id, "description": "Cast Iron Bracket 50mm",
             "hsn_code": "7325", "uom": "NOS", "qty": 20, "rate": 450.00,
             "gst_rate": 18, "sort_order": 0}
        ]
    }
    r = httpx.post(f"{BASE}/quotations/", headers=H, json=quot_payload, timeout=30)
    if r.status_code == 201:
        quot = r.json()
        quot_id = quot["id"]
        ok(f"Create quotation {quot.get('quot_no')} (id={quot_id[:8]})")
        # Pricing validation: 20 units * 450 = 9000, GST 18% = 1620, total = 10620
        if float(quot.get("taxable_amt", 0)) == 9000.0:
            ok("Quotation taxable amount = 9000.00 (20 x 450)")
        else:
            fail("Quotation taxable amount", f"got {quot.get('taxable_amt')}")
        if float(quot.get("total_gst", 0)) == 1620.0:
            ok("Quotation GST = 1620.00 (18% of 9000)")
        else:
            fail("Quotation GST", f"got {quot.get('total_gst')}")
        if float(quot.get("total", 0)) == 10620.0:
            ok("Quotation total = 10620.00 (9000 + 1620)")
        else:
            fail("Quotation total", f"got {quot.get('total')}")
    else:
        fail("Create quotation", f"HTTP {r.status_code}: {r.text}"); quot_id = None

    # List quotations
    r = httpx.get(f"{BASE}/quotations/", headers=H, timeout=30)
    quots = r.json() if r.status_code == 200 else []
    if any(q.get("id") == quot_id for q in quots):
        ok(f"Quotation appears in list ({len(quots)} total)")
    else:
        fail("Quotation appears in list")

    # Update quantity (10 -> 30 units, update totals)
    if quot_id:
        r = httpx.put(f"{BASE}/quotations/{quot_id}", headers=H, json={
            **quot_payload,
            "taxable_amt": 13500.00, "total_gst": 2430.00, "total": 15930.00,
            "items": [
                {"product_id": product_id, "description": "Cast Iron Bracket 50mm",
                 "hsn_code": "7325", "uom": "NOS", "qty": 30, "rate": 450.00,
                 "gst_rate": 18, "sort_order": 0}
            ]
        }, timeout=30)
        if r.status_code == 200 and float(r.json().get("total", 0)) == 15930.0:
            ok("Update quotation qty 20->30 units, total updated to 15930")
        else:
            fail("Update quotation qty", f"HTTP {r.status_code}: {r.text[:150]}")

    # Status: draft -> sent -> convert to SO
    if quot_id:
        r = httpx.put(f"{BASE}/quotations/{quot_id}", headers=H, json={
            **quot_payload, "status": "sent",
            "taxable_amt": 13500.00, "total_gst": 2430.00, "total": 15930.00,
            "items": [
                {"product_id": product_id, "description": "Cast Iron Bracket 50mm",
                 "hsn_code": "7325", "uom": "NOS", "qty": 30, "rate": 450.00,
                 "gst_rate": 18, "sort_order": 0}
            ]
        }, timeout=30)
        if r.status_code == 200 and r.json().get("status") == "sent":
            ok("Quotation status updated to sent")
        else:
            fail("Quotation status update", f"HTTP {r.status_code}: {r.text[:150]}")

        r = httpx.post(f"{BASE}/quotations/{quot_id}/convert-to-so", headers=H, timeout=30)
        if r.status_code in (200, 201):
            so = r.json()
            so_id = so.get("so_id") or so.get("id")
            ok(f"Convert quotation to SO -> {so.get('so_no')} (id={so_id[:8] if so_id else '?'})")
        else:
            fail("Convert quotation to SO", f"HTTP {r.status_code}: {r.text[:150]}"); so_id = None

# ── SALES ORDER ───────────────────────────────────────────────
section("6. SALES ORDER - Create & list")
if not company_id or not product_id:
    fail("SO tests skipped"); so_id = None
elif not locals().get("so_id"):
    # Create fresh SO if conversion failed
    r = httpx.post(f"{BASE}/orders/", headers=H, json={
        "company_id": company_id, "date": "2026-05-31",
        "delivery_date": "2026-06-15", "status": "draft",
        "taxable_amt": 13500.00, "total_gst": 2430.00, "total": 15930.00,
        "items": [{"product_id": product_id, "description": "Cast Iron Bracket 50mm",
                   "hsn_code": "7325", "uom": "NOS", "qty": 30, "rate": 450.00,
                   "gst_rate": 18, "sort_order": 0}]
    }, timeout=30)
    if r.status_code == 201:
        so_id = r.json()["id"]
        ok(f"Create sales order -> {r.json().get('so_no')}")
    else:
        fail("Create sales order", f"HTTP {r.status_code}: {r.text[:150]}"); so_id = None

r = httpx.get(f"{BASE}/orders/", headers=H, timeout=30)
orders = r.json() if r.status_code == 200 else []
if so_id and any(o.get("id") == so_id for o in orders):
    ok(f"Sales order appears in list ({len(orders)} total)")
else:
    fail("Sales order appears in list")

# Update SO status to confirmed
if so_id:
    r = httpx.get(f"{BASE}/orders/{so_id}", headers=H, timeout=30)
    if r.status_code == 200:
        so_data = r.json()
        so_items = so_data.get("items", [])
        update_payload = {
            "company_id": so_data["company_id"], "date": so_data["date"],
            "delivery_date": so_data.get("delivery_date"), "status": "confirmed",
            "po_reference": None, "notes": None, "terms": None,
            "taxable_amt": float(so_data["taxable_amt"]),
            "total_gst": float(so_data["total_gst"]),
            "total": float(so_data["total"]),
            "items": [{"product_id": i.get("product_id"), "description": i["description"],
                       "hsn_code": i["hsn_code"], "uom": i["uom"],
                       "qty": float(i["qty"]), "rate": float(i["rate"]),
                       "gst_rate": float(i["gst_rate"]), "sort_order": i.get("sort_order", 0)}
                      for i in so_items]
        }
        r2 = httpx.put(f"{BASE}/orders/{so_id}", headers=H, json=update_payload, timeout=30)
        if r2.status_code == 200 and r2.json().get("status") == "confirmed":
            ok("Sales order status updated to confirmed")
        else:
            fail("Update SO status", f"HTTP {r2.status_code}: {r2.text[:150]}")

# ── INVOICE ───────────────────────────────────────────────────
section("7. INVOICE - Create, GST split, payment")
if not company_id or not product_id:
    fail("Invoice tests skipped"); inv_id = None
else:
    inv_payload = {
        "company_id": company_id,
        "so_id": so_id,
        "date": "2026-05-31",
        "due_date": "2026-06-30",
        "place_of_supply": "27",  # same state -> CGST + SGST
        "status": "draft",
        "taxable_amt": 13500.00,
        "cgst": 1215.00, "sgst": 1215.00, "igst": 0.00,
        "total": 15930.00, "amount_paid": 0,
        "items": [
            {"product_id": product_id, "description": "Cast Iron Bracket 50mm",
             "hsn_code": "7325", "uom": "NOS", "qty": 30, "rate": 450.00,
             "gst_rate": 18, "cgst_amt": 1215.00, "sgst_amt": 1215.00,
             "igst_amt": 0.00, "sort_order": 0}
        ]
    }
    r = httpx.post(f"{BASE}/invoices/", headers=H, json=inv_payload, timeout=30)
    if r.status_code == 201:
        inv = r.json()
        inv_id = inv["id"]
        ok(f"Create invoice {inv.get('inv_no')} (id={inv_id[:8]})")
        # GST split validation (intra-state: 9% CGST + 9% SGST)
        if float(inv.get("cgst", 0)) == 1215.0 and float(inv.get("sgst", 0)) == 1215.0:
            ok("GST split correct: CGST=1215 + SGST=1215 (intra-state 27->27)")
        else:
            fail("GST split", f"cgst={inv.get('cgst')} sgst={inv.get('sgst')} igst={inv.get('igst')}")
        if float(inv.get("total", 0)) == 15930.0:
            ok("Invoice total = 15930.00")
        else:
            fail("Invoice total", f"got {inv.get('total')}")
    else:
        fail("Create invoice", f"HTTP {r.status_code}: {r.text[:200]}"); inv_id = None

    r = httpx.get(f"{BASE}/invoices/", headers=H, timeout=30)
    invoices = r.json() if r.status_code == 200 else []
    if inv_id and any(i.get("id") == inv_id for i in invoices):
        ok(f"Invoice appears in list ({len(invoices)} total)")
    else:
        fail("Invoice appears in list")

    # Update status to sent
    if inv_id:
        r = httpx.put(f"{BASE}/invoices/{inv_id}", headers=H, json={
            **inv_payload, "status": "sent"
        }, timeout=30)
        if r.status_code == 200 and r.json().get("status") == "sent":
            ok("Invoice status updated to sent")
        else:
            fail("Invoice status to sent", f"HTTP {r.status_code}: {r.text[:150]}")

    # Record partial payment
    if inv_id:
        r = httpx.post(f"{BASE}/invoices/{inv_id}/payments", headers=H, json={
            "amount": 8000.00,
            "date": "2026-05-31",
            "mode": "bank_transfer",
            "reference": "NEFT/2026/001"
        }, timeout=30)
        if r.status_code == 201:
            ok("Record partial payment of 8000")
        else:
            fail("Record partial payment", f"HTTP {r.status_code}: {r.text[:200]}")

    # Verify payment updated invoice status
    if inv_id:
        r = httpx.get(f"{BASE}/invoices/", headers=H, timeout=30)
        invoices = r.json() if r.status_code == 200 else []
        inv_state = next((i for i in invoices if i.get("id") == inv_id), None)
        if inv_state:
            if float(inv_state.get("amount_paid", 0)) == 8000.0:
                ok("amount_paid = 8000 after payment")
            else:
                fail("amount_paid after payment", f"got {inv_state.get('amount_paid')}")
            if inv_state.get("status") == "partially_paid":
                ok("Invoice status auto-updated to partially_paid")
            else:
                fail("Invoice status after partial payment", f"got {inv_state.get('status')}")

    # Full payment to clear invoice
    if inv_id:
        r = httpx.post(f"{BASE}/invoices/{inv_id}/payments", headers=H, json={
            "amount": 7930.00, "date": "2026-05-31",
            "mode": "bank_transfer", "reference": "NEFT/2026/002"
        }, timeout=30)
        if r.status_code == 201:
            ok("Record final payment of 7930 (clears balance)")
        else:
            fail("Record final payment", f"HTTP {r.status_code}: {r.text[:200]}")

    if inv_id:
        r = httpx.get(f"{BASE}/invoices/", headers=H, timeout=30)
        invoices = r.json() if r.status_code == 200 else []
        inv_state = next((i for i in invoices if i.get("id") == inv_id), None)
        if inv_state and inv_state.get("status") == "paid":
            ok("Invoice status auto-updated to paid after full payment")
        elif inv_state:
            fail("Invoice paid status", f"status={inv_state.get('status')} balance={inv_state.get('balance_due')}")

# ── PURCHASE ORDER ────────────────────────────────────────────
section("8. PURCHASE ORDER - Create & GRN")
if not company_id or not product_id:
    fail("PO tests skipped")
else:
    r = httpx.post(f"{BASE}/purchase-orders/", headers=H, json={
        "company_id": company_id, "date": "2026-05-31",
        "delivery_date": "2026-06-10", "status": "draft",
        "taxable_amt": 4500.00, "total_gst": 810.00, "total": 5310.00,
        "items": [{"product_id": product_id, "description": "Cast Iron Bracket 50mm",
                   "hsn_code": "7325", "uom": "NOS", "qty": 10, "rate": 450.00,
                   "gst_rate": 18, "sort_order": 0}]
    }, timeout=30)
    if r.status_code == 201:
        po = r.json(); po_id = po["id"]
        ok(f"Create purchase order {po.get('po_no')}")
    else:
        fail("Create PO", f"HTTP {r.status_code}: {r.text[:150]}"); po_id = None

    # Update to sent
    if po_id:
        r = httpx.get(f"{BASE}/purchase-orders/{po_id}", headers=H, timeout=30)
        po_data = r.json()
        po_items_data = po_data.get("items", [])
        r2 = httpx.put(f"{BASE}/purchase-orders/{po_id}", headers=H, json={
            "company_id": company_id, "date": "2026-05-31",
            "delivery_date": "2026-06-10", "status": "sent",
            "notes": None, "terms": None,
            "taxable_amt": 4500.00, "total_gst": 810.00, "total": 5310.00,
            "items": [{"product_id": product_id, "description": "Cast Iron Bracket 50mm",
                       "hsn_code": "7325", "uom": "NOS", "qty": 10, "rate": 450.00,
                       "gst_rate": 18, "sort_order": 0}]
        }, timeout=30)
        if r2.status_code == 200 and r2.json().get("status") == "sent":
            ok("PO status updated to sent")
        else:
            fail("PO status to sent", f"HTTP {r2.status_code}: {r2.text[:150]}")

    # Create GRN
    if po_id:
        r = httpx.get(f"{BASE}/purchase-orders/{po_id}", headers=H, timeout=30)
        po_data = r.json()
        po_items_current = po_data.get("items", [])
        if po_items_current:
            grn_payload = {
                "received_date": "2026-05-31",
                "notes": "Goods received in good condition",
                "items": [{"po_item_id": po_items_current[0]["id"],
                           "product_id": product_id,
                           "qty_received": 10, "rate": 450.00}]
            }
            r = httpx.post(f"{BASE}/purchase-orders/{po_id}/grn", headers=H, json=grn_payload, timeout=30)
            if r.status_code == 201:
                grn = r.json()
                ok(f"Create GRN {grn.get('grn_no')} (10 units received)")
            else:
                fail("Create GRN", f"HTTP {r.status_code}: {r.text[:200]}")

# ── INVENTORY ─────────────────────────────────────────────────
section("9. INVENTORY - Stock ledger")
r = httpx.get(f"{BASE}/inventory/stock", headers=H, timeout=30)
if r.status_code == 200:
    stock = r.json()
    ok(f"Inventory stock loads ({len(stock)} products)")
    bracket_stock = next((s for s in stock if "Bracket" in s.get("name", "")), None)
    if bracket_stock:
        balance = float(bracket_stock.get("balance", 0))
        ok(f"Cast Iron Bracket balance = {balance} (expected: +10 GRN - 30 invoiced = -20)")
    else:
        fail("Bracket not in stock list")
else:
    fail("Inventory stock loads", r.text[:100])

if product_id:
    r = httpx.get(f"{BASE}/inventory/stock/ledger/{product_id}", headers=H, timeout=30)
    if r.status_code == 200:
        ledger = r.json()
        ok(f"Stock ledger loads ({len(ledger)} entries)")
        types = [e.get("txn_type") for e in ledger]
        ok(f"Ledger entry types: {types}")
    else:
        fail("Stock ledger loads", r.text[:100])

# ── SUMMARY ───────────────────────────────────────────────────
print(f"\n{'='*60}")
print(f"  RESULTS: {len(passed)} passed / {len(failed)} failed")
print(f"{'='*60}")
if failed:
    print("\nFailed tests:")
    for f in failed:
        print(f"  - {f}")
