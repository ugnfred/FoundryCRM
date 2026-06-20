"""
Tests for /api/v1/delivery-challans/* endpoints.

Key scenarios:
- GET / returns 200 list
- POST creates a DC and returns dc_no
- GET /{id} returns DC detail with items
- PUT /{id} updates DC (only if not dispatched)
- PATCH /{id}/dispatch transitions to dispatched
- PATCH /{id}/cancel transitions to cancelled
- Cannot edit a dispatched DC (400)
- PDF returns application/pdf > 2 KB
"""

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_dc(session, api, customer_id, today, **overrides):
    payload = {
        "company_id": customer_id,
        "date": today,
        "items": [
            {
                "description": "Test Widget",
                "hsn_code": "84139100",
                "uom": "NOS",
                "qty": 10,
            }
        ],
    }
    payload.update(overrides)
    resp = session.post(f"{api}/api/v1/delivery-challans/", json=payload)
    assert resp.status_code == 201, f"Create DC failed: {resp.text}"
    return resp.json()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def delivery_challan(session, api, customer_id, today):
    return _create_dc(session, api, customer_id, today)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestDCList:
    def test_list_returns_200(self, session, api):
        resp = session.get(f"{api}/api/v1/delivery-challans/")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


class TestDCCreate:
    def test_create_returns_201(self, delivery_challan):
        assert "id" in delivery_challan
        assert "dc_no" in delivery_challan

    def test_create_with_vehicle_and_transporter(self, session, api, customer_id, today):
        dc = _create_dc(
            session, api, customer_id, today,
            vehicle_no="MH12AB1234",
            transporter_name="Fast Transport Co.",
        )
        assert dc["vehicle_no"] == "MH12AB1234"
        assert dc["transporter_name"] == "Fast Transport Co."

    def test_items_stored(self, delivery_challan):
        assert isinstance(delivery_challan.get("dc_items"), list)
        assert len(delivery_challan["dc_items"]) >= 1

    def test_create_with_notes(self, session, api, customer_id, today):
        dc = _create_dc(session, api, customer_id, today, notes="Handle with care")
        assert dc.get("notes") == "Handle with care"

    def test_initial_status_draft(self, delivery_challan):
        assert delivery_challan["status"] == "draft"


class TestDCDetail:
    def test_get_detail(self, session, api, delivery_challan):
        resp = session.get(f"{api}/api/v1/delivery-challans/{delivery_challan['id']}")
        assert resp.status_code == 200
        assert resp.json()["id"] == delivery_challan["id"]

    def test_detail_has_items(self, session, api, delivery_challan):
        resp = session.get(f"{api}/api/v1/delivery-challans/{delivery_challan['id']}")
        data = resp.json()
        assert "dc_items" in data
        assert len(data["dc_items"]) >= 1

    def test_get_nonexistent_404(self, session, api):
        resp = session.get(
            f"{api}/api/v1/delivery-challans/00000000-0000-0000-0000-000000000000"
        )
        assert resp.status_code == 404


class TestDCUpdate:
    def test_put_updates_dc(self, session, api, customer_id, today):
        dc = _create_dc(session, api, customer_id, today)
        resp = session.put(
            f"{api}/api/v1/delivery-challans/{dc['id']}",
            json={
                "company_id": customer_id,
                "date": today,
                "vehicle_no": "MH01XY9999",
                "items": [{"description": "Updated Item", "uom": "NOS", "qty": 5}],
            },
        )
        assert resp.status_code == 200
        assert resp.json()["vehicle_no"] == "MH01XY9999"


class TestDCDispatch:
    def test_dispatch_changes_status(self, session, api, customer_id, today):
        dc = _create_dc(session, api, customer_id, today)
        resp = session.patch(f"{api}/api/v1/delivery-challans/{dc['id']}/dispatch")
        assert resp.status_code == 200
        assert resp.json()["status"] == "dispatched"

    def test_cannot_edit_dispatched_dc(self, session, api, customer_id, today):
        dc = _create_dc(session, api, customer_id, today)
        session.patch(f"{api}/api/v1/delivery-challans/{dc['id']}/dispatch")
        # Try to edit — must be rejected
        resp = session.put(
            f"{api}/api/v1/delivery-challans/{dc['id']}",
            json={
                "company_id": customer_id,
                "date": today,
                "items": [{"description": "Should Fail", "uom": "NOS", "qty": 1}],
            },
        )
        assert resp.status_code == 400, (
            f"Expected 400 when editing dispatched DC, got {resp.status_code}"
        )


class TestDCCancel:
    def test_cancel_dc(self, session, api, customer_id, today):
        dc = _create_dc(session, api, customer_id, today)
        resp = session.patch(f"{api}/api/v1/delivery-challans/{dc['id']}/cancel")
        assert resp.status_code == 200
        assert resp.json()["status"] == "cancelled"


class TestDCPDF:
    def test_pdf_returns_200(self, session, api, delivery_challan):
        resp = session.get(
            f"{api}/api/v1/delivery-challans/{delivery_challan['id']}/pdf"
        )
        assert resp.status_code == 200
        assert "application/pdf" in resp.headers.get("content-type", "")

    def test_pdf_larger_than_2kb(self, session, api, delivery_challan):
        resp = session.get(
            f"{api}/api/v1/delivery-challans/{delivery_challan['id']}/pdf"
        )
        assert len(resp.content) > 2048
