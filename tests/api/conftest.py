"""
Shared pytest fixtures for foundry-erp API tests.

Auth flow:
  1. POST to Supabase auth API to get a JWT
  2. Use that JWT as the Bearer token in all subsequent requests

Environment variables (loaded from agents/sdlc/.env if present):
  SUPABASE_URL       — Supabase project URL
  SUPABASE_ANON_KEY  — Supabase anonymous/publishable key
  TEST_EMAIL         — Supabase Auth user (must have admin role)
  TEST_PASSWORD      — password for TEST_EMAIL
  API_BASE_URL       — override the backend URL (optional)
"""

import os
from datetime import date
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Load .env from agents/sdlc/ if it exists
# ---------------------------------------------------------------------------
_env_path = Path(__file__).parents[2] / "agents" / "sdlc" / ".env"
if _env_path.exists():
    load_dotenv(dotenv_path=_env_path, override=False)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
DEFAULT_API_URL = "https://foundrycrm-production.up.railway.app"
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://zdpfbtvuxncwbvovfnxk.supabase.co")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")

TODAY = str(date.today())

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def api():
    """Base URL for the FastAPI backend."""
    return os.environ.get("API_BASE_URL", DEFAULT_API_URL)


@pytest.fixture(scope="module")
def token():
    """
    Log in via the Supabase REST auth API and return the JWT access token.
    Module-scoped: one login per test file.
    """
    email = os.environ.get("TEST_EMAIL", "")
    password = os.environ.get("TEST_PASSWORD", "")

    if not email or not password:
        pytest.skip("TEST_EMAIL and TEST_PASSWORD env vars are required")

    if not SUPABASE_ANON_KEY:
        pytest.skip("SUPABASE_ANON_KEY env var is required")

    url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
    resp = requests.post(
        url,
        json={"email": email, "password": password},
        headers={
            "apikey": SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
        },
        timeout=30,
    )
    assert resp.status_code == 200, (
        f"Supabase login failed ({resp.status_code}): {resp.text}"
    )
    data = resp.json()
    return data["access_token"]


@pytest.fixture(scope="module")
def session(token, api):
    """
    A requests.Session with the Authorization header pre-configured.
    Module-scoped so the session (and token) are reused within a test file.
    """
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def today():
    """ISO date string for today."""
    return TODAY


@pytest.fixture(scope="module")
def customer_id(session, api):
    """
    Create (or reuse) a test customer company and return its ID.
    Module-scoped: created once per test file that imports it.
    """
    payload = {
        "name": "Pytest Test Customer Co.",
        "gstin": "27AABCT1332L1ZT",
        "state_code": "07",   # Delhi — different from seller state (27=MH) for IGST tests
        "address": "42 Test Lane",
        "city": "New Delhi",
        "pincode": "110001",
        "is_active": True,
    }
    resp = session.post(f"{api}/api/v1/settings/companies", json=payload)
    assert resp.status_code == 201, f"Failed to create customer: {resp.text}"
    return resp.json()["id"]


@pytest.fixture(scope="module")
def intrastate_customer_id(session, api):
    """
    A customer in Maharashtra (state_code=27) — same state as seller.
    Used for CGST/SGST intra-state GST tests.
    """
    payload = {
        "name": "Pytest Intrastate Customer",
        "gstin": "33AABCT1332L1ZU",
        "state_code": "33",   # Tamil Nadu — same as seller (Royal Met Alloys)
        "address": "99 TN Road",
        "city": "Chennai",
        "pincode": "600001",
        "is_active": True,
    }
    resp = session.post(f"{api}/api/v1/settings/companies", json=payload)
    assert resp.status_code == 201, f"Failed to create intrastate customer: {resp.text}"
    return resp.json()["id"]


@pytest.fixture(scope="module")
def product_id(session, api):
    """
    Create a test product and return its ID.
    Module-scoped: created once per test file that imports it.
    """
    payload = {
        "name": "Pytest Test Widget",
        "hsn_code": "84139100",
        "uom": "NOS",
        "category": "Finished Goods",
        "base_rate": 500.0,
        "gst_rate": 18.0,
        "is_active": True,
    }
    resp = session.post(f"{api}/api/v1/settings/products", json=payload)
    assert resp.status_code == 201, f"Failed to create product: {resp.text}"
    return resp.json()["id"]


@pytest.fixture(scope="module")
def component_product_id(session, api):
    """
    A second product used as a BOM component.
    """
    payload = {
        "name": "Pytest BOM Component",
        "hsn_code": "73181500",
        "uom": "KG",
        "category": "Raw Material",
        "base_rate": 100.0,
        "gst_rate": 18.0,
        "is_active": True,
    }
    resp = session.post(f"{api}/api/v1/settings/products", json=payload)
    assert resp.status_code == 201, f"Failed to create component product: {resp.text}"
    return resp.json()["id"]


# ---------------------------------------------------------------------------
# Helper builders (not fixtures — import directly in test files)
# ---------------------------------------------------------------------------

def make_line_item(description="Test Widget", qty=10, rate=500, gst_rate=18,
                   hsn_code="84139100", uom="NOS", product_id=None):
    """Return a dict representing one line item for quotations/SO/invoices."""
    item = {
        "description": description,
        "hsn_code": hsn_code,
        "uom": uom,
        "qty": qty,
        "rate": rate,
        "gst_rate": gst_rate,
        "sort_order": 0,
    }
    if product_id:
        item["product_id"] = product_id
    return item
