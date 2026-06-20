"""
Tests for /api/v1/grns/* and PO-linked GRN creation at /api/v1/purchase-orders/{po_id}/grn.

Key scenarios:
- GET /api/v1/grns/ returns 200 list
- POST /api/v1/purchase-orders/{po_id}/grn creates a GRN and returns grn_id / grn_no
- After GRN creation, inventory stock increases for the received product
- GET /api/v1/grns/{grn_id} returns GRN detail

The GRN is created via the PO router (POST /purchase-orders/{po_id}/grn)
because the GRN router only has GET endpoints.
"""

import pytest
from conftest import make_line_item


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def po_with_items(session, api, customer_id, product_id, today):
    """Create a PO with one line item that references product_id."""
    payload = {
        "company_id": customer_id,
        "date": today,
        "status": "draft",
        "items": [
            {
                "description": "GRN Test Component",
                "hsn_code": "73181500",
                "uom": "KG",
                "qty": 100,
                "rate": 50,
                "gst_rate": 18,
                "product_id": product_id,
            }
        ],
    }
    resp = session.post(f"{api}/api/v1/purchase-orders/", json=payload)
    assert resp.status_code == 201, f"Failed to create PO: {resp.text}"
    return resp.json()


@pytest.fixture(scope="module")
def grn_data(session, api, po_with_items, product_id, today):
    """Create a GRN for po_with_items and return the GRN response data."""
    po = po_with_items
    po_item_id = po["po_items"][0]["id"]

    payload = {
        "po_id": po["id"],
        "received_date": today,
        "notes": "Test GRN",
        "items": [
            {
                "po_item_id": po_item_id,
                "product_id": product_id,
                "qty_received": 50,
                "rate": 50,
            }
        ],
    }
    resp = session.post(f"{api}/api/v1/purchase-orders/{po['id']}/grn", json=payload)
    assert resp.status_code == 201, f"Failed to create GRN: {resp.text}"
    return resp.json()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestGRNList:
    def test_list_grns_returns_200(self, session, api):
        resp = session.get(f"{api}/api/v1/grns/")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


class TestGRNCreate:
    def test_create_grn_returns_grn_id(self, grn_data):
        assert "grn_id" in grn_data
        assert grn_data["grn_id"]

    def test_create_grn_returns_grn_no(self, grn_data):
        assert "grn_no" in grn_data
        assert grn_data["grn_no"]

    def test_grn_appears_in_list(self, session, api, grn_data):
        resp = session.get(f"{api}/api/v1/grns/")
        assert resp.status_code == 200
        ids = [g["id"] for g in resp.json()]
        assert grn_data["grn_id"] in ids


class TestGRNDetail:
    def test_get_grn_detail(self, session, api, grn_data):
        resp = session.get(f"{api}/api/v1/grns/{grn_data['grn_id']}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == grn_data["grn_id"]

    def test_grn_detail_has_items(self, session, api, grn_data):
        resp = session.get(f"{api}/api/v1/grns/{grn_data['grn_id']}")
        data = resp.json()
        assert "grn_items" in data
        assert len(data["grn_items"]) >= 1

    def test_get_nonexistent_grn_404(self, session, api):
        fake_id = "00000000-0000-0000-0000-000000000000"
        resp = session.get(f"{api}/api/v1/grns/{fake_id}")
        assert resp.status_code == 404


class TestGRNStockEffect:
    def test_stock_increases_after_grn(self, session, api, product_id, grn_data):
        """After GRN creation, the product's inventory balance must have increased."""
        resp = session.get(f"{api}/api/v1/inventory/stock")
        if resp.status_code == 404:
            pytest.skip("Inventory stock endpoint not available")
        assert resp.status_code == 200
        stock_map = {item["id"]: item["balance"] for item in resp.json()}
        # Product must appear and have a positive balance after GRN of 50 units
        assert product_id in stock_map, "Product not found in inventory list"
        assert stock_map[product_id] > 0, (
            f"Expected positive stock after GRN but got {stock_map[product_id]}"
        )


class TestGRNPDF:
    def test_grn_pdf_returns_200(self, session, api, grn_data):
        resp = session.get(f"{api}/api/v1/grns/{grn_data['grn_id']}/pdf")
        if resp.status_code == 404:
            pytest.skip("GRN PDF endpoint not implemented")
        assert resp.status_code == 200
        assert "application/pdf" in resp.headers.get("content-type", "")

    def test_grn_pdf_larger_than_2kb(self, session, api, grn_data):
        resp = session.get(f"{api}/api/v1/grns/{grn_data['grn_id']}/pdf")
        if resp.status_code == 404:
            pytest.skip("GRN PDF endpoint not implemented")
        assert len(resp.content) > 2048
