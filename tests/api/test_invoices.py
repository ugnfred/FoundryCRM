"""
Tests for /api/v1/invoices/* endpoints.

Key scenarios:
- Create with due_date="" → 201 (not 422)
- CGST/SGST for intra-state (place_of_supply = seller state code, e.g. "27")
- IGST for inter-state (place_of_supply ≠ seller state)
- GST amounts: 5000 taxable × 18% = 900 total GST
- Full payment: balance_due → 0, status → paid
- Partial payment: balance_due = total - paid
- Over-payment rejected (400)
- PDF returns application/pdf > 2 KB

NOTE: The seller's state_code is read from company_settings. Tests assume it is
"27" (Maharashtra). Adjust intrastate_customer_id fixture if your seller state
differs.
"""

import pytest
from conftest import make_line_item

SELLER_STATE = "27"  # Maharashtra — must match company_settings.state_code


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_invoice(session, api, customer_id, place_of_supply, today, **overrides):
    payload = {
        "company_id": customer_id,
        "date": today,
        "place_of_supply": place_of_supply,
        "status": "draft",
        "items": [make_line_item(qty=10, rate=500, gst_rate=18)],
    }
    payload.update(overrides)
    resp = session.post(f"{api}/api/v1/invoices/", json=payload)
    assert resp.status_code == 201, f"Create invoice failed ({resp.status_code}): {resp.text}"
    return resp.json()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestInvoiceCreate:
    def test_create_invoice_201(self, session, api, customer_id, today):
        inv = _create_invoice(session, api, customer_id, "07", today)
        assert "id" in inv
        assert "inv_no" in inv

    def test_due_date_empty_string_accepted(self, session, api, customer_id, today):
        """due_date='' must be accepted (coerced to None), not raise 422."""
        payload = {
            "company_id": customer_id,
            "date": today,
            "due_date": "",
            "place_of_supply": "07",
            "items": [make_line_item()],
        }
        resp = session.post(f"{api}/api/v1/invoices/", json=payload)
        assert resp.status_code == 201, (
            f"Expected 201 but got {resp.status_code}: {resp.text}"
        )
        assert resp.json().get("due_date") is None

    def test_so_id_empty_string_accepted(self, session, api, customer_id, today):
        """so_id='' must be accepted (coerced to None)."""
        payload = {
            "company_id": customer_id,
            "date": today,
            "so_id": "",
            "place_of_supply": "07",
            "items": [make_line_item()],
        }
        resp = session.post(f"{api}/api/v1/invoices/", json=payload)
        assert resp.status_code == 201, (
            f"Expected 201 but got {resp.status_code}: {resp.text}"
        )


class TestGSTCalculation:
    def test_igst_for_inter_state(self, session, api, customer_id, today):
        """
        Inter-state supply (place_of_supply ≠ seller state 27).
        IGST = full GST; CGST = SGST = 0.
        10 × 500 × 18% = 900 IGST.
        """
        inv = _create_invoice(session, api, customer_id, "07", today,
                               items=[make_line_item(qty=10, rate=500, gst_rate=18)])
        assert float(inv["taxable_amt"]) == pytest.approx(5000.0)
        assert float(inv["igst"]) == pytest.approx(900.0)
        assert float(inv["cgst"]) == pytest.approx(0.0)
        assert float(inv["sgst"]) == pytest.approx(0.0)
        assert float(inv["total"]) == pytest.approx(5900.0)

    def test_cgst_sgst_for_intra_state(self, session, api, intrastate_customer_id, today):
        """
        Intra-state supply (place_of_supply = seller state 27).
        CGST = SGST = 450 each; IGST = 0.
        """
        inv = _create_invoice(session, api, intrastate_customer_id, SELLER_STATE, today,
                               items=[make_line_item(qty=10, rate=500, gst_rate=18)])
        assert float(inv["taxable_amt"]) == pytest.approx(5000.0)
        assert float(inv["cgst"]) == pytest.approx(450.0)
        assert float(inv["sgst"]) == pytest.approx(450.0)
        assert float(inv["igst"]) == pytest.approx(0.0)
        assert float(inv["total"]) == pytest.approx(5900.0)

    @pytest.mark.parametrize("gst_rate,expected_gst", [
        (5, 250.0),
        (12, 600.0),
        (18, 900.0),
        (28, 1400.0),
    ])
    def test_inter_state_gst_rates(self, session, api, customer_id, today,
                                    gst_rate, expected_gst):
        """Verify different GST rates produce correct IGST for 5000 taxable."""
        qty, rate = 10, 500
        inv = _create_invoice(
            session, api, customer_id, "07", today,
            items=[make_line_item(qty=qty, rate=rate, gst_rate=gst_rate)],
        )
        assert float(inv["taxable_amt"]) == pytest.approx(5000.0)
        assert float(inv["igst"]) == pytest.approx(expected_gst, rel=1e-3)


class TestInvoicePayment:
    @pytest.fixture(scope="class")
    def invoice(self, session, api, customer_id, today):
        return _create_invoice(session, api, customer_id, "07", today,
                                items=[make_line_item(qty=10, rate=500, gst_rate=18)])

    def test_full_payment_clears_balance(self, session, api, customer_id, today):
        inv = _create_invoice(session, api, customer_id, "07", today,
                               items=[make_line_item(qty=10, rate=500, gst_rate=18)])
        total = float(inv["total"])  # 5900

        resp = session.post(
            f"{api}/api/v1/invoices/{inv['id']}/payments",
            json={
                "amount": total,
                "date": today,
                "mode": "bank_transfer",
            },
        )
        assert resp.status_code == 201, f"Payment failed: {resp.text}"
        data = resp.json()
        assert float(data["amount_paid"]) == pytest.approx(total)
        assert data["status"] == "paid"

    def test_partial_payment_reduces_balance(self, session, api, customer_id, today):
        inv = _create_invoice(session, api, customer_id, "07", today,
                               items=[make_line_item(qty=10, rate=500, gst_rate=18)])
        total = float(inv["total"])  # 5900
        partial = 2000.0

        resp = session.post(
            f"{api}/api/v1/invoices/{inv['id']}/payments",
            json={"amount": partial, "date": today, "mode": "cash"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "partially_paid"
        # Fetch detail to verify balance_due
        detail = session.get(f"{api}/api/v1/invoices/{inv['id']}")
        assert detail.status_code == 200
        assert float(detail.json()["balance_due"]) == pytest.approx(total - partial)

    def test_over_payment_rejected(self, session, api, customer_id, today):
        inv = _create_invoice(session, api, customer_id, "07", today,
                               items=[make_line_item(qty=10, rate=500, gst_rate=18)])
        total = float(inv["total"])

        resp = session.post(
            f"{api}/api/v1/invoices/{inv['id']}/payments",
            json={"amount": total + 1, "date": today, "mode": "bank_transfer"},
        )
        assert resp.status_code == 400, (
            f"Over-payment should be rejected (400), got {resp.status_code}: {resp.text}"
        )

    def test_multiple_partial_payments_sum_to_paid(self, session, api, customer_id, today):
        inv = _create_invoice(session, api, customer_id, "07", today,
                               items=[make_line_item(qty=10, rate=500, gst_rate=18)])
        total = float(inv["total"])

        # First partial
        session.post(f"{api}/api/v1/invoices/{inv['id']}/payments",
                     json={"amount": 3000, "date": today, "mode": "bank_transfer"})
        # Second partial covering the rest
        session.post(f"{api}/api/v1/invoices/{inv['id']}/payments",
                     json={"amount": total - 3000, "date": today, "mode": "bank_transfer"})

        detail = session.get(f"{api}/api/v1/invoices/{inv['id']}")
        assert detail.json()["status"] == "paid"
        assert float(detail.json()["balance_due"]) == pytest.approx(0.0, abs=0.01)


class TestInvoiceFromSO:
    def test_create_invoice_from_so_prefill(self, session, api, customer_id, today):
        """Create SO, get prefill, create invoice from those items."""
        so_resp = session.post(
            f"{api}/api/v1/orders/",
            json={
                "company_id": customer_id,
                "date": today,
                "items": [make_line_item(qty=5, rate=200, gst_rate=12)],
            },
        )
        assert so_resp.status_code == 201
        so = so_resp.json()

        prefill = session.get(f"{api}/api/v1/orders/{so['id']}/invoice-prefill").json()
        inv_payload = {
            "company_id": prefill["company_id"],
            "so_id": prefill["so_id"],
            "date": today,
            "place_of_supply": prefill["place_of_supply"],
            "items": prefill["items"],
        }
        inv_resp = session.post(f"{api}/api/v1/invoices/", json=inv_payload)
        assert inv_resp.status_code == 201
        inv = inv_resp.json()
        # 5 × 200 = 1000 taxable; 12% = 120 GST
        assert float(inv["taxable_amt"]) == pytest.approx(1000.0)
        assert float(inv["total"]) == pytest.approx(1120.0)


class TestInvoicePDF:
    def test_pdf_returns_200(self, session, api, customer_id, today):
        inv = _create_invoice(session, api, customer_id, "07", today)
        resp = session.get(f"{api}/api/v1/invoices/{inv['id']}/pdf")
        assert resp.status_code == 200
        assert "application/pdf" in resp.headers.get("content-type", "")

    def test_pdf_larger_than_2kb(self, session, api, customer_id, today):
        inv = _create_invoice(session, api, customer_id, "07", today)
        resp = session.get(f"{api}/api/v1/invoices/{inv['id']}/pdf")
        assert len(resp.content) > 2048


class TestInvoiceList:
    def test_list_invoices_returns_list(self, session, api):
        resp = session.get(f"{api}/api/v1/invoices/")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_get_invoice_detail(self, session, api, customer_id, today):
        inv = _create_invoice(session, api, customer_id, "07", today)
        resp = session.get(f"{api}/api/v1/invoices/{inv['id']}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == inv["id"]
        assert "invoice_items" in data
