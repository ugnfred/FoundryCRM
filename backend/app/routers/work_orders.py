from fastapi import APIRouter, Depends, HTTPException
from uuid import UUID
from pydantic import BaseModel
from typing import Optional
from datetime import date
from decimal import Decimal
from app.auth import get_current_user, require_roles
from app.db.client import get_db
from app.utils import jsonify
from app.routers.invoices import _update_stock

router = APIRouter(prefix="/work-orders", tags=["Work Orders"])


class WOIn(BaseModel):
    so_id: Optional[UUID] = None
    product_id: UUID
    bom_id: Optional[UUID] = None
    qty: float
    start_date: Optional[date] = None
    target_date: Optional[date] = None
    assigned_to: Optional[UUID] = None
    notes: Optional[str] = None


@router.get("/")
async def list_work_orders(
    status: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    q = db.table("work_orders").select(
        "*, products!product_id(name), sales_orders!so_id(so_no), bom_headers!bom_id(version)"
    ).order("created_at", desc=True)
    if status:
        q = q.eq("status", status)
    return q.execute().data or []


@router.get("/{wo_id}")
async def get_work_order(wo_id: UUID, user: dict = Depends(get_current_user)):
    db = get_db()
    result = db.table("work_orders").select(
        "*, products!product_id(name, uom), sales_orders!so_id(so_no), bom_headers!bom_id(version, bom_items(*, products!component_id(name, uom)))"
    ).eq("id", str(wo_id)).execute()
    if not result.data:
        raise HTTPException(404, "Work order not found")

    wo = result.data[0]
    # Augment BOM items with current stock on hand
    bom = wo.get("bom_headers")
    if bom and bom.get("bom_items"):
        for item in bom["bom_items"]:
            comp_id = item["component_id"]
            required = float(item["qty"]) * float(wo["qty"])
            stock = db.table("stock_ledger").select("balance").eq("product_id", comp_id).order("created_at", desc=True).limit(1).execute().data
            on_hand = float(stock[0]["balance"]) if stock else 0
            item["required_qty"] = required
            item["on_hand"] = on_hand
            item["shortage"] = max(0, required - on_hand)
    return wo


@router.post("/", status_code=201)
async def create_work_order(
    payload: WOIn,
    user: dict = Depends(require_roles("admin", "accounts")),
):
    db = get_db()
    # Auto-link active BOM if not provided
    bom_id = str(payload.bom_id) if payload.bom_id else None
    if not bom_id:
        active_bom = db.table("bom_headers").select("id").eq("product_id", str(payload.product_id)).eq("is_active", True).execute().data
        if active_bom:
            bom_id = active_bom[0]["id"]

    wo_data = {
        **payload.model_dump(),
        "product_id": str(payload.product_id),
        "so_id": str(payload.so_id) if payload.so_id else None,
        "bom_id": bom_id,
        "assigned_to": str(payload.assigned_to) if payload.assigned_to else None,
        "start_date": str(payload.start_date) if payload.start_date else None,
        "target_date": str(payload.target_date) if payload.target_date else None,
        "created_by": user["id"],
    }
    result = db.table("work_orders").insert(jsonify(wo_data)).execute()
    return await get_work_order(result.data[0]["id"], user)


@router.patch("/{wo_id}/status")
async def update_status(
    wo_id: UUID,
    status: str,
    user: dict = Depends(require_roles("admin", "accounts")),
):
    valid = {"open", "in_progress", "cancelled"}
    if status not in valid:
        raise HTTPException(400, f"Status must be one of {valid} (use /complete to complete)")
    db = get_db()
    db.table("work_orders").update({"status": status}).eq("id", str(wo_id)).execute()
    return {"status": status}


@router.post("/{wo_id}/complete")
async def complete_work_order(wo_id: UUID, user: dict = Depends(require_roles("admin", "accounts"))):
    """
    Mark WO as done:
    1. Deduct BOM components from stock (txn_type=production)
    2. Add finished product to stock (txn_type=production_output)
    3. Update status = done
    """
    db = get_db()
    wo = await get_work_order(wo_id, user)

    if wo["status"] == "done":
        raise HTTPException(400, "Work order already completed")
    if wo["status"] == "cancelled":
        raise HTTPException(400, "Cannot complete a cancelled work order")

    bom = wo.get("bom_headers")
    wo_qty = Decimal(str(wo["qty"]))

    if bom and bom.get("bom_items"):
        for item in bom["bom_items"]:
            comp_id = item["component_id"]
            deduct_qty = Decimal(str(item["qty"])) * wo_qty
            # Check stock
            stock = db.table("stock_ledger").select("balance").eq("product_id", comp_id).order("created_at", desc=True).limit(1).execute().data
            on_hand = Decimal(str(stock[0]["balance"])) if stock else Decimal("0")
            if on_hand < deduct_qty:
                comp_name = item.get("products", {}).get("name", comp_id)
                raise HTTPException(400, f"Insufficient stock for {comp_name}: need {float(deduct_qty):.3f}, have {float(on_hand):.3f}")
            # Deduct component stock
            _update_stock(db, comp_id, -deduct_qty, str(wo_id), "production", user["id"])

    # Add finished product to stock
    _update_stock(db, str(wo["product_id"]), wo_qty, str(wo_id), "production_output", user["id"])

    db.table("work_orders").update({"status": "done"}).eq("id", str(wo_id)).execute()
    return {"status": "done", "wo_no": wo["wo_no"]}
