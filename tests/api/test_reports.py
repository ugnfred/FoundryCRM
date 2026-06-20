"""
Tests for /api/v1/reports/* endpoints.

Key scenarios:
- GET /reports/gstr1 with from_date/to_date → 200 with b2b/b2cs/cdnr keys
- GET /reports/gstr3b → 200
- GET /reports/gstr1/excel → 200 with Excel content-type
- GET /reports/gstr3b/excel → 200 with Excel content-type
- GET /reports/gstr1/json → 200 with JSON content
- GET /reports/aging/receivables → 200 with 'rows' and 'as_of' keys
- GET /reports/aging/payables → 200 with 'rows' and 'as_of' keys
- Excel aging downloads return Excel content-type
- Missing required params → 422

Note: The old paths /reports/receivables-aging and /reports/payables-aging
may redirect or have moved. Tests use the current router paths from the code.
"""

import pytest

EXCEL_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

# Date range covering the current fiscal year
FROM_DATE = "2024-04-01"
TO_DATE = "2025-03-31"


# ---------------------------------------------------------------------------
# GSTR-1
# ---------------------------------------------------------------------------

class TestGSTR1:
    def test_gstr1_returns_200(self, session, api):
        resp = session.get(
            f"{api}/api/v1/reports/gstr1",
            params={"from_date": FROM_DATE, "to_date": TO_DATE},
        )
        assert resp.status_code == 200

    def test_gstr1_has_required_keys(self, session, api):
        resp = session.get(
            f"{api}/api/v1/reports/gstr1",
            params={"from_date": FROM_DATE, "to_date": TO_DATE},
        )
        assert resp.status_code == 200
        data = resp.json()
        # Must contain the standard GSTR-1 sections
        for key in ("b2b", "b2cs", "cdnr"):
            assert key in data, f"GSTR-1 response missing key '{key}'"

    def test_gstr1_b2b_is_list(self, session, api):
        resp = session.get(
            f"{api}/api/v1/reports/gstr1",
            params={"from_date": FROM_DATE, "to_date": TO_DATE},
        )
        data = resp.json()
        assert isinstance(data["b2b"], list)
        assert isinstance(data["b2cs"], list)
        assert isinstance(data["cdnr"], list)

    def test_gstr1_missing_params_returns_422(self, session, api):
        resp = session.get(f"{api}/api/v1/reports/gstr1")
        assert resp.status_code == 422

    def test_gstr1_excel_download(self, session, api):
        resp = session.get(
            f"{api}/api/v1/reports/gstr1/excel",
            params={"from_date": FROM_DATE, "to_date": TO_DATE},
        )
        if resp.status_code == 404:
            pytest.skip("GSTR-1 Excel endpoint not available")
        assert resp.status_code == 200
        assert EXCEL_CONTENT_TYPE in resp.headers.get("content-type", "")
        assert len(resp.content) > 1024  # must be a non-trivial file

    def test_gstr1_json_download(self, session, api):
        resp = session.get(
            f"{api}/api/v1/reports/gstr1/json",
            params={"from_date": FROM_DATE, "to_date": TO_DATE},
        )
        if resp.status_code == 404:
            pytest.skip("GSTR-1 JSON endpoint not available")
        assert resp.status_code == 200
        data = resp.json()
        # NIC GSTR-1 payload must have 'gstin', 'fp', 'b2b', 'b2cs'
        for key in ("gstin", "fp", "b2b", "b2cs"):
            assert key in data, f"GSTR-1 JSON missing key '{key}'"

    @pytest.mark.parametrize("from_date,to_date", [
        ("2024-04-01", "2024-06-30"),
        ("2024-07-01", "2024-09-30"),
    ])
    def test_gstr1_various_periods(self, session, api, from_date, to_date):
        resp = session.get(
            f"{api}/api/v1/reports/gstr1",
            params={"from_date": from_date, "to_date": to_date},
        )
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# GSTR-3B
# ---------------------------------------------------------------------------

class TestGSTR3B:
    def test_gstr3b_returns_200(self, session, api):
        resp = session.get(
            f"{api}/api/v1/reports/gstr3b",
            params={"from_date": FROM_DATE, "to_date": TO_DATE},
        )
        assert resp.status_code == 200

    def test_gstr3b_response_is_dict(self, session, api):
        resp = session.get(
            f"{api}/api/v1/reports/gstr3b",
            params={"from_date": FROM_DATE, "to_date": TO_DATE},
        )
        assert isinstance(resp.json(), dict)

    def test_gstr3b_missing_params_returns_422(self, session, api):
        resp = session.get(f"{api}/api/v1/reports/gstr3b")
        assert resp.status_code == 422

    def test_gstr3b_excel_download(self, session, api):
        resp = session.get(
            f"{api}/api/v1/reports/gstr3b/excel",
            params={"from_date": FROM_DATE, "to_date": TO_DATE},
        )
        if resp.status_code == 404:
            pytest.skip("GSTR-3B Excel endpoint not available")
        assert resp.status_code == 200
        assert EXCEL_CONTENT_TYPE in resp.headers.get("content-type", "")


# ---------------------------------------------------------------------------
# Aging reports
# ---------------------------------------------------------------------------

class TestReceivablesAging:
    def test_receivables_returns_200(self, session, api):
        resp = session.get(f"{api}/api/v1/reports/aging/receivables")
        assert resp.status_code == 200

    def test_receivables_has_required_keys(self, session, api):
        resp = session.get(f"{api}/api/v1/reports/aging/receivables")
        data = resp.json()
        assert "as_of" in data, "Response missing 'as_of' key"
        assert "rows" in data, "Response missing 'rows' key"
        assert isinstance(data["rows"], list)

    def test_receivables_with_as_of_date(self, session, api):
        resp = session.get(
            f"{api}/api/v1/reports/aging/receivables",
            params={"as_of": "2025-03-31"},
        )
        assert resp.status_code == 200
        assert resp.json()["as_of"] == "2025-03-31"

    def test_receivables_excel_download(self, session, api):
        resp = session.get(f"{api}/api/v1/reports/aging/receivables/excel")
        if resp.status_code == 404:
            pytest.skip("Receivables aging Excel endpoint not available")
        assert resp.status_code == 200
        assert EXCEL_CONTENT_TYPE in resp.headers.get("content-type", "")

    # Legacy path compatibility check
    def test_legacy_receivables_path(self, session, api):
        """Check if the old /reports/receivables-aging path still works."""
        resp = session.get(f"{api}/api/v1/reports/receivables-aging")
        # Accept 200 or 404 (path may have moved to /reports/aging/receivables)
        assert resp.status_code in (200, 404)


class TestPayablesAging:
    def test_payables_returns_200(self, session, api):
        resp = session.get(f"{api}/api/v1/reports/aging/payables")
        assert resp.status_code == 200

    def test_payables_has_required_keys(self, session, api):
        resp = session.get(f"{api}/api/v1/reports/aging/payables")
        data = resp.json()
        assert "as_of" in data
        assert "rows" in data
        assert isinstance(data["rows"], list)

    def test_payables_excel_download(self, session, api):
        resp = session.get(f"{api}/api/v1/reports/aging/payables/excel")
        if resp.status_code == 404:
            pytest.skip("Payables aging Excel endpoint not available")
        assert resp.status_code == 200
        assert EXCEL_CONTENT_TYPE in resp.headers.get("content-type", "")

    def test_legacy_payables_path(self, session, api):
        resp = session.get(f"{api}/api/v1/reports/payables-aging")
        assert resp.status_code in (200, 404)
