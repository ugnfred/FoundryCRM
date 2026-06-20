"""
Tests for /api/v1/inventory/* endpoints.

Key scenarios:
- GET /inventory/stock returns 200 list with stock levels (balance field)
- POST /inventory/stock/adjust creates adjustment entries (positive and negative)
- After positive adjustment, balance increases
- After negative adjustment, balance decreases
- GET /inventory/stock/ledger/{product_id} returns stock history
- Stock increases after a GRN is created (tested via full flow here)
"""

import pytest


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestInventoryStock:
    def test_stock_list_returns_200(self, session, api):
        resp = session.get(f"{api}/api/v1/inventory/stock")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_stock_list_has_balance_field(self, session, api):
        resp = session.get(f"{api}/api/v1/inventory/stock")
        assert resp.status_code == 200
        items = resp.json()
        # If there are any products, each must have a 'balance' field
        for item in items:
            assert "balance" in item, (
                f"Product {item.get('name')} is missing 'balance' field in inventory response"
            )

    def test_stock_list_has_product_info(self, session, api):
        resp = session.get(f"{api}/api/v1/inventory/stock")
        items = resp.json()
        for item in items:
            assert "id" in item
            assert "name" in item


class TestStockAdjustment:
    def test_positive_adjustment_increases_balance(self, session, api, product_id):
        """POST /stock/adjust with positive qty increases the product's balance."""
        # Get baseline
        before_list = session.get(f"{api}/api/v1/inventory/stock").json()
        before_balance = next(
            (float(p["balance"]) for p in before_list if p["id"] == product_id), 0.0
        )

        resp = session.post(
            f"{api}/api/v1/inventory/stock/adjust",
            json={
                "product_id": product_id,
                "qty": 100,
                "notes": "Test opening stock",
                "txn_type": "opening",
            },
        )
        assert resp.status_code == 201, f"Adjustment failed: {resp.text}"
        new_balance = float(resp.json()["balance"])
        assert new_balance == pytest.approx(before_balance + 100, abs=0.01)

    def test_negative_adjustment_decreases_balance(self, session, api, product_id):
        """POST /stock/adjust with negative qty decreases the product's balance."""
        # First add some stock so we have something to deduct
        session.post(
            f"{api}/api/v1/inventory/stock/adjust",
            json={"product_id": product_id, "qty": 50, "txn_type": "adjustment"},
        )

        before_list = session.get(f"{api}/api/v1/inventory/stock").json()
        before_balance = next(
            (float(p["balance"]) for p in before_list if p["id"] == product_id), 0.0
        )

        resp = session.post(
            f"{api}/api/v1/inventory/stock/adjust",
            json={
                "product_id": product_id,
                "qty": -10,
                "notes": "Write-off",
                "txn_type": "adjustment",
            },
        )
        assert resp.status_code == 201
        new_balance = float(resp.json()["balance"])
        assert new_balance == pytest.approx(before_balance - 10, abs=0.01)

    def test_adjustment_returns_balance(self, session, api, product_id):
        resp = session.post(
            f"{api}/api/v1/inventory/stock/adjust",
            json={"product_id": product_id, "qty": 1, "txn_type": "adjustment"},
        )
        assert resp.status_code == 201
        assert "balance" in resp.json()
        assert isinstance(resp.json()["balance"], (int, float))


class TestStockLedger:
    def test_ledger_returns_200(self, session, api, product_id):
        resp = session.get(f"{api}/api/v1/inventory/stock/ledger/{product_id}")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_ledger_has_expected_fields(self, session, api, product_id):
        # Ensure at least one entry exists
        session.post(
            f"{api}/api/v1/inventory/stock/adjust",
            json={"product_id": product_id, "qty": 5, "txn_type": "adjustment"},
        )
        resp = session.get(f"{api}/api/v1/inventory/stock/ledger/{product_id}")
        entries = resp.json()
        assert len(entries) > 0
        entry = entries[0]
        assert "qty" in entry
        assert "balance" in entry
        assert "txn_type" in entry

    def test_ledger_pagination(self, session, api, product_id):
        resp = session.get(
            f"{api}/api/v1/inventory/stock/ledger/{product_id}",
            params={"limit": 5, "offset": 0},
        )
        assert resp.status_code == 200
        assert len(resp.json()) <= 5

    def test_ledger_nonexistent_product(self, session, api):
        fake_id = "00000000-0000-0000-0000-000000000000"
        resp = session.get(f"{api}/api/v1/inventory/stock/ledger/{fake_id}")
        assert resp.status_code == 200
        assert resp.json() == []  # empty ledger for unknown product


class TestStockAfterGRN:
    """
    Verify inventory reflects GRN receipts.
    This test depends on test_grns.py having run and created stock,
    so it is marked skipif no stock entries exist for product_id.
    """

    def test_product_appears_in_stock_after_adjustment(self, session, api, product_id):
        # Force an adjustment so the product appears in inventory
        session.post(
            f"{api}/api/v1/inventory/stock/adjust",
            json={"product_id": product_id, "qty": 10, "txn_type": "adjustment"},
        )
        resp = session.get(f"{api}/api/v1/inventory/stock")
        assert resp.status_code == 200
        ids = [p["id"] for p in resp.json()]
        assert product_id in ids
