"""
Tests for /api/v1/proforma/* endpoints (Proforma Invoices).

Key scenarios:
- GET / returns 200 list
- POST creates proforma with correct GST totals
- GET /{id} returns PI detail with items
- PUT /{id} updates proforma
- PATCH /{id}/status transitions
- POST /{id}/convert creates a real invoice
- PDF returns application/pdf > 2 KB
"""

import pytest
from conftest import make_line_item


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_pi(session, api, customer_id, today, **overrides):
    payload = {
        "company_id": customer_id,
        "date": today,
        "place_of_supply": "07",
        "items": [make_line_item(qty=10, rate=500, gst_rate=18)],
    }
    payload.update(overrides)
    resp = session.post(f"{api}/api/v1/proforma/", json=payload)
    assert resp.status_code == 201, f"Create proforma failed: {resp.text}"
    return resp.json()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def proforma(session, api, customer_id, today):
    return _create_pi(session, api, customer_id, today)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestProformaList:
    def test_list_returns_200(self, session, api):
        resp = session.get(f"{api}/api/v1/proforma/")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


class TestProformaCreate:
    def test_create_returns_201(self, proforma):
        assert "id" in proforma
        assert "pi_no" in proforma

    def test_totals_correct(self, proforma):
        """10 × 500 × 18% → taxable=5000, total=5900."""
        assert float(proforma["taxable_amt"]) == pytest.approx(5000.0)
        assert float(proforma["total"]) == pytest.approx(5900.0)

    def test_igst_for_inter_state(self, proforma):
        """place_of_supply=07 (Delhi) vs seller 27 (MH) → IGST."""
        assert float(proforma.get("igst", 0)) == pytest.approx(900.0)
        assert float(proforma.get("cgst", 0)) == pytest.approx(0.0)

    def test_intra_state_cgst_sgst(self, session, api, intrastate_customer_id, today):
        pi = _create_pi(session, api, intrastate_customer_id, today,
                        place_of_supply="27",
                        items=[make_line_item(qty=10, rate=500, gst_rate=18)])
        assert float(pi.get("cgst", 0)) == pytest.approx(450.0)
        assert float(pi.get("sgst", 0)) == pytest.approx(450.0)
        assert float(pi.get("igst", 0)) == pytest.approx(0.0)

    def test_create_with_validity_date(self, session, api, customer_id, today):
        pi = _create_pi(session, api, customer_id, today, validity_date=today)
        assert pi["validity_date"] == today

    def test_items_stored(self, proforma):
        assert isinstance(proforma.get("proforma_items"), list)
        assert len(proforma["proforma_items"]) >= 1


class TestProformaDetail:
    def test_get_detail(self, session, api, proforma):
        resp = session.get(f"{api}/api/v1/proforma/{proforma['id']}")
        assert resp.status_code == 200
        assert resp.json()["id"] == proforma["id"]

    def test_detail_has_items(self, session, api, proforma):
        resp = session.get(f"{api}/api/v1/proforma/{proforma['id']}")
        data = resp.json()
        assert "proforma_items" in data
        assert len(data["proforma_items"]) >= 1

    def test_get_nonexistent_404(self, session, api):
        resp = session.get(f"{api}/api/v1/proforma/00000000-0000-0000-0000-000000000000")
        assert resp.status_code == 404


class TestProformaUpdate:
    def test_put_updates_totals(self, session, api, customer_id, today):
        pi = _create_pi(session, api, customer_id, today)
        resp = session.put(
            f"{api}/api/v1/proforma/{pi['id']}",
            json={
                "company_id": customer_id,
                "date": today,
                "place_of_supply": "07",
                "items": [make_line_item(qty=5, rate=200, gst_rate=12)],
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        # 5 × 200 = 1000 taxable; 12% = 120 GST (IGST=120)
        assert float(data["taxable_amt"]) == pytest.approx(1000.0)
        assert float(data["total"]) == pytest.approx(1120.0)


class TestProformaStatus:
    def test_patch_status_sent(self, session, api, customer_id, today):
        pi = _create_pi(session, api, customer_id, today)
        resp = session.patch(
            f"{api}/api/v1/proforma/{pi['id']}/status",
            params={"status": "sent"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "sent"

    def test_patch_invalid_status_400(self, session, api, customer_id, today):
        pi = _create_pi(session, api, customer_id, today)
        resp = session.patch(
            f"{api}/api/v1/proforma/{pi['id']}/status",
            params={"status": "shipped"},
        )
        assert resp.status_code == 400


class TestProformaConvert:
    def test_convert_creates_invoice(self, session, api, customer_id, today):
        pi = _create_pi(session, api, customer_id, today)
        resp = session.post(f"{api}/api/v1/proforma/{pi['id']}/convert")
        assert resp.status_code in (200, 201), f"Convert failed: {resp.text}"
        data = resp.json()
        assert "invoice_id" in data
        assert "inv_no" in data

    def test_convert_twice_returns_400(self, session, api, customer_id, today):
        pi = _create_pi(session, api, customer_id, today)
        session.post(f"{api}/api/v1/proforma/{pi['id']}/convert")
        resp = session.post(f"{api}/api/v1/proforma/{pi['id']}/convert")
        assert resp.status_code == 400, (
            f"Second convert should fail with 400, got {resp.status_code}"
        )


class TestProformaPDF:
    def test_pdf_returns_200(self, session, api, proforma):
        resp = session.get(f"{api}/api/v1/proforma/{proforma['id']}/pdf")
        assert resp.status_code == 200
        assert "application/pdf" in resp.headers.get("content-type", "")

    def test_pdf_larger_than_2kb(self, session, api, proforma):
        resp = session.get(f"{api}/api/v1/proforma/{proforma['id']}/pdf")
        assert len(resp.content) > 2048
