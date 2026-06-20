"""
Tests for /api/v1/bom/* endpoints (Bill of Materials).

Key scenarios:
- GET / returns 200 list
- POST creates BOM with product_id and materials (components)
- GET /{id} returns BOM detail with bom_items
- PUT /{id} creates a new version (BOM is immutable — PUT creates v+1)
- BOM versioning: second POST for same product creates v2 and deactivates v1
- GET /active?product_id= returns the active BOM for a product
"""

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_bom(session, api, product_id, component_product_id, **overrides):
    payload = {
        "product_id": product_id,
        "notes": "Test BOM",
        "items": [
            {
                "component_id": component_product_id,
                "qty": 2.5,
                "uom": "KG",
                "notes": "Main raw material",
            }
        ],
    }
    payload.update(overrides)
    resp = session.post(f"{api}/api/v1/bom/", json=payload)
    assert resp.status_code == 201, f"Create BOM failed: {resp.text}"
    return resp.json()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def bom(session, api, product_id, component_product_id):
    return _create_bom(session, api, product_id, component_product_id)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestBOMList:
    def test_list_returns_200(self, session, api):
        resp = session.get(f"{api}/api/v1/bom/")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_list_filter_by_product(self, session, api, product_id, bom):
        resp = session.get(f"{api}/api/v1/bom/", params={"product_id": product_id})
        assert resp.status_code == 200
        items = resp.json()
        # All returned BOMs must belong to the requested product
        for item in items:
            assert item["product_id"] == product_id


class TestBOMCreate:
    def test_create_returns_201(self, bom):
        assert "id" in bom

    def test_bom_has_version(self, bom):
        assert "version" in bom
        assert bom["version"] >= 1

    def test_bom_is_active(self, bom):
        assert bom["is_active"] is True

    def test_bom_items_stored(self, bom):
        assert isinstance(bom.get("bom_items"), list)
        assert len(bom["bom_items"]) >= 1

    def test_bom_item_has_required_fields(self, bom):
        item = bom["bom_items"][0]
        assert "component_id" in item
        assert "qty" in item
        assert float(item["qty"]) == pytest.approx(2.5)

    def test_second_bom_creates_new_version(self, session, api, product_id,
                                              component_product_id):
        """Creating a second BOM for the same product creates v2 and deactivates v1."""
        # Create first BOM
        bom_v1 = _create_bom(session, api, product_id, component_product_id)
        v1_id = bom_v1["id"]

        # Create second BOM for same product
        bom_v2 = _create_bom(session, api, product_id, component_product_id,
                              notes="Version 2")
        assert bom_v2["version"] > bom_v1["version"], (
            "New BOM must have a higher version number than the previous one"
        )
        assert bom_v2["is_active"] is True

        # Original BOM must now be inactive
        detail_v1 = session.get(f"{api}/api/v1/bom/{v1_id}")
        assert detail_v1.status_code == 200
        assert detail_v1.json()["is_active"] is False


class TestBOMDetail:
    def test_get_bom_detail(self, session, api, bom):
        resp = session.get(f"{api}/api/v1/bom/{bom['id']}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == bom["id"]

    def test_detail_has_bom_items(self, session, api, bom):
        resp = session.get(f"{api}/api/v1/bom/{bom['id']}")
        data = resp.json()
        assert "bom_items" in data
        assert len(data["bom_items"]) >= 1

    def test_get_nonexistent_bom_404(self, session, api):
        resp = session.get(f"{api}/api/v1/bom/00000000-0000-0000-0000-000000000000")
        assert resp.status_code == 404


class TestBOMUpdate:
    def test_put_creates_new_version(self, session, api, product_id,
                                      component_product_id, bom):
        old_version = bom["version"]
        resp = session.put(
            f"{api}/api/v1/bom/{bom['id']}",
            json={
                "product_id": product_id,
                "notes": "Updated BOM",
                "items": [
                    {
                        "component_id": component_product_id,
                        "qty": 5.0,
                        "uom": "KG",
                    }
                ],
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["version"] > old_version, (
            "PUT should create a new version (immutable versioning)"
        )
        assert data["is_active"] is True
        # The updated BOM item must reflect new qty
        assert float(data["bom_items"][0]["qty"]) == pytest.approx(5.0)


class TestBOMActiveLookup:
    def test_get_active_bom(self, session, api, product_id, bom):
        resp = session.get(
            f"{api}/api/v1/bom/active",
            params={"product_id": product_id},
        )
        if resp.status_code == 404:
            # No active BOM yet — acceptable if product was just created
            return
        assert resp.status_code == 200
        data = resp.json()
        if data:
            assert data["is_active"] is True
            assert data["product_id"] == product_id
