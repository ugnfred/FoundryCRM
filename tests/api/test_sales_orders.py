"""
Tests for /api/v1/orders/* endpoints.

Key scenarios:
- Create SO directly with correct totals
- Status PATCH must not require 'items' in body
- DELETE draft SO → 204; DELETE confirmed SO → 400
- delivery_date="" accepted (converts to None)
- GET /{id}/invoice-prefill returns items array
- PDF returns application/pdf > 2 KB
"""

import pytest
from conftest import make_line_item


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_so(session, api, customer_id, today, **overrides):
    payload = {
        "company_id": customer_id,
        "date": today,
        "status": "draft",
        "items": [make_line_item(qty=10, rate=500, gst_rate=18)],
    }
    payload.update(overrides)
    resp = session.post(f"{api}/api/v1/orders/", json=payload)
    assert resp.status_code == 201, f"Create SO failed: {resp.text}"
    return resp.json()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestSOCreate:
    def test_create_so_returns_201(self, session, api, customer_id, today):
        so = _create_so(session, api, customer_id, today)
        assert "id" in so
        assert "so_no" in so

    def test_totals_correct(self, session, api, customer_id, today):
        """10 × 500 × 18% → taxable=5000, gst=900, total=5900."""
        so = _create_so(session, api, customer_id, today,
                        items=[make_line_item(qty=10, rate=500, gst_rate=18)])
        assert float(so["taxable_amt"]) == pytest.approx(5000.0)
        assert float(so["total_gst"]) == pytest.approx(900.0)
        assert float(so["total"]) == pytest.approx(5900.0)

    def test_delivery_date_empty_string_accepted(self, session, api, customer_id, today):
        """delivery_date='' must not raise a 422 validation error."""
        payload = {
            "company_id": customer_id,
            "date": today,
            "delivery_date": "",
            "items": [make_line_item()],
        }
        resp = session.post(f"{api}/api/v1/orders/", json=payload)
        assert resp.status_code == 201, (
            f"Expected 201 but got {resp.status_code}: {resp.text}"
        )

    def test_so_items_stored(self, session, api, customer_id, today):
        so = _create_so(session, api, customer_id, today)
        assert isinstance(so.get("so_items"), list)
        assert len(so["so_items"]) == 1


class TestSOStatus:
    def test_status_confirmed_no_items_required(self, session, api, customer_id, today):
        """PATCH /status must only need 'status' query param, not items in body."""
        so = _create_so(session, api, customer_id, today)
        resp = session.patch(
            f"{api}/api/v1/orders/{so['id']}/status",
            params={"status": "confirmed"},
        )
        assert resp.status_code == 200, (
            f"Status PATCH failed ({resp.status_code}): {resp.text}\n"
            "The endpoint must not require 'items' in the request body."
        )
        assert resp.json()["status"] == "confirmed"

    def test_status_dispatched(self, session, api, customer_id, today):
        so = _create_so(session, api, customer_id, today)
        session.patch(f"{api}/api/v1/orders/{so['id']}/status",
                      params={"status": "confirmed"})
        resp = session.patch(
            f"{api}/api/v1/orders/{so['id']}/status",
            params={"status": "dispatched"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "dispatched"

    def test_invalid_status_returns_400(self, session, api, customer_id, today):
        so = _create_so(session, api, customer_id, today)
        resp = session.patch(
            f"{api}/api/v1/orders/{so['id']}/status",
            params={"status": "shipped"},
        )
        assert resp.status_code == 400


class TestSODelete:
    def test_delete_draft_returns_204(self, session, api, customer_id, today):
        so = _create_so(session, api, customer_id, today)
        assert so["status"] == "draft"
        resp = session.delete(f"{api}/api/v1/orders/{so['id']}")
        assert resp.status_code == 204

    def test_delete_confirmed_returns_400(self, session, api, customer_id, today):
        so = _create_so(session, api, customer_id, today)
        # Confirm the SO
        session.patch(f"{api}/api/v1/orders/{so['id']}/status",
                      params={"status": "confirmed"})
        # Attempt delete — must be rejected
        resp = session.delete(f"{api}/api/v1/orders/{so['id']}")
        assert resp.status_code == 400, (
            f"Expected 400 when deleting a confirmed SO, got {resp.status_code}"
        )

    def test_delete_nonexistent_returns_404(self, session, api):
        fake_id = "00000000-0000-0000-0000-000000000000"
        resp = session.delete(f"{api}/api/v1/orders/{fake_id}")
        assert resp.status_code == 404


class TestSOInvoicePrefill:
    def test_invoice_prefill_returns_items(self, session, api, customer_id, today):
        so = _create_so(session, api, customer_id, today)
        resp = session.get(f"{api}/api/v1/orders/{so['id']}/invoice-prefill")
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert isinstance(data["items"], list)
        assert len(data["items"]) >= 1

    def test_invoice_prefill_has_required_fields(self, session, api, customer_id, today):
        so = _create_so(session, api, customer_id, today)
        resp = session.get(f"{api}/api/v1/orders/{so['id']}/invoice-prefill")
        data = resp.json()
        assert "so_id" in data
        assert "company_id" in data
        assert "place_of_supply" in data
        # Each item must have qty and rate
        for item in data["items"]:
            assert "qty" in item
            assert "rate" in item


class TestSOPDF:
    def test_pdf_returns_200(self, session, api, customer_id, today):
        so = _create_so(session, api, customer_id, today)
        resp = session.get(f"{api}/api/v1/orders/{so['id']}/pdf")
        assert resp.status_code == 200
        assert "application/pdf" in resp.headers.get("content-type", "")

    def test_pdf_larger_than_2kb(self, session, api, customer_id, today):
        so = _create_so(session, api, customer_id, today)
        resp = session.get(f"{api}/api/v1/orders/{so['id']}/pdf")
        assert len(resp.content) > 2048, (
            f"SO PDF is only {len(resp.content)} bytes — expected > 2 KB"
        )


class TestSOGet:
    def test_get_so_detail(self, session, api, customer_id, today):
        so = _create_so(session, api, customer_id, today)
        resp = session.get(f"{api}/api/v1/orders/{so['id']}")
        assert resp.status_code == 200
        assert resp.json()["id"] == so["id"]

    def test_list_orders_returns_list(self, session, api):
        resp = session.get(f"{api}/api/v1/orders/")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
