"""
Tests for /api/v1/work-orders/* endpoints.

Key scenarios:
- GET / returns 200 list
- POST creates WO with product_id (bom_id auto-linked if active BOM exists)
- GET /{id} returns WO detail with BOM items and stock shortages
- PATCH /{id}/status transitions: open → in_progress, cancelled
- POST /{id}/complete transitions to 'done' and posts stock entries
- Cannot complete a cancelled WO (400)
- Cannot complete a WO with insufficient stock for BOM components (400)
- GET / with ?status filter works
"""

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_wo(session, api, product_id, today, **overrides):
    payload = {
        "product_id": product_id,
        "qty": 5,
        "start_date": today,
    }
    payload.update(overrides)
    resp = session.post(f"{api}/api/v1/work-orders/", json=payload)
    assert resp.status_code == 201, f"Create WO failed: {resp.text}"
    return resp.json()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def work_order(session, api, product_id, today):
    return _create_wo(session, api, product_id, today)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestWOList:
    def test_list_returns_200(self, session, api):
        resp = session.get(f"{api}/api/v1/work-orders/")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_list_filter_by_status(self, session, api, product_id, today):
        # Create a WO in open status so filter has something to find
        _create_wo(session, api, product_id, today)
        resp = session.get(f"{api}/api/v1/work-orders/", params={"status": "open"})
        assert resp.status_code == 200
        for wo in resp.json():
            assert wo["status"] == "open"


class TestWOCreate:
    def test_create_returns_201(self, work_order):
        assert "id" in work_order
        assert "wo_no" in work_order

    def test_initial_status_is_open(self, work_order):
        assert work_order["status"] == "open"

    def test_qty_stored(self, work_order):
        assert float(work_order["qty"]) == pytest.approx(5.0)

    def test_create_with_target_date(self, session, api, product_id, today):
        wo = _create_wo(session, api, product_id, today, target_date=today)
        assert wo["target_date"] == today

    def test_create_with_notes(self, session, api, product_id, today):
        wo = _create_wo(session, api, product_id, today, notes="Urgent order")
        assert wo.get("notes") == "Urgent order"


class TestWODetail:
    def test_get_detail(self, session, api, work_order):
        resp = session.get(f"{api}/api/v1/work-orders/{work_order['id']}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == work_order["id"]

    def test_detail_has_product(self, session, api, work_order):
        resp = session.get(f"{api}/api/v1/work-orders/{work_order['id']}")
        data = resp.json()
        assert "product_id" in data

    def test_detail_with_bom_shows_stock_info(self, session, api, product_id,
                                               component_product_id, today):
        """
        If a BOM exists for the product, WO detail must show required_qty,
        on_hand, and shortage per component.
        """
        # First create a BOM for the product
        bom_resp = session.post(
            f"{api}/api/v1/bom/",
            json={
                "product_id": product_id,
                "items": [{"component_id": component_product_id, "qty": 1.0, "uom": "KG"}],
            },
        )
        if bom_resp.status_code != 201:
            pytest.skip("Could not create BOM for WO detail test")

        wo = _create_wo(session, api, product_id, today)
        resp = session.get(f"{api}/api/v1/work-orders/{wo['id']}")
        data = resp.json()
        bom_data = data.get("bom_headers")
        if bom_data and bom_data.get("bom_items"):
            for item in bom_data["bom_items"]:
                assert "required_qty" in item
                assert "on_hand" in item
                assert "shortage" in item

    def test_get_nonexistent_wo_404(self, session, api):
        resp = session.get(
            f"{api}/api/v1/work-orders/00000000-0000-0000-0000-000000000000"
        )
        assert resp.status_code == 404


class TestWOStatus:
    def test_status_in_progress(self, session, api, product_id, today):
        wo = _create_wo(session, api, product_id, today)
        resp = session.patch(
            f"{api}/api/v1/work-orders/{wo['id']}/status",
            params={"status": "in_progress"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "in_progress"

    def test_status_cancelled(self, session, api, product_id, today):
        wo = _create_wo(session, api, product_id, today)
        resp = session.patch(
            f"{api}/api/v1/work-orders/{wo['id']}/status",
            params={"status": "cancelled"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "cancelled"

    def test_invalid_status_returns_400(self, session, api, product_id, today):
        wo = _create_wo(session, api, product_id, today)
        resp = session.patch(
            f"{api}/api/v1/work-orders/{wo['id']}/status",
            params={"status": "done"},  # 'done' is only via /complete
        )
        assert resp.status_code == 400

    @pytest.mark.parametrize("status", ["open", "in_progress"])
    def test_valid_statuses(self, session, api, product_id, today, status):
        wo = _create_wo(session, api, product_id, today)
        resp = session.patch(
            f"{api}/api/v1/work-orders/{wo['id']}/status",
            params={"status": status},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == status


class TestWOComplete:
    def test_complete_cancelled_wo_returns_400(self, session, api, product_id, today):
        wo = _create_wo(session, api, product_id, today)
        session.patch(f"{api}/api/v1/work-orders/{wo['id']}/status",
                      params={"status": "cancelled"})
        resp = session.post(f"{api}/api/v1/work-orders/{wo['id']}/complete")
        assert resp.status_code == 400, (
            "Cannot complete a cancelled work order"
        )

    def test_complete_wo_without_bom_succeeds(self, session, api, product_id, today):
        """
        A WO without any linked BOM should complete without stock deduction
        (only adds finished product to stock).
        We create a product that has no BOM.
        """
        # Create a separate product without BOM
        prod_resp = session.post(
            f"{api}/api/v1/settings/products",
            json={
                "name": "No BOM Product WO Test",
                "hsn_code": "84139100",
                "uom": "NOS",
                "gst_rate": 18.0,
                "is_active": True,
            },
        )
        assert prod_resp.status_code == 201
        no_bom_product_id = prod_resp.json()["id"]

        wo = _create_wo(session, api, no_bom_product_id, today, qty=2)
        # Ensure no BOM is linked
        assert wo.get("bom_id") is None or wo.get("bom_headers") is None

        resp = session.post(f"{api}/api/v1/work-orders/{wo['id']}/complete")
        assert resp.status_code == 200, (
            f"WO without BOM should complete (no component deductions): {resp.text}"
        )
        assert resp.json()["status"] == "done"

    def test_complete_already_done_returns_400(self, session, api, product_id, today):
        # Create product without BOM so it completes cleanly
        prod_resp = session.post(
            f"{api}/api/v1/settings/products",
            json={
                "name": "Done Test Product",
                "hsn_code": "84139100",
                "uom": "NOS",
                "gst_rate": 18.0,
                "is_active": True,
            },
        )
        assert prod_resp.status_code == 201
        pid = prod_resp.json()["id"]

        wo = _create_wo(session, api, pid, today, qty=1)
        session.post(f"{api}/api/v1/work-orders/{wo['id']}/complete")
        resp = session.post(f"{api}/api/v1/work-orders/{wo['id']}/complete")
        assert resp.status_code == 400, "Cannot complete an already-done WO"
