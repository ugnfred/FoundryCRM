# Foundry ERP — Test Suite

Two testing layers covering all 16 app modules.

## Quick start

### 1. Set credentials (both layers share the same .env)

```bash
# Already exists at agents/sdlc/.env
# Make sure these are filled in:
TEST_EMAIL=admin@foundryerp.test
TEST_PASSWORD=your_password
SUPABASE_ANON_KEY=sb_publishable_4-xDBqgwIgjtAHcLQH3T5Q_UCREt6ZI
API_BASE_URL=https://foundrycrm-production.up.railway.app
PLAYWRIGHT_BASE_URL=https://foundry-crm.vercel.app
```

---

## Layer 1 — API Tests (pytest)

Tests the backend directly via HTTP. Fast, no browser needed.
Catches: validation errors, wrong calculations, broken endpoints, auth guards.

```bash
cd tests/api
pip install -r requirements.txt
pytest -v                          # run all 204 tests
pytest -v -k "quotations"         # run one module
pytest -v -m "smoke"              # run smoke tests only
```

**Modules covered:**

| File | Tests | What it checks |
|------|-------|----------------|
| test_settings.py | 13 | Company settings (no "None"), product/company CRUD |
| test_quotations.py | 17 | Totals, status PATCH (no items needed), convert→SO idempotency, PDF |
| test_sales_orders.py | 16 | Status PATCH, delete draft, invoice prefill, PDF |
| test_invoices.py | 15 | GST calc (intra/inter-state), empty due_date, payment, PDF |
| test_purchase_orders.py | 9 | CRUD, totals |
| test_grns.py | 10 | Create, stock increase, PDF |
| test_credit_notes.py | 15 | Create, total validation, lifecycle |
| test_proforma.py | 17 | Totals, GST split, PDF |
| test_delivery_challans.py | 15 | Create, dispatch, PDF |
| test_advance_receipts.py | 15 | PDC→pending, receive, cancel |
| test_inventory.py | 11 | Stock levels, adjustments |
| test_reports.py | 20 | GSTR-1/3B, aging, Excel exports |
| test_bom.py | 13 | Create, versioning, materials |
| test_work_orders.py | 18 | Create, status transitions |

---

## Layer 2 — E2E Tests (Playwright)

Tests the actual browser UI. Catches: React state bugs, toast issues,
form pre-filling problems, PDF downloads, visual regressions.

```bash
cd tests/e2e
npm install
npx playwright install chromium   # first time only
npx playwright test               # run all specs headlessly
npx playwright test --headed      # watch the browser
npx playwright test --ui          # interactive Playwright UI
npx playwright test 03-quotations # run one spec
npx playwright show-report        # open HTML report after run
```

**Specs:**

| Spec | Coverage |
|------|----------|
| 01-auth | Login, wrong password, sidebar, logout |
| 02-settings | Products CRUD, company address fields, no "None" regression |
| 03-quotations | Create, Send (no error), Accept, Convert→SO, duplicate prevention, ✓ Converted, PDF |
| 04-sales-orders | Create, Edit (customer pre-fills), Confirm (no error), Dispatch, Delete, PDF |
| 05-invoices | Create (empty due date OK), full/partial payment, GST display, PDF |
| 06–10, 12–13, 15–16 | Page loads + basic CRUD (stubs with TODOs) |
| 11-advance-receipts | PDC→pending, Receive, bank→received, Cancel |
| 14-reports | All 4 report tabs load, GSTR-1 generate, Excel buttons |

---

## Run both in one go

```bash
# From repo root
cd tests/api && pytest -v && cd ../e2e && npx playwright test
```

## BA Flow Tester (bonus — all in one script)

```bash
cd agents && python -m sdlc ba-test
# Saves report to docs/sdlc/ba/FLOW_TEST_<date>.md
```
