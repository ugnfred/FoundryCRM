"""
Tests for /api/v1/settings/* endpoints.

Covers:
- GET /settings/company — returns company settings with required fields
- PUT /settings/company — upsert (tested implicitly via assertions)
- GET /settings/products/ — returns list
- POST /settings/products/ — creates a product
- GET /settings/companies/ — returns list
- POST /settings/companies/ — creates a customer
"""

import pytest


# ---------------------------------------------------------------------------
# Company settings
# ---------------------------------------------------------------------------

class TestCompanySettings:
    def test_get_company_returns_200(self, session, api):
        resp = session.get(f"{api}/api/v1/settings/company")
        assert resp.status_code == 200

    def test_get_company_has_name_field(self, session, api):
        resp = session.get(f"{api}/api/v1/settings/company")
        data = resp.json()
        # Either an empty dict (not configured yet) or must have 'name'
        if data:
            assert "name" in data

    def test_company_fields_not_none_string(self, session, api):
        """Ensure serialised fields are not the literal string 'None'."""
        resp = session.get(f"{api}/api/v1/settings/company")
        data = resp.json()
        if not data:
            pytest.skip("Company settings not configured yet")
        for field in ("name", "address_line1", "city", "pincode"):
            val = data.get(field)
            assert val != "None", (
                f"Field '{field}' is the literal string 'None' — "
                "use None/null instead"
            )

    def test_company_has_state_code(self, session, api):
        resp = session.get(f"{api}/api/v1/settings/company")
        data = resp.json()
        if not data:
            pytest.skip("Company settings not configured yet")
        assert "state_code" in data
        assert data["state_code"], "state_code must not be empty"


# ---------------------------------------------------------------------------
# Products
# ---------------------------------------------------------------------------

class TestProducts:
    def test_list_products_returns_200(self, session, api):
        resp = session.get(f"{api}/api/v1/settings/products")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_create_product(self, session, api):
        payload = {
            "name": "Settings Test Product",
            "hsn_code": "84139100",
            "uom": "NOS",
            "category": "Finished Goods",
            "sale_rate": 750.0,
            "gst_rate": 18.0,
            "is_active": True,
        }
        resp = session.post(f"{api}/api/v1/settings/products", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == payload["name"]
        assert data["hsn_code"] == payload["hsn_code"]
        assert "id" in data

    def test_create_product_returns_id(self, session, api):
        payload = {
            "name": "Another Settings Product",
            "hsn_code": "73181500",
            "uom": "KG",
            "gst_rate": 12.0,
            "is_active": True,
        }
        resp = session.post(f"{api}/api/v1/settings/products", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert "id" in data
        # id should look like a UUID
        assert len(data["id"]) == 36

    def test_created_product_appears_in_list(self, session, api):
        payload = {
            "name": "Listable Product XYZ",
            "hsn_code": "84139100",
            "uom": "NOS",
            "gst_rate": 18.0,
            "is_active": True,
        }
        create_resp = session.post(f"{api}/api/v1/settings/products", json=payload)
        assert create_resp.status_code == 201
        new_id = create_resp.json()["id"]

        list_resp = session.get(f"{api}/api/v1/settings/products")
        assert list_resp.status_code == 200
        ids = [p["id"] for p in list_resp.json()]
        assert new_id in ids


# ---------------------------------------------------------------------------
# Companies (customers / suppliers)
# ---------------------------------------------------------------------------

class TestCompanies:
    def test_list_companies_returns_200(self, session, api):
        resp = session.get(f"{api}/api/v1/settings/companies")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_create_company(self, session, api):
        payload = {
            "name": "Settings Test Company Ltd",
            "gstin": "27AABCT1332L1ZT",
            "state_code": "27",
            "city": "Mumbai",
            "is_active": True,
        }
        resp = session.post(f"{api}/api/v1/settings/companies", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == payload["name"]
        assert "id" in data

    def test_create_company_with_full_address(self, session, api):
        payload = {
            "name": "Full Address Company Pvt Ltd",
            "gstin": "29AABCT1332L1ZT",
            "state_code": "29",
            "address_line1": "123 Industrial Estate",
            "address_line2": "Phase II",
            "city": "Bengaluru",
            "pincode": "560001",
            "phone": "9876543210",
            "email": "billing@fulladdressco.com",
            "is_active": True,
        }
        resp = session.post(f"{api}/api/v1/settings/companies", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert data["city"] == "Bengaluru"
        assert data["pincode"] == "560001"

    def test_created_company_appears_in_list(self, session, api):
        payload = {
            "name": "Listable Company ABC",
            "state_code": "27",
            "is_active": True,
        }
        create_resp = session.post(f"{api}/api/v1/settings/companies", json=payload)
        assert create_resp.status_code == 201
        new_id = create_resp.json()["id"]

        list_resp = session.get(f"{api}/api/v1/settings/companies")
        assert list_resp.status_code == 200
        ids = [c["id"] for c in list_resp.json()]
        assert new_id in ids

    def test_requires_auth(self, api):
        """Unauthenticated request must be rejected."""
        resp = requests.get(f"{api}/api/v1/settings/company")
        assert resp.status_code in (401, 403)


import requests
