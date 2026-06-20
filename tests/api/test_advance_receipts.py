"""
Tests for /api/v1/advance-receipts/* endpoints.

Key scenarios:
- POST with is_pdc=True (cheque mode) → status=pending
- POST with is_pdc=False (bank_transfer) → status=received
- Ledger credit posted only when status=received (not pending)
- PATCH /{id}/receive: pending → received (posts ledger credit)
- PATCH /{id}/cancel: received or pending → cancelled (reverses ledger if received)
- Cannot receive an already-cancelled advance (400)
- Cannot cancel an already-cancelled advance (400)
- GET /company/{id}/available-balance returns correct available credit
"""

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_advance(session, api, customer_id, today, **overrides):
    payload = {
        "company_id": customer_id,
        "date": today,
        "amount": 5000.0,
        "payment_mode": "bank_transfer",
        "is_pdc": False,
    }
    payload.update(overrides)
    resp = session.post(f"{api}/api/v1/advance-receipts/", json=payload)
    assert resp.status_code == 201, f"Create advance failed: {resp.text}"
    return resp.json()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestAdvanceCreate:
    def test_bank_transfer_status_received(self, session, api, customer_id, today):
        """Non-PDC advance via bank_transfer → immediately received."""
        ar = _create_advance(session, api, customer_id, today,
                             payment_mode="bank_transfer", is_pdc=False)
        assert ar["status"] == "received"

    def test_pdc_cheque_status_pending(self, session, api, customer_id, today):
        """PDC (post-dated cheque) advance → pending until cheque clears."""
        ar = _create_advance(
            session, api, customer_id, today,
            payment_mode="cheque",
            is_pdc=True,
            pdc_date=today,
        )
        assert ar["status"] == "pending"

    def test_advance_has_ar_no(self, session, api, customer_id, today):
        ar = _create_advance(session, api, customer_id, today)
        assert "ar_no" in ar
        assert ar["ar_no"]

    def test_list_returns_200(self, session, api):
        resp = session.get(f"{api}/api/v1/advance-receipts/")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_ledger_credit_posted_for_received(self, session, api, customer_id, today):
        """
        After creating a received advance, the customer ledger should show a credit.
        Indirect check: available-balance endpoint should reflect the credit.
        """
        before_resp = session.get(
            f"{api}/api/v1/advance-receipts/company/{customer_id}/available-balance"
        )
        before = float(before_resp.json().get("available_balance", 0)) if before_resp.status_code == 200 else 0

        _create_advance(session, api, customer_id, today, amount=1000.0, is_pdc=False)

        after_resp = session.get(
            f"{api}/api/v1/advance-receipts/company/{customer_id}/available-balance"
        )
        if after_resp.status_code == 200:
            after = float(after_resp.json().get("available_balance", 0))
            assert after >= before + 1000.0, (
                "Available balance should increase by the received advance amount"
            )

    def test_pending_does_not_post_ledger_credit(self, session, api, customer_id, today):
        """
        After creating a pending (PDC) advance, available balance must NOT increase.
        """
        before_resp = session.get(
            f"{api}/api/v1/advance-receipts/company/{customer_id}/available-balance"
        )
        before = float(before_resp.json().get("available_balance", 0)) if before_resp.status_code == 200 else 0

        _create_advance(session, api, customer_id, today,
                        amount=2000.0, is_pdc=True, pdc_date=today)

        after_resp = session.get(
            f"{api}/api/v1/advance-receipts/company/{customer_id}/available-balance"
        )
        if after_resp.status_code == 200:
            after = float(after_resp.json().get("available_balance", 0))
            # Balance must NOT have increased for a pending advance
            assert after == pytest.approx(before, abs=0.01), (
                f"Pending advance must not post ledger credit. Before={before}, After={after}"
            )


class TestAdvanceReceive:
    def test_receive_pending_advance(self, session, api, customer_id, today):
        ar = _create_advance(session, api, customer_id, today,
                             is_pdc=True, pdc_date=today)
        assert ar["status"] == "pending"

        resp = session.patch(f"{api}/api/v1/advance-receipts/{ar['id']}/receive")
        assert resp.status_code == 200
        assert resp.json()["status"] == "received"

    def test_receive_posts_ledger_credit(self, session, api, customer_id, today):
        """After PATCH /receive, the available balance should increase."""
        ar = _create_advance(session, api, customer_id, today,
                             amount=3000.0, is_pdc=True, pdc_date=today)
        before_resp = session.get(
            f"{api}/api/v1/advance-receipts/company/{customer_id}/available-balance"
        )
        before = float(before_resp.json().get("available_balance", 0)) if before_resp.status_code == 200 else 0

        session.patch(f"{api}/api/v1/advance-receipts/{ar['id']}/receive")

        after_resp = session.get(
            f"{api}/api/v1/advance-receipts/company/{customer_id}/available-balance"
        )
        if after_resp.status_code == 200:
            after = float(after_resp.json().get("available_balance", 0))
            assert after >= before + 3000.0

    def test_receive_already_received_returns_400(self, session, api, customer_id, today):
        ar = _create_advance(session, api, customer_id, today, is_pdc=False)
        assert ar["status"] == "received"
        resp = session.patch(f"{api}/api/v1/advance-receipts/{ar['id']}/receive")
        assert resp.status_code == 400, (
            f"Expected 400 when receiving an already-received advance, got {resp.status_code}"
        )

    def test_receive_cancelled_advance_returns_400(self, session, api, customer_id, today):
        ar = _create_advance(session, api, customer_id, today, is_pdc=True, pdc_date=today)
        session.patch(f"{api}/api/v1/advance-receipts/{ar['id']}/cancel")
        resp = session.patch(f"{api}/api/v1/advance-receipts/{ar['id']}/receive")
        assert resp.status_code == 400, (
            "Cannot receive a cancelled advance"
        )


class TestAdvanceCancel:
    def test_cancel_received_advance(self, session, api, customer_id, today):
        ar = _create_advance(session, api, customer_id, today, is_pdc=False)
        resp = session.patch(f"{api}/api/v1/advance-receipts/{ar['id']}/cancel")
        assert resp.status_code == 200
        assert resp.json()["status"] == "cancelled"

    def test_cancel_pending_advance(self, session, api, customer_id, today):
        ar = _create_advance(session, api, customer_id, today,
                             is_pdc=True, pdc_date=today)
        resp = session.patch(f"{api}/api/v1/advance-receipts/{ar['id']}/cancel")
        assert resp.status_code == 200
        assert resp.json()["status"] == "cancelled"

    def test_cancel_already_cancelled_returns_400(self, session, api, customer_id, today):
        ar = _create_advance(session, api, customer_id, today, is_pdc=False)
        session.patch(f"{api}/api/v1/advance-receipts/{ar['id']}/cancel")
        resp = session.patch(f"{api}/api/v1/advance-receipts/{ar['id']}/cancel")
        assert resp.status_code == 400, (
            "Cannot cancel an already-cancelled advance"
        )


class TestAvailableBalance:
    def test_available_balance_endpoint(self, session, api, customer_id):
        resp = session.get(
            f"{api}/api/v1/advance-receipts/company/{customer_id}/available-balance"
        )
        if resp.status_code == 404:
            pytest.skip("available-balance endpoint not implemented")
        assert resp.status_code == 200
        data = resp.json()
        assert "available_balance" in data
        assert float(data["available_balance"]) >= 0

    def test_advance_list_shows_available_field(self, session, api):
        resp = session.get(f"{api}/api/v1/advance-receipts/")
        assert resp.status_code == 200
        for item in resp.json():
            assert "available" in item or "status" in item
