from fastapi import APIRouter, Depends, HTTPException, Response
from uuid import UUID
from pydantic import BaseModel
from typing import Optional
from datetime import date
from app.auth import get_current_user, require_roles
from app.db.client import get_db
from app.utils import jsonify

router = APIRouter(prefix="/delivery-challans", tags=["Delivery Challans"])


class DCItemIn(BaseModel):
    product_id: Optional[UUID] = None
    description: str
    hsn_code: Optional[str] = None
    uom: str = "NOS"
    qty: float


class DCIn(BaseModel):
    company_id: UUID
    so_id: Optional[UUID] = None
    date: date
    vehicle_no: Optional[str] = None
    transporter_name: Optional[str] = None
    notes: Optional[str] = None
    items: list[DCItemIn]


@router.get("/")
async def list_dcs(user: dict = Depends(require_roles("admin", "sales", "accounts", "dispatch"))):
    db = get_db()
    return db.table("delivery_challans").select(
        "*, companies(name), sales_orders!so_id(so_no)"
    ).order("created_at", desc=True).execute().data


@router.get("/{dc_id}")
async def get_dc(dc_id: UUID, user: dict = Depends(get_current_user)):
    db = get_db()
    result = db.table("delivery_challans").select(
        "*, companies(*), sales_orders!so_id(so_no), dc_items(*, products(name))"
    ).eq("id", str(dc_id)).execute()
    if not result.data:
        raise HTTPException(404, "Delivery challan not found")
    return result.data[0]


@router.post("/", status_code=201)
async def create_dc(
    payload: DCIn,
    user: dict = Depends(require_roles("admin", "sales", "accounts", "dispatch")),
):
    db = get_db()
    dc_data = {
        **payload.model_dump(exclude={"items"}),
        "company_id": str(payload.company_id),
        "so_id": str(payload.so_id) if payload.so_id else None,
        "date": str(payload.date),
        "created_by": user["id"],
    }
    result = db.table("delivery_challans").insert(jsonify(dc_data)).execute()
    dc = result.data[0]

    for item in payload.items:
        item_data = item.model_dump()
        item_data["dc_id"] = dc["id"]
        if item_data.get("product_id"):
            item_data["product_id"] = str(item_data["product_id"])
        db.table("dc_items").insert(jsonify(item_data)).execute()

    return await get_dc(dc["id"], user)


@router.put("/{dc_id}")
async def update_dc(
    dc_id: UUID,
    payload: DCIn,
    user: dict = Depends(require_roles("admin", "sales", "accounts")),
):
    db = get_db()
    dc = db.table("delivery_challans").select("status").eq("id", str(dc_id)).single().execute().data
    if not dc:
        raise HTTPException(404, "Delivery challan not found")
    if dc["status"] == "dispatched":
        raise HTTPException(400, "Cannot edit a dispatched challan")

    update_data = {
        **payload.model_dump(exclude={"items"}),
        "company_id": str(payload.company_id),
        "so_id": str(payload.so_id) if payload.so_id else None,
        "date": str(payload.date),
    }
    db.table("delivery_challans").update(jsonify(update_data)).eq("id", str(dc_id)).execute()
    db.table("dc_items").delete().eq("dc_id", str(dc_id)).execute()

    for item in payload.items:
        item_data = item.model_dump()
        item_data["dc_id"] = str(dc_id)
        if item_data.get("product_id"):
            item_data["product_id"] = str(item_data["product_id"])
        db.table("dc_items").insert(jsonify(item_data)).execute()

    return await get_dc(dc_id, user)


@router.patch("/{dc_id}/dispatch")
async def dispatch_dc(dc_id: UUID, user: dict = Depends(require_roles("admin", "sales", "accounts", "dispatch"))):
    db = get_db()
    db.table("delivery_challans").update({"status": "dispatched"}).eq("id", str(dc_id)).execute()
    return {"status": "dispatched"}


@router.patch("/{dc_id}/cancel")
async def cancel_dc(dc_id: UUID, user: dict = Depends(require_roles("admin", "accounts"))):
    db = get_db()
    db.table("delivery_challans").update({"status": "cancelled"}).eq("id", str(dc_id)).execute()
    return {"status": "cancelled"}


@router.get("/{dc_id}/pdf")
async def download_pdf(dc_id: UUID, user: dict = Depends(get_current_user)):
    from app.services.dc_pdf import generate_dc_pdf
    db = get_db()
    dc = await get_dc(dc_id, user)
    cs = db.table("company_settings").select("*").limit(1).execute().data
    settings = cs[0] if cs else {}
    pdf = generate_dc_pdf(dc, settings)
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f"attachment; filename=DC-{dc['dc_no']}.pdf"})
