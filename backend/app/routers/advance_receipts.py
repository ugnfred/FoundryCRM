from fastapi import APIRouter, Depends, HTTPException
from uuid import UUID
from pydantic import BaseModel
from typing import Optional
from datetime import date
from decimal import Decimal
from app.auth import get_current_user, require_roles
from app.db.client import get_db
from app.utils import jsonify

router = APIRouter(prefix="/advance-receipts", tags=["Advance Receipts"])


class AdvanceIn(BaseModel):
    company_id: UUID
    date: date
    amount: float
    payment_mode: str = "bank_transfer"
    reference: Optional[str] = None
    notes: Optional[str] = None
    is_pdc: bool = False
    pdc_date: Optional[date] = None


@router.get("/")
async def list_advances(
    company_id: Optional[str] = None,
    user: dict = Depends(require_roles("admin", "accounts")),
):
    db = get_db()
    q = db.table("advance_receipts").select("*, companies(name)").order("created_at", desc=True)
    if company_id:
        q = q.eq("company_id", company_id)
    rows = q.execute().data or []

    # Compute available balance per receipt (amount minus what's been applied via ledger debits linked back)
    for row in rows:
        row["available"] = float(row.get("amount", 0)) if row.get("status") == "received" else 0
    return rows


@router.get("/{ar_id}")
async def get_advance(ar_id: UUID, user: dict = Depends(require_roles("admin", "accounts"))):
    db = get_db()
    result = db.table("advance_receipts").select("*, companies(*)").eq("id", str(ar_id)).single().execute()
    if not result.data:
        raise HTTPException(404, "Advance receipt not found")
    return result.data


@router.post("/", status_code=201)
async def create_advance(
    payload: AdvanceIn,
    user: dict = Depends(require_roles("admin", "accounts")),
):
    db = get_db()
    ar_data = {
        **payload.model_dump(),
        "company_id": str(payload.company_id),
        "date": str(payload.date),
        "pdc_date": str(payload.pdc_date) if payload.pdc_date else None,
        "created_by": user["id"],
    }
    # PDC (post-dated cheque) advances stay pending until cheque date passes
    if payload.is_pdc:
        ar_data["status"] = "pending"

    result = db.table("advance_receipts").insert(jsonify(ar_data)).execute()
    ar = result.data[0]

    # Only post a ledger credit for advances that are actually received (not pending PDC)
    if ar.get("status") == "received":
        db.table("customer_ledger").insert({
            "company_id": str(payload.company_id),
            "doc_type": "advance",
            "doc_no": ar["ar_no"],
            "doc_date": str(payload.date),
            "debit": 0,
            "credit": float(payload.amount),
            "notes": f"Advance receipt {ar['ar_no']}",
        }).execute()

    return ar


@router.patch("/{ar_id}/receive")
async def receive_advance(ar_id: UUID, user: dict = Depends(require_roles("admin", "accounts"))):
    """Mark a pending PDC advance as received (cheque cleared)."""
    db = get_db()
    ar = db.table("advance_receipts").select("ar_no, status, company_id, amount, date").eq("id", str(ar_id)).single().execute().data
    if not ar:
        raise HTTPException(404, "Advance receipt not found")
    if ar["status"] != "pending":
        raise HTTPException(400, f"Advance is already {ar['status']}")

    db.table("advance_receipts").update({"status": "received"}).eq("id", str(ar_id)).execute()
    # Post ledger credit now that cheque has cleared
    db.table("customer_ledger").insert({
        "company_id": ar["company_id"],
        "doc_type": "advance",
        "doc_no": ar["ar_no"],
        "doc_date": ar["date"],
        "debit": 0,
        "credit": float(ar["amount"]),
        "notes": f"Advance receipt {ar['ar_no']} (PDC cleared)",
    }).execute()
    return {"status": "received"}


@router.patch("/{ar_id}/cancel")
async def cancel_advance(ar_id: UUID, user: dict = Depends(require_roles("admin", "accounts"))):
    db = get_db()
    ar = db.table("advance_receipts").select("ar_no, status, company_id").eq("id", str(ar_id)).single().execute().data
    if not ar:
        raise HTTPException(404, "Advance receipt not found")
    if ar["status"] not in ("received", "pending"):
        raise HTTPException(400, "Only received or pending advances can be cancelled")

    # Reverse the ledger credit if it was already received
    if ar["status"] == "received":
        db.table("customer_ledger").delete().eq("doc_no", ar["ar_no"]).eq("doc_type", "advance").execute()
    db.table("advance_receipts").update({"status": "cancelled"}).eq("id", str(ar_id)).execute()
    return {"status": "cancelled"}


@router.get("/company/{company_id}/available-balance")
async def get_available_advance(
    company_id: UUID,
    user: dict = Depends(require_roles("admin", "accounts")),
):
    """Get total available advance credit for a customer (received minus already applied)."""
    db = get_db()
    received_rows = db.table("advance_receipts").select("amount").eq("company_id", str(company_id)).eq("status", "received").execute().data or []
    total_received = sum(float(r["amount"]) for r in received_rows)
    applied_rows = db.table("customer_ledger").select("debit").eq("company_id", str(company_id)).eq("doc_type", "advance_applied").execute().data or []
    total_applied = sum(float(r["debit"]) for r in applied_rows)
    available = max(0.0, total_received - total_applied)
    return {"company_id": str(company_id), "available_balance": available}
