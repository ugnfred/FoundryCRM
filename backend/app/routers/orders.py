from fastapi import APIRouter, Depends, HTTPException
from uuid import UUID
from decimal import Decimal
from app.auth import get_current_user, require_roles
from app.db.client import get_db
from app.models.sales_order import SOIn
from app.utils import jsonify

router = APIRouter(prefix="/orders", tags=["Sales Orders"])


def _calc_totals(items: list[dict]) -> dict:
    taxable = sum(Decimal(str(i["qty"])) * Decimal(str(i["rate"])) for i in items)
    gst = sum(
        Decimal(str(i["qty"])) * Decimal(str(i["rate"])) * Decimal(str(i["gst_rate"])) / 100
        for i in items
    )
    return {"taxable_amt": taxable, "total_gst": gst, "total": taxable + gst}


@router.get("/")
async def list_orders(user: dict = Depends(get_current_user)):
    db = get_db()
    return db.table("sales_orders").select("*, companies(name), so_items(*), invoices!so_id(id, inv_no, status, total)").order("created_at", desc=True).execute().data


@router.get("/{so_id}")
async def get_order(so_id: UUID, user: dict = Depends(get_current_user)):
    db = get_db()
    result = db.table("sales_orders").select("*, companies(*), so_items(*, products(name))").eq("id", str(so_id)).single().execute()
    if not result.data:
        raise HTTPException(404, "Sales order not found")
    return result.data


@router.post("/", status_code=201)
async def create_order(
    payload: SOIn,
    user: dict = Depends(require_roles("admin", "sales")),
):
    db = get_db()
    items = [i.model_dump() for i in payload.items]
    totals = _calc_totals(items)

    so_data = {
        **payload.model_dump(exclude={"items"}),
        **totals,
        "created_by": user["id"],
        "company_id": str(payload.company_id),
        "date": str(payload.date),
    }
    if payload.quotation_id:
        so_data["quotation_id"] = str(payload.quotation_id)
    if payload.delivery_date:
        so_data["delivery_date"] = str(payload.delivery_date)

    result = db.table("sales_orders").insert(jsonify(so_data)).execute()
    so = result.data[0]

    for item in items:
        item["so_id"] = so["id"]
        if item.get("product_id"):
            item["product_id"] = str(item["product_id"])
    if items:
        db.table("so_items").insert(jsonify(items)).execute()

    return await get_order(so["id"], user)


@router.put("/{so_id}")
async def update_order(
    so_id: UUID,
    payload: SOIn,
    user: dict = Depends(require_roles("admin", "sales")),
):
    db = get_db()
    items = [i.model_dump() for i in payload.items]
    totals = _calc_totals(items)

    update_data = {
        **payload.model_dump(exclude={"items"}),
        **totals,
        "company_id": str(payload.company_id),
        "date": str(payload.date),
    }
    for field in ("date", "delivery_date"):
        if update_data.get(field) is not None:
            update_data[field] = str(update_data[field])
    db.table("sales_orders").update(jsonify(update_data)).eq("id", str(so_id)).execute()
    db.table("so_items").delete().eq("so_id", str(so_id)).execute()

    for item in items:
        item["so_id"] = str(so_id)
        if item.get("product_id"):
            item["product_id"] = str(item["product_id"])
    if items:
        db.table("so_items").insert(jsonify(items)).execute()

    return await get_order(so_id, user)


@router.get("/{so_id}/invoice-prefill")
async def get_invoice_prefill(
    so_id: UUID,
    user: dict = Depends(require_roles("admin", "sales", "accounts")),
):
    """Return SO data shaped for pre-filling the invoice form."""
    db = get_db()
    so = db.table("sales_orders").select("*, companies(state_code), so_items(*)").eq("id", str(so_id)).single().execute().data
    if not so:
        raise HTTPException(404, "Sales order not found")

    items = [
        {
            "product_id": item.get("product_id"),
            "description": item["description"],
            "hsn_code": item["hsn_code"],
            "uom": item["uom"],
            "qty": float(item["qty"]),
            "rate": float(item["rate"]),
            "gst_rate": float(item["gst_rate"]),
            "sort_order": item.get("sort_order", 0),
        }
        for item in so.get("so_items", [])
    ]
    return {
        "so_id": str(so_id),
        "so_no": so["so_no"],
        "company_id": so["company_id"],
        "place_of_supply": (so.get("companies") or {}).get("state_code", "27"),
        "items": items,
    }
