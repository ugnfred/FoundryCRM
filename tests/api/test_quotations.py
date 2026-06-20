"""
Tests for /api/v1/quotations/* endpoints.

Key scenarios:
- Create: totals (taxable, GST, grand total) must be calculated correctly
- Status PATCH: must not require 'items' in body
- Convert to SO: returns so_no; second call is rejected or idempotent
- valid_until="" handled as None (no 422)
- PDF endpoint returns application/pdf > 2 KB
- Invalid status returns 400
"""

import pytest
from conftest import make_line_item


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_quotation(session, api, customer_id, today, **overrides):
    """POST a minimal quotation and return the parsed response JSON."""
    payload = {
        "company_id": customer_id,
        "date": today,
        "status": "draft",
        "items": [make_line_item(qty=10, rate=500, gst_rate=18)],
    }
    payload.update(overrides)
    resp = session.post(f"{api}/api/v1/quotations/", json=payload)
    assert resp.status_code == 201, f"Create quotation failed: {resp.text}"
    return resp.json()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestQuotationCreate:
    def test_create_quotation_201(self, session, api, customer_id, today):
        quot = _create_quotation(session, api, customer_id, today)
        assert "id" in quot
        assert "quot_no" in quot

    def test_totals_10_qty_500_rate_18pct(self, session, api, customer_id, today):
        """10 × 500 × 18% GST → taxable=5000, gst=900, total=5900."""
        quot = _create_quotation(session, api, customer_id, today,
                                 items=[make_line_item(qty=10, rate=500, gst_rate=18)])
        assert float(quot["taxable_amt"]) == pytest.approx(5000.0)
        assert float(quot["total_gst"]) == pytest.approx(900.0)
        assert float(quot["total"]) == pytest.approx(5900.0)

    @pytest.mark.parametrize("qty,rate,gst_rate,expected_taxable,expected_gst", [
        (5, 200, 5, 1000, 50),
        (2, 1000, 12, 2000, 240),
        (100, 50, 28, 5000, 1400),
    ])
    def test_totals_parametrized(self, session, api, customer_id, today,
                                  qty, rate, gst_rate, expected_taxable, expected_gst):
        quot = _create_quotation(
            session, api, customer_id, today,
            items=[make_line_item(qty=qty, rate=rate, gst_rate=gst_rate)],
        )
        assert float(quot["taxable_amt"]) == pytest.approx(expected_taxable)
        assert float(quot["total_gst"]) == pytest.approx(expected_gst)
        assert float(quot["total"]) == pytest.approx(expected_taxable + expected_gst)

    def test_valid_until_empty_string_accepted(self, session, api, customer_id, today):
        """valid_until='' must be accepted (converted to None), not raise 422."""
        payload = {
            "company_id": customer_id,
            "date": today,
            "valid_until": "",
            "items": [make_line_item()],
        }
        resp = session.post(f"{api}/api/v1/quotations/", json=payload)
        assert resp.status_code == 201, f"Expected 201 but got {resp.status_code}: {resp.text}"
        assert resp.json().get("valid_until") is None

    def test_create_stores_items(self, session, api, customer_id, today):
        quot = _create_quotation(session, api, customer_id, today)
        assert isinstance(quot.get("quotation_items"), list)
        assert len(quot["quotation_items"]) == 1


class TestQuotationStatus:
    def test_status_patch_sent_no_items_required(self, session, api, customer_id, today):
        """PATCH /status must not require 'items' in body — only 'status' query param."""
        quot = _create_quotation(session, api, customer_id, today)
        resp = session.patch(
            f"{api}/api/v1/quotations/{quot['id']}/status",
            params={"status": "sent"},
        )
        assert resp.status_code == 200, (
            f"Status PATCH failed: {resp.status_code} — {resp.text}\n"
            "This likely means the endpoint incorrectly requires 'items' in the body."
        )
        assert resp.json()["status"] == "sent"

    def test_status_patch_accepted(self, session, api, customer_id, today):
        quot = _create_quotation(session, api, customer_id, today)
        resp = session.patch(
            f"{api}/api/v1/quotations/{quot['id']}/status",
            params={"status": "accepted"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "accepted"

    def test_invalid_status_returns_400(self, session, api, customer_id, today):
        quot = _create_quotation(session, api, customer_id, today)
        resp = session.patch(
            f"{api}/api/v1/quotations/{quot['id']}/status",
            params={"status": "shipped"},   # not a valid status
        )
        assert resp.status_code == 400


class TestQuotationConvertToSO:
    @pytest.fixture(scope="class")
    def accepted_quotation(self, session, api, customer_id, today):
        """Create and accept a quotation, return its data."""
        quot = _create_quotation(session, api, customer_id, today)
        session.patch(
            f"{api}/api/v1/quotations/{quot['id']}/status",
            params={"status": "accepted"},
        )
        return quot

    def test_convert_returns_so_no(self, session, api, accepted_quotation):
        resp = session.post(
            f"{api}/api/v1/quotations/{accepted_quotation['id']}/convert-to-so"
        )
        assert resp.status_code in (200, 201), f"Convert failed: {resp.text}"
        data = resp.json()
        assert "so_no" in data
        assert data["so_no"]  # must not be empty

    def test_convert_second_time_rejected(self, session, api, customer_id, today):
        """Convert the same quotation twice — server must reject the second call."""
        quot = _create_quotation(session, api, customer_id, today)
        # Accept it
        session.patch(
            f"{api}/api/v1/quotations/{quot['id']}/status",
            params={"status": "accepted"},
        )
        # First convert
        resp1 = session.post(
            f"{api}/api/v1/quotations/{quot['id']}/convert-to-so"
        )
        assert resp1.status_code in (200, 201)

        # Second convert — must be rejected (400 or 409)
        resp2 = session.post(
            f"{api}/api/v1/quotations/{quot['id']}/convert-to-so"
        )
        assert resp2.status_code in (400, 409), (
            f"Expected rejection on 2nd convert but got {resp2.status_code}: {resp2.text}"
        )

    def test_quotation_status_becomes_converted(self, session, api, customer_id, today):
        quot = _create_quotation(session, api, customer_id, today)
        session.patch(
            f"{api}/api/v1/quotations/{quot['id']}/status",
            params={"status": "accepted"},
        )
        session.post(f"{api}/api/v1/quotations/{quot['id']}/convert-to-so")

        # Fetch the quotation and check status
        detail = session.get(f"{api}/api/v1/quotations/{quot['id']}")
        assert detail.status_code == 200
        assert detail.json()["status"] == "converted"

    def test_draft_cannot_be_converted(self, session, api, customer_id, today):
        quot = _create_quotation(session, api, customer_id, today)  # status=draft
        resp = session.post(
            f"{api}/api/v1/quotations/{quot['id']}/convert-to-so"
        )
        assert resp.status_code == 400, (
            "A draft quotation must not be convertible to SO"
        )


class TestQuotationPDF:
    def test_pdf_returns_application_pdf(self, session, api, customer_id, today):
        quot = _create_quotation(session, api, customer_id, today)
        resp = session.get(f"{api}/api/v1/quotations/{quot['id']}/pdf")
        assert resp.status_code == 200
        assert "application/pdf" in resp.headers.get("content-type", "")

    def test_pdf_larger_than_2kb(self, session, api, customer_id, today):
        quot = _create_quotation(session, api, customer_id, today)
        resp = session.get(f"{api}/api/v1/quotations/{quot['id']}/pdf")
        assert resp.status_code == 200
        assert len(resp.content) > 2048, (
            f"PDF is only {len(resp.content)} bytes — expected > 2 KB"
        )


class TestQuotationGet:
    def test_get_quotation_detail(self, session, api, customer_id, today):
        quot = _create_quotation(session, api, customer_id, today)
        resp = session.get(f"{api}/api/v1/quotations/{quot['id']}")
        assert resp.status_code == 200
        assert resp.json()["id"] == quot["id"]

    def test_get_nonexistent_returns_404(self, session, api):
        fake_id = "00000000-0000-0000-0000-000000000000"
        resp = session.get(f"{api}/api/v1/quotations/{fake_id}")
        assert resp.status_code == 404

    def test_list_quotations_returns_list(self, session, api):
        resp = session.get(f"{api}/api/v1/quotations/")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
