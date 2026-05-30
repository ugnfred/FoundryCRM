from fastapi import APIRouter, Depends, Query
from uuid import UUID
from decimal import Decimal
from pydantic import BaseModel
from typing import Literal
from app.auth import get_current_user, require_roles
from app.db.client import get_db


class StockAdjustIn(BaseModel):
    product_id: UUID
    qty: float          # positive = stock in, negative = stock out
    notes: str | None = None
    txn_type: Literal["opening", "adjustment"] = "adjustment"

router = APIRouter(prefix="/inventory", tags=["Inventory"])


@router.get("/stock")
async def get_stock_summary(user: dict = Depends(get_current_user)):
    """Current stock balance per product — 2 queries instead of N+1."""
    db = get_db()
    products = db.table("products").select("id, name, hsn_code, uom, category").eq("is_active", True).execute().data

    # Single query: all ledger entries ordered newest-first
    all_ledger = db.table("stock_ledger").select("product_id, balance").order("created_at", desc=True).execute().data

    # Keep only the first (newest) entry per product
    latest: dict[str, float] = {}
    for entry in all_ledger:
        pid = entry["product_id"]
        if pid not in latest:
            latest[pid] = entry["balance"]

    return [{**p, "balance": latest.get(p["id"], 0)} for p in products]


@router.post("/stock/adjust", status_code=201)
async def adjust_stock(
    payload: StockAdjustIn,
    user: dict = Depends(require_roles("admin")),
):
    """Manual opening stock entry or stock adjustment."""
    from app.routers.invoices import _update_stock
    db = get_db()
    _update_stock(db, str(payload.product_id), Decimal(str(payload.qty)),
                  None, payload.txn_type, user["id"])
    # Return updated balance
    last = db.table("stock_ledger").select("balance").eq("product_id", str(payload.product_id)).order("created_at", desc=True).limit(1).execute().data
    return {"balance": float(last[0]["balance"]) if last else 0.0}


@router.get("/stock/ledger/{product_id}")
async def get_stock_ledger(
    product_id: UUID,
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    user: dict = Depends(get_current_user),
):
    db = get_db()
    result = (
        db.table("stock_ledger")
        .select("*")
        .eq("product_id", str(product_id))
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return result.data
