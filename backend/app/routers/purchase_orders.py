from fastapi import APIRouter, Depends, HTTPException
from uuid import UUID
from decimal import Decimal
from app.auth import get_current_user, require_roles
from app.db.client import get_db
from app.models.purchase_order import POIn, GRNIn
from app.utils import jsonify

router = APIRouter(prefix="/purchase-orders", tags=["Purchase Orders"])


def _calc_totals(items: list[dict]) -> dict:
    taxable = sum(Decimal(str(i["qty"])) * Decimal(str(i["rate"])) for i in items)
    gst = sum(
        Decimal(str(i["qty"])) * Decimal(str(i["rate"])) * Decimal(str(i["gst_rate"])) / 100
        for i in items
    )
    return {"taxable_amt": taxable, "total_gst": gst, "total": taxable + gst}


@router.get("/")
async def list_pos(user: dict = Depends(require_roles("admin", "accounts"))):
    db = get_db()
    return db.table("purchase_orders").select("*, companies(name), po_items(*)").order("created_at", desc=True).execute().data


@router.get("/{po_id}")
async def get_po(po_id: UUID, user: dict = Depends(require_roles("admin", "accounts"))):
    db = get_db()
    result = db.table("purchase_orders").select("*, companies(*), po_items(*, products(name))").eq("id", str(po_id)).execute()
    if not result.data:
        raise HTTPException(404, "Purchase order not found")
    return result.data[0]


@router.post("/", status_code=201)
async def create_po(
    payload: POIn,
    user: dict = Depends(require_roles("admin", "accounts")),
):
    db = get_db()
    items = [i.model_dump() for i in payload.items]
    totals = _calc_totals(items)

    po_data = {
        **payload.model_dump(exclude={"items"}),
        **totals,
        "created_by": user["id"],
        "company_id": str(payload.company_id),
        "date": str(payload.date),
    }
    if payload.delivery_date:
        po_data["delivery_date"] = str(payload.delivery_date)

    result = db.table("purchase_orders").insert(jsonify(po_data)).execute()
    po = result.data[0]

    for item in items:
        item["po_id"] = po["id"]
        if item.get("product_id"):
            item["product_id"] = str(item["product_id"])
    if items:
        db.table("po_items").insert(jsonify(items)).execute()

    return await get_po(po["id"], user)


@router.put("/{po_id}")
async def update_po(
    po_id: UUID,
    payload: POIn,
    user: dict = Depends(require_roles("admin", "accounts")),
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
    db.table("purchase_orders").update(jsonify(update_data)).eq("id", str(po_id)).execute()
    db.table("po_items").delete().eq("po_id", str(po_id)).execute()

    for item in items:
        item["po_id"] = str(po_id)
        if item.get("product_id"):
            item["product_id"] = str(item["product_id"])
    if items:
        db.table("po_items").insert(jsonify(items)).execute()

    return await get_po(po_id, user)


@router.post("/{po_id}/grn", status_code=201)
async def create_grn(
    po_id: UUID,
    payload: GRNIn,
    user: dict = Depends(require_roles("admin", "accounts")),
):
    db = get_db()
    po = db.table("purchase_orders").select("*").eq("id", str(po_id)).single().execute().data
    if not po:
        raise HTTPException(404, "PO not found")

    grn_data = {
        "po_id": str(po_id),
        "received_date": str(payload.received_date),
        "notes": payload.notes,
        "created_by": user["id"],
    }
    grn_result = db.table("grn").insert(grn_data).execute()
    grn = grn_result.data[0]
    grn_no = grn.get("grn_no", grn["id"])

    grn_items_batch = []
    for item in payload.items:
        grn_items_batch.append({
            "grn_id": grn["id"],
            "po_item_id": str(item.po_item_id),
            "product_id": str(item.product_id),
            "qty_received": item.qty_received,
            "rate": item.rate,
        })

        # Update received_qty on po_item
        po_item = db.table("po_items").select("received_qty").eq("id", str(item.po_item_id)).single().execute().data
        new_received = float(Decimal(str(po_item["received_qty"] or 0)) + Decimal(str(item.qty_received)))
        db.table("po_items").update({"received_qty": new_received}).eq("id", str(item.po_item_id)).execute()

        # Update stock ledger (GRN = stock in)
        from app.routers.invoices import _update_stock
        _update_stock(db, str(item.product_id), item.qty_received, grn["id"], "grn", user["id"])

    if grn_items_batch:
        db.table("grn_items").insert(jsonify(grn_items_batch)).execute()

    # Update PO status
    all_items = db.table("po_items").select("qty, received_qty").eq("po_id", str(po_id)).execute().data
    fully_received = all(Decimal(str(i["received_qty"] or 0)) >= Decimal(str(i["qty"])) for i in all_items)
    db.table("purchase_orders").update({"status": "received" if fully_received else "partial"}).eq("id", str(po_id)).execute()

    return {"grn_id": grn["id"], "grn_no": grn_no}
