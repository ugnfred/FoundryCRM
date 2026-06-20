"""
Tests for /api/v1/purchase-orders/* endpoints.

Key scenarios:
- GET / returns 200 list
- POST creates PO with items; totals are correct
- GET /{id} returns PO detail with items
- PUT /{id} updates PO items and recalculates totals
- Invalid status returns 400

Note: PO endpoints require admin or accounts role.
"""

import pytest
from conftest import make_line_item


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_po(session, api, customer_id, today, **overrides):
    payload = {
        "company_id": customer_id,
        "date": today,
        "status": "draft",
        "items": [make_line_item(qty=20, rate=100, gst_rate=18,
                                 description="Raw Material", hsn_code="73181500")],
    }
    payload.update(overrides)
    resp = session.post(f"{api}/api/v1/purchase-orders/", json=payload)
    assert resp.status_code == 201, f"Create PO failed: {resp.text}"
    return resp.json()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestPOList:
    def test_list_returns_200(self, session, api):
        resp = session.get(f"{api}/api/v1/purchase-orders/")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


class TestPOCreate:
    def test_create_po_returns_201(self, session, api, customer_id, today):
        po = _create_po(session, api, customer_id, today)
        assert "id" in po
        assert "po_no" in po

    def test_totals_correct(self, session, api, customer_id, today):
        """20 × 100 × 18% → taxable=2000, gst=360, total=2360."""
        po = _create_po(session, api, customer_id, today,
                        items=[make_line_item(qty=20, rate=100, gst_rate=18,
                                             description="RM", hsn_code="73181500")])
        assert float(po["taxable_amt"]) == pytest.approx(2000.0)
        assert float(po["total_gst"]) == pytest.approx(360.0)
        assert float(po["total"]) == pytest.approx(2360.0)

    def test_po_items_stored(self, session, api, customer_id, today):
        po = _create_po(session, api, customer_id, today)
        assert isinstance(po.get("po_items"), list)
        assert len(po["po_items"]) >= 1

    def test_create_po_with_delivery_date(self, session, api, customer_id, today):
        po = _create_po(session, api, customer_id, today,
                        delivery_date=today)
        assert po["delivery_date"] == today

    @pytest.mark.parametrize("qty,rate,gst_rate,exp_taxable,exp_gst", [
        (10, 50, 5, 500, 25),
        (5, 400, 12, 2000, 240),
        (100, 20, 28, 2000, 560),
    ])
    def test_totals_parametrized(self, session, api, customer_id, today,
                                  qty, rate, gst_rate, exp_taxable, exp_gst):
        po = _create_po(
            session, api, customer_id, today,
            items=[make_line_item(qty=qty, rate=rate, gst_rate=gst_rate,
                                  description="Item", hsn_code="73181500")],
        )
        assert float(po["taxable_amt"]) == pytest.approx(exp_taxable)
        assert float(po["total_gst"]) == pytest.approx(exp_gst)
        assert float(po["total"]) == pytest.approx(exp_taxable + exp_gst)


class TestPODetail:
    def test_get_po_detail(self, session, api, customer_id, today):
        po = _create_po(session, api, customer_id, today)
        resp = session.get(f"{api}/api/v1/purchase-orders/{po['id']}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == po["id"]
        assert "po_items" in data

    def test_get_nonexistent_po_returns_404(self, session, api):
        fake_id = "00000000-0000-0000-0000-000000000000"
        resp = session.get(f"{api}/api/v1/purchase-orders/{fake_id}")
        assert resp.status_code == 404


class TestPOUpdate:
    def test_put_updates_items(self, session, api, customer_id, today):
        po = _create_po(session, api, customer_id, today)
        # Update with different qty
        updated_items = [make_line_item(qty=50, rate=100, gst_rate=18,
                                        description="Updated RM", hsn_code="73181500")]
        resp = session.put(
            f"{api}/api/v1/purchase-orders/{po['id']}",
            json={
                "company_id": customer_id,
                "date": today,
                "status": "draft",
                "items": updated_items,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        # 50 × 100 × 18% = taxable 5000, gst 900, total 5900
        assert float(data["taxable_amt"]) == pytest.approx(5000.0)
        assert float(data["total_gst"]) == pytest.approx(900.0)
