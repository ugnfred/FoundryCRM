"""
BA Flow Tester — exercises the full user journey via HTTP against the deployed API.

Catches API-level defects (validation errors, wrong status codes, bad totals,
duplicate documents, broken PDF endpoints) before the user finds them manually.

Usage:
    python -m sdlc ba-test                    # uses API_BASE_URL from .env
    python -m sdlc ba-test https://your.url   # override URL for this run
"""
from __future__ import annotations

import os
import sys
import time
from datetime import date, timedelta
from pathlib import Path

import requests

# ── Bootstrap .env ──────────────────────────────────────────────────────────
_ENV = Path(__file__).parent / ".env"
if _ENV.exists():
    for _line in _ENV.read_text(encoding="utf-8").splitlines():
        _line = _line.strip()
        if not _line or _line.startswith("#") or "=" not in _line:
            continue
        _k, _, _v = _line.partition("=")
        os.environ.setdefault(_k.strip(), _v.strip().strip('"').strip("'"))

API_BASE       = os.environ.get("API_BASE_URL",    "https://foundrycrm-production.up.railway.app")
SUPABASE_URL   = os.environ.get("SUPABASE_URL",    "https://zdpfbtvuxncwbvovfnxk.supabase.co")
SUPABASE_ANON  = os.environ.get("SUPABASE_ANON_KEY", "")
TEST_EMAIL     = os.environ.get("TEST_EMAIL",      "")
TEST_PASSWORD  = os.environ.get("TEST_PASSWORD",   "")

TODAY      = str(date.today())
NEXT_WEEK  = str(date.today() + timedelta(days=7))

_SEP = "=" * 62


class _Bug:
    __slots__ = ("bug_id", "severity", "title", "journey", "steps", "expected", "actual", "endpoint")

    def __init__(self, bug_id, severity, title, journey, steps, expected, actual, endpoint=""):
        self.bug_id    = bug_id
        self.severity  = severity
        self.title     = title
        self.journey   = journey
        self.steps     = steps
        self.expected  = expected
        self.actual    = actual
        self.endpoint  = endpoint


class BAFlowTester:

    def __init__(self, api_base: str | None = None):
        self.api = (api_base or API_BASE).rstrip("/")
        self.session = requests.Session()
        self.session.timeout = 20
        self._results: list[tuple[str, str]] = []   # (PASS|FAIL, label)
        self._bugs: list[_Bug] = []
        self._bug_seq = 0
        # state shared across journeys
        self.customer_id: str | None = None
        self.quotation_id: str | None = None
        self.so_id: str | None = None
        self.invoice_id: str | None = None

    # ── HTTP helpers ──────────────────────────────────────────────────────────

    def _get(self, path: str, **kw):
        return self.session.get(f"{self.api}{path}", **kw)

    def _post(self, path: str, **kw):
        return self.session.post(f"{self.api}{path}", **kw)

    def _patch(self, path: str, **kw):
        return self.session.patch(f"{self.api}{path}", **kw)

    def _delete(self, path: str, **kw):
        return self.session.delete(f"{self.api}{path}", **kw)

    # ── Result tracking ───────────────────────────────────────────────────────

    def _ok(self, label: str):
        self._results.append(("PASS", label))
        print(f"  ✅ {label}")

    def _ko(self, label: str, reason: str = ""):
        self._results.append(("FAIL", label))
        txt = f"  ❌ {label}"
        if reason:
            txt += f" — {reason}"
        print(txt)

    def _bug(self, severity: str, title: str, journey: str,
             steps: list[str], expected: str, actual: str, endpoint: str = "") -> None:
        self._bug_seq += 1
        b = _Bug(f"BUG-{self._bug_seq:03d}", severity, title,
                 journey, steps, expected, actual, endpoint)
        self._bugs.append(b)
        print(f"     🐛 {b.bug_id} [{severity}]: {title}")

    # ── Supabase auth ─────────────────────────────────────────────────────────

    def login(self) -> bool:
        if not TEST_EMAIL or not TEST_PASSWORD:
            print("⚠️  TEST_EMAIL / TEST_PASSWORD not set in .env — skipping auth.")
            print("   All requests will likely return 401. Add credentials to agents/sdlc/.env")
            return False

        r = requests.post(
            f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
            headers={"apikey": SUPABASE_ANON, "Content-Type": "application/json"},
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            timeout=15,
        )
        if r.status_code == 200:
            token = r.json().get("access_token", "")
            self.session.headers["Authorization"] = f"Bearer {token}"
            print(f"  ✅ Authenticated as {TEST_EMAIL}")
            return True
        else:
            print(f"  ❌ Login failed: {r.status_code} {r.text[:200]}")
            return False

    # ── Journey 0: sanity ─────────────────────────────────────────────────────

    def journey_health(self):
        print(f"\n[Journey 0] API health")
        try:
            r = self._get("/")
            if r.status_code < 500:
                self._ok("API reachable")
            else:
                self._ko("API reachable", f"{r.status_code}")
                self._bug("Blocker", "API returned 5xx on root", "J0",
                          ["GET /"], "200 OK", f"{r.status_code}")
        except requests.exceptions.ConnectionError as e:
            self._ko("API reachable", str(e)[:80])
            self._bug("Blocker", "Cannot connect to API", "J0",
                      [f"GET {self.api}/"], "HTTP response", str(e)[:80])

    # ── Journey 1: company settings ───────────────────────────────────────────

    def journey_company_settings(self):
        print(f"\n[Journey 1] Company Settings")
        r = self._get("/api/v1/settings/company")
        if r.status_code == 200:
            d = r.json()
            name = (d.get("name") or "").strip()
            if name and name.lower() != "none":
                self._ok(f"Company name set: {name}")
            else:
                self._ko("Company name", "empty or None")
                self._bug("High", "Company name missing from settings",
                          "J1", ["GET /api/v1/settings/company"],
                          "Populated company name", f"Got: '{name}'")

            # Structured address fields (migration 014)
            for field in ("address_line1", "city", "pincode"):
                val = d.get(field)
                if val and str(val).lower() != "none":
                    self._ok(f"company.{field} = {val}")
                else:
                    self._ko(f"company.{field}", "empty")
        else:
            self._ko("Company settings", f"{r.status_code}")
            self._bug("High", "Company settings endpoint error", "J1",
                      ["GET /api/v1/settings/company"],
                      "200 with company data", f"{r.status_code}")

    # ── Journey 2: product creation ───────────────────────────────────────────

    def journey_products(self):
        print(f"\n[Journey 2] Products")
        r = self._get("/api/v1/products/")
        if r.status_code == 200:
            products = r.json()
            if products:
                self._ok(f"{len(products)} products exist")
            else:
                self._ko("Products list", "empty — no test data in DB")
                self._bug("Med", "No products exist — cannot test sales flows",
                          "J2", ["GET /api/v1/products/"], ">0 products", "[]")
        else:
            self._ko("List products", f"{r.status_code}")

    # ── Journey 3: customer creation ──────────────────────────────────────────

    def journey_create_customer(self):
        print(f"\n[Journey 3] Create test customer")
        ts = int(time.time())
        r = self._post("/api/v1/companies/", json={
            "name":       f"BA-Test Customer {ts}",
            "type":       "customer",
            "gstin":      "27AAPFU0939F1ZV",
            "state_code": "27",
            "address":    "456 BA Test Lane",
            "city":       "Pune",
            "phone":      "9988776655",
            "email":      f"ba_test_{ts}@example.com",
        })
        if r.status_code in (200, 201):
            self.customer_id = r.json()["id"]
            self._ok(f"Customer created: {r.json()['name']}")
        else:
            self._ko("Create customer", f"{r.status_code}: {r.text[:200]}")
            self._bug("Blocker", "Cannot create customer/company",
                      "J3", ["POST /api/v1/companies/ with valid payload"],
                      "201 Created", f"{r.status_code}: {r.text[:200]}",
                      "/api/v1/companies/")

    # ── Journey 4: full quotation → SO → Invoice flow ─────────────────────────

    def journey_quotation_flow(self):
        print(f"\n[Journey 4] Quotation → SO → Invoice flow")
        if not self.customer_id:
            print("  ⏭  Skipping (no customer_id from J3)")
            return

        # 4a. Create quotation
        r = self._post("/api/v1/quotations/", json={
            "company_id":  self.customer_id,
            "date":        TODAY,
            "valid_until": NEXT_WEEK,
            "status":      "draft",
            "items": [{
                "description": "BA Test — Steel Casting",
                "hsn_code":    "72041000",
                "uom":         "kg",
                "qty":         10,
                "rate":        500,
                "gst_rate":    18,
                "sort_order":  0,
            }],
        })
        if r.status_code not in (200, 201):
            self._ko("Create quotation", f"{r.status_code}: {r.text[:300]}")
            self._bug("Blocker", "Cannot create quotation",
                      "J4", ["POST /api/v1/quotations/ with valid items payload"],
                      "201 Created with quot_no", f"{r.status_code}: {r.text[:200]}",
                      "/api/v1/quotations/")
            return

        quot = r.json()
        qid  = quot["id"]
        self.quotation_id = qid
        self._ok(f"Quotation created: {quot['quot_no']}")

        # 4b. Check totals (10 × 500 = 5000 taxable; 18% GST = 900; total = 5900)
        ta = float(quot.get("taxable_amt") or 0)
        gst = float(quot.get("total_gst") or 0)
        tot = float(quot.get("total") or 0)

        if abs(ta - 5000) < 1:
            self._ok("Quotation taxable_amt = 5000")
        else:
            self._ko("Quotation taxable_amt", f"Expected 5000, got {ta}")
            self._bug("High", "Quotation taxable amount wrong (10 × 500 should = 5000)",
                      "J4", ["Create quotation with qty=10, rate=500"],
                      "taxable_amt = 5000", f"Got {ta}")

        if abs(gst - 900) < 1:
            self._ok("Quotation total_gst = 900 (18%)")
        else:
            self._ko("Quotation total_gst", f"Expected 900, got {gst}")
            self._bug("High", "Quotation GST amount wrong (5000 × 18% should = 900)",
                      "J4", ["Create quotation: qty=10, rate=500, gst_rate=18"],
                      "total_gst = 900", f"Got {gst}")

        if abs(tot - 5900) < 1:
            self._ok("Quotation total = 5900")
        else:
            self._ko("Quotation total", f"Expected 5900, got {tot}")

        # 4c. Send (status-only PATCH — MUST NOT require items in body)
        r = self._patch(f"/api/v1/quotations/{qid}/status", params={"status": "sent"})
        if r.status_code == 200:
            self._ok("Quotation → sent (status PATCH worked without items)")
        else:
            self._ko("Quotation → sent", f"{r.status_code}: {r.text[:200]}")
            self._bug("Blocker",
                      "PATCH /quotations/{id}/status requires items — crashes on Send button",
                      "J4",
                      [f"PATCH /api/v1/quotations/{qid}/status?status=sent (no body)"],
                      "200 OK",
                      f"{r.status_code}: {r.text[:200]}",
                      f"/api/v1/quotations/{qid}/status")

        # 4d. Accept
        r = self._patch(f"/api/v1/quotations/{qid}/status", params={"status": "accepted"})
        if r.status_code == 200:
            self._ok("Quotation → accepted")
        else:
            self._ko("Quotation → accepted", f"{r.status_code}")

        # 4e. Convert to SO (first time)
        r = self._post(f"/api/v1/quotations/{qid}/convert-to-so")
        if r.status_code not in (200, 201):
            self._ko("Convert quotation to SO", f"{r.status_code}: {r.text[:200]}")
            self._bug("Blocker", "Cannot convert quotation to Sales Order",
                      "J4", [f"POST /api/v1/quotations/{qid}/convert-to-so"],
                      "201 with so_no", f"{r.status_code}: {r.text[:200]}",
                      f"/api/v1/quotations/{qid}/convert-to-so")
            return

        so1 = r.json()
        self.so_id = so1["id"]
        self._ok(f"Quotation converted → SO: {so1['so_no']}")

        # 4f. Convert AGAIN — must return SAME SO (idempotency), not create a duplicate
        r2 = self._post(f"/api/v1/quotations/{qid}/convert-to-so")
        if r2.status_code in (200, 201):
            so2 = r2.json()
            if so2["id"] == so1["id"]:
                self._ok("Duplicate-convert prevention: same SO returned")
            else:
                self._ko("Duplicate-convert prevention",
                         f"New SO {so2['so_no']} created (expected {so1['so_no']})")
                self._bug("High",
                          "Double-clicking 'To SO' creates duplicate Sales Orders",
                          "J4",
                          [f"POST /api/v1/quotations/{qid}/convert-to-so × 2"],
                          "Same SO returned on second call",
                          f"New SO {so2['so_no']} created",
                          f"/api/v1/quotations/{qid}/convert-to-so")
        elif r2.status_code == 400:
            self._ok("Duplicate-convert prevention: 400 on second call (quotation is converted)")
        else:
            self._ko("Duplicate-convert (2nd call)", f"{r2.status_code}")

        # 4g. Quotation status must now be 'converted'
        r = self._get(f"/api/v1/quotations/{qid}")
        if r.status_code == 200:
            st = r.json().get("status")
            if st == "converted":
                self._ok("Quotation status = 'converted' after SO creation")
            else:
                self._ko("Quotation post-conversion status", f"Got: {st}")
                self._bug("Med", "Quotation status not updated to 'converted' after SO",
                          "J4",
                          ["Convert quotation to SO, then GET quotation"],
                          "status = 'converted'", f"status = '{st}'")

        # 4h. Confirm SO (status-only PATCH — MUST NOT require items)
        r = self._patch(f"/api/v1/orders/{self.so_id}/status",
                        params={"status": "confirmed"})
        if r.status_code == 200:
            self._ok("SO → confirmed (status PATCH without items)")
        else:
            self._ko("SO → confirmed", f"{r.status_code}: {r.text[:200]}")
            self._bug("Blocker",
                      "PATCH /orders/{id}/status requires items — crashes on Confirm button",
                      "J4",
                      [f"PATCH /api/v1/orders/{self.so_id}/status?status=confirmed"],
                      "200 OK",
                      f"{r.status_code}: {r.text[:200]}",
                      f"/api/v1/orders/{self.so_id}/status")

        # 4i. Create invoice — with empty due_date (must not fail validation)
        r = self._get(f"/api/v1/orders/{self.so_id}/invoice-prefill")
        if r.status_code != 200:
            self._ko("SO invoice prefill", f"{r.status_code}")
            return
        prefill = r.json()

        r = self._post("/api/v1/invoices/", json={
            "so_id":            self.so_id,
            "company_id":       self.customer_id,
            "date":             TODAY,
            "due_date":         "",         # empty string — field_validator must convert to None
            "place_of_supply":  prefill.get("place_of_supply", "27"),
            "status":           "draft",
            "items":            prefill["items"],
        })
        if r.status_code in (200, 201):
            inv = r.json()
            self.invoice_id = inv["id"]
            self._ok(f"Invoice created: {inv['inv_no']} (empty due_date accepted)")

            # Verify GST was calculated
            cgst = float(inv.get("cgst") or 0)
            igst = float(inv.get("igst") or 0)
            if cgst > 0 or igst > 0:
                self._ok(f"Invoice GST: CGST={cgst} IGST={igst}")
            else:
                self._ko("Invoice GST", "Both CGST and IGST are 0")
                self._bug("High", "Invoice created but CGST/IGST both zero",
                          "J4",
                          ["POST /api/v1/invoices/ from SO prefill"],
                          "CGST or IGST > 0",
                          f"cgst={cgst}, igst={igst}")
        else:
            err = r.text[:300]
            self._ko("Create invoice", f"{r.status_code}: {err}")
            if "due_date" in err.lower() or "valid date" in err.lower():
                self._bug("Blocker",
                          "Invoice creation fails: empty due_date string not converted to None",
                          "J4",
                          ["POST /api/v1/invoices/ with due_date=''"],
                          "201 Created (due_date treated as null)",
                          f"{r.status_code}: {err}",
                          "/api/v1/invoices/")
            else:
                self._bug("Blocker", "Invoice creation failed unexpectedly",
                          "J4",
                          ["POST /api/v1/invoices/ from SO prefill"],
                          "201 Created", f"{r.status_code}: {err}", "/api/v1/invoices/")

    # ── Journey 5: PDF generation ─────────────────────────────────────────────

    def journey_pdfs(self):
        print(f"\n[Journey 5] PDF generation")

        def _test_pdf(label: str, path: str):
            try:
                r = self._get(path)
            except Exception as e:
                self._ko(f"{label} PDF", str(e)[:80])
                return
            if r.status_code != 200:
                self._ko(f"{label} PDF", f"{r.status_code}: {r.text[:150]}")
                self._bug("High", f"{label} PDF endpoint returns error", "J5",
                          [f"GET {path}"], "200 application/pdf", f"{r.status_code}")
                return
            ct = r.headers.get("content-type", "")
            if "pdf" not in ct:
                self._ko(f"{label} PDF content-type", f"Got: {ct}")
                self._bug("High", f"{label} PDF wrong content-type", "J5",
                          [f"GET {path}"], "application/pdf", ct)
                return
            size = len(r.content)
            if size < 2_000:
                self._ko(f"{label} PDF size", f"Only {size} bytes — likely empty")
                self._bug("High", f"{label} PDF too small — likely crashed during generation",
                          "J5", [f"GET {path}"], "Valid PDF > 2KB", f"{size} bytes")
            else:
                self._ok(f"{label} PDF: {size:,} bytes")

        # Use IDs from earlier journeys when available, else fall back to first in list
        def _first_id(endpoint: str) -> str | None:
            try:
                r = self._get(endpoint)
                data = r.json()
                return data[0]["id"] if data else None
            except Exception:
                return None

        qid  = self.quotation_id or _first_id("/api/v1/quotations/")
        sid  = self.so_id        or _first_id("/api/v1/orders/")
        iid  = self.invoice_id   or _first_id("/api/v1/invoices/")

        if qid:
            _test_pdf("Quotation", f"/api/v1/quotations/{qid}/pdf")
        else:
            self._ko("Quotation PDF", "no quotations in DB")

        if sid:
            _test_pdf("Sales Order", f"/api/v1/orders/{sid}/pdf")
        else:
            self._ko("Sales Order PDF", "no sales orders in DB")

        if iid:
            _test_pdf("Invoice",       f"/api/v1/invoices/{iid}/pdf")
        else:
            self._ko("Invoice PDF", "no invoices in DB")

    # ── Journey 6: advance receipts ───────────────────────────────────────────

    def journey_advance_receipts(self):
        print(f"\n[Journey 6] Advance receipts (PDC flow)")
        if not self.customer_id:
            print("  ⏭  Skipping (no customer_id)")
            return

        r = self._post("/api/v1/advance-receipts/", json={
            "company_id": self.customer_id,
            "date":       TODAY,
            "amount":     10000,
            "mode":       "cheque",
            "reference":  f"CHQ-BA-{int(time.time())}",
            "notes":      "BA tester PDC advance",
        })
        if r.status_code not in (200, 201):
            self._ko("Create PDC advance", f"{r.status_code}: {r.text[:200]}")
            self._bug("High", "Cannot create advance receipt (PDC cheque)",
                      "J6", ["POST /api/v1/advance-receipts/ with mode=cheque"],
                      "201 Created", f"{r.status_code}: {r.text[:200]}")
            return

        ar     = r.json()
        ar_id  = ar["id"]
        status = ar.get("status", "")

        if status == "pending":
            self._ok("PDC advance created with status=pending ✓")
        elif status == "received":
            self._ko("PDC advance status", "Got 'received' — should be 'pending' for cheque")
            self._bug("High",
                      "PDC (cheque) advance starts as 'received' instead of 'pending'",
                      "J6",
                      ["POST /api/v1/advance-receipts/ with mode=cheque"],
                      "status = 'pending'", "status = 'received'",
                      "/api/v1/advance-receipts/")
        else:
            self._ko("PDC advance status", f"Unexpected status: {status}")

        # Mark as received
        r2 = self._patch(f"/api/v1/advance-receipts/{ar_id}/receive")
        if r2.status_code == 200:
            self._ok("Advance receipt marked as received (PATCH /receive)")
        else:
            self._ko("Receive advance", f"{r2.status_code}: {r2.text[:200]}")
            self._bug("High", "Cannot mark advance receipt as received",
                      "J6", [f"PATCH /api/v1/advance-receipts/{ar_id}/receive"],
                      "200 OK", f"{r2.status_code}",
                      f"/api/v1/advance-receipts/{ar_id}/receive")

    # ── Journey 7: role access control ───────────────────────────────────────

    def journey_auth_guard(self):
        print(f"\n[Journey 7] Auth guard — unauthenticated request should 401")
        # Temporarily remove auth header
        original = self.session.headers.pop("Authorization", None)
        r = self._get("/api/v1/products/")
        if r.status_code == 401:
            self._ok("Unauthenticated request returns 401")
        else:
            self._ko("Auth guard", f"Expected 401, got {r.status_code}")
            self._bug("High", "Endpoints accessible without auth token",
                      "J7", ["GET /api/v1/products/ without Authorization header"],
                      "401 Unauthorized", f"{r.status_code}")
        if original:
            self.session.headers["Authorization"] = original

    # ── Report generation ─────────────────────────────────────────────────────

    def _render_report(self) -> str:
        passed  = sum(1 for s, _ in self._results if s == "PASS")
        failed  = sum(1 for s, _ in self._results if s == "FAIL")
        total   = len(self._results)
        verdict = "✅ PASS" if not self._bugs else f"❌ FAIL — {len(self._bugs)} defect(s) found"

        lines = [
            "# BA Flow Test Report",
            "",
            f"**Date:** {TODAY}  ",
            f"**API:** {self.api}  ",
            "",
            "## Summary",
            "",
            "| Metric | Count |",
            "|--------|-------|",
            f"| Checks run | {total} |",
            f"| ✅ Passed  | {passed} |",
            f"| ❌ Failed  | {failed} |",
            f"| 🐛 Bugs    | {len(self._bugs)} |",
            "",
            f"## VERDICT: {verdict}",
            "",
        ]

        if self._bugs:
            sev_order = {"Blocker": 0, "High": 1, "Med": 2, "Low": 3}
            bugs = sorted(self._bugs, key=lambda b: sev_order.get(b.severity, 9))
            lines += [
                "## Defect Summary",
                "",
                "| ID | Sev | Journey | Title | Endpoint |",
                "|----|-----|---------|-------|----------|",
            ]
            for b in bugs:
                lines.append(f"| {b.bug_id} | {b.severity} | {b.journey} "
                             f"| {b.title} | `{b.endpoint}` |")

            lines += ["", "## Defect Details", ""]
            for b in bugs:
                lines += [
                    f"### {b.bug_id} · {b.severity} · {b.title}",
                    "",
                    f"**Journey:** {b.journey}  ",
                    "**Steps:**",
                ]
                for step in b.steps:
                    lines.append(f"1. {step}")
                lines += [
                    f"",
                    f"**Expected:** {b.expected}  ",
                    f"**Actual:** {b.actual}  ",
                    "",
                ]

        lines += [
            "## Detailed Results",
            "",
            "| # | Status | Check |",
            "|---|--------|-------|",
        ]
        for i, (status, label) in enumerate(self._results, 1):
            icon = "✅" if status == "PASS" else "❌"
            lines.append(f"| {i} | {icon} {status} | {label} |")

        return "\n".join(lines)

    # ── Main entry point ──────────────────────────────────────────────────────

    def run(self) -> bool:
        print(f"\n{_SEP}")
        print(f"BA Flow Tester")
        print(f"API: {self.api}")
        print(f"Date: {TODAY}")
        print(_SEP)

        self.login()
        self.journey_health()
        self.journey_company_settings()
        self.journey_products()
        self.journey_create_customer()
        self.journey_quotation_flow()
        self.journey_pdfs()
        self.journey_advance_receipts()
        self.journey_auth_guard()

        report = self._render_report()

        # Save to docs/sdlc/ba/
        out_dir = Path(__file__).parent.parent.parent / "docs" / "sdlc" / "ba"
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"FLOW_TEST_{TODAY}.md"
        out_path.write_text(report, encoding="utf-8")

        print(f"\n{_SEP}")
        passed = sum(1 for s, _ in self._results if s == "PASS")
        total  = len(self._results)
        print(f"Results: {passed}/{total} checks passed, {len(self._bugs)} bug(s) found")
        print(f"Report: {out_path}")
        if self._bugs:
            print("\nDefects found:")
            for b in self._bugs:
                print(f"  {b.bug_id} [{b.severity}] {b.title}")
        print(_SEP)

        return len(self._bugs) == 0


def main(argv: list[str]) -> int:
    api_base = argv[0] if argv else None
    tester   = BAFlowTester(api_base)
    success  = tester.run()
    return 0 if success else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
