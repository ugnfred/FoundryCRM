from fastapi import APIRouter, Depends, HTTPException, Response
from uuid import UUID
from pydantic import BaseModel
from typing import Optional
from datetime import date
from decimal import Decimal
from app.auth import get_current_user, require_roles
from app.db.client import get_db
from app.utils import jsonify
from app.routers.invoices import _calc_gst

router = APIRouter(prefix="/proforma", tags=["Proforma Invoices"])


class PIItemIn(BaseModel):
    product_id: Optional[UUID] = None
    description: str
    hsn_code: Optional[str] = None
    uom: str = "NOS"
    qty: float
    rate: float
    gst_rate: float = 18


class ProformaIn(BaseModel):
    company_id: UUID
    so_id: Optional[UUID] = None
    date: date
    validity_date: Optional[date] = None
    place_of_supply: str = "27"
    notes: Optional[str] = None
    items: list[PIItemIn]


@router.get("/")
async def list_proforma(user: dict = Depends(require_roles("admin", "sales", "accounts"))):
    db = get_db()
    return db.table("proforma_invoices").select(
        "*, companies(name), sales_orders!so_id(so_no)"
    ).order("created_at", desc=True).execute().data


@router.get("/{pi_id}")
async def get_proforma(pi_id: UUID, user: dict = Depends(require_roles("admin", "sales", "accounts"))):
    db = get_db()
    result = db.table("proforma_invoices").select(
        "*, companies(*), sales_orders!so_id(so_no), proforma_items(*, products(name)), invoices!converted_invoice_id(inv_no)"
    ).eq("id", str(pi_id)).execute()
    if not result.data:
        raise HTTPException(404, "Proforma invoice not found")
    return result.data[0]


@router.post("/", status_code=201)
async def create_proforma(
    payload: ProformaIn,
    user: dict = Depends(require_roles("admin", "sales", "accounts")),
):
    db = get_db()
    items = [i.model_dump() for i in payload.items]
    calc = _calc_gst(items, payload.place_of_supply)

    pi_data = {
        **payload.model_dump(exclude={"items"}),
        "taxable_amt": calc["taxable_amt"],
        "cgst": calc["cgst"],
        "sgst": calc["sgst"],
        "igst": calc["igst"],
        "total": calc["total"],
        "created_by": user["id"],
        "company_id": str(payload.company_id),
        "date": str(payload.date),
        "validity_date": str(payload.validity_date) if payload.validity_date else None,
        "so_id": str(payload.so_id) if payload.so_id else None,
    }
    result = db.table("proforma_invoices").insert(jsonify(pi_data)).execute()
    pi = result.data[0]

    for item in calc["enriched_items"]:
        item["pi_id"] = pi["id"]
        if item.get("product_id"):
            item["product_id"] = str(item["product_id"])
        item.pop("amount", None)
    if calc["enriched_items"]:
        db.table("proforma_items").insert(jsonify(calc["enriched_items"])).execute()

    return await get_proforma(pi["id"], user)


@router.put("/{pi_id}")
async def update_proforma(
    pi_id: UUID,
    payload: ProformaIn,
    user: dict = Depends(require_roles("admin", "sales", "accounts")),
):
    db = get_db()
    pi = db.table("proforma_invoices").select("status").eq("id", str(pi_id)).single().execute().data
    if not pi:
        raise HTTPException(404, "Proforma not found")
    if pi["status"] == "converted":
        raise HTTPException(400, "Cannot edit a converted proforma invoice")

    items = [i.model_dump() for i in payload.items]
    calc = _calc_gst(items, payload.place_of_supply)

    update_data = {
        **payload.model_dump(exclude={"items"}),
        "taxable_amt": calc["taxable_amt"],
        "cgst": calc["cgst"],
        "sgst": calc["sgst"],
        "igst": calc["igst"],
        "total": calc["total"],
        "company_id": str(payload.company_id),
        "date": str(payload.date),
        "validity_date": str(payload.validity_date) if payload.validity_date else None,
        "so_id": str(payload.so_id) if payload.so_id else None,
    }
    db.table("proforma_invoices").update(jsonify(update_data)).eq("id", str(pi_id)).execute()
    db.table("proforma_items").delete().eq("pi_id", str(pi_id)).execute()

    for item in calc["enriched_items"]:
        item["pi_id"] = str(pi_id)
        if item.get("product_id"):
            item["product_id"] = str(item["product_id"])
        item.pop("amount", None)
    if calc["enriched_items"]:
        db.table("proforma_items").insert(jsonify(calc["enriched_items"])).execute()

    return await get_proforma(pi_id, user)


@router.post("/{pi_id}/convert")
async def convert_to_invoice(
    pi_id: UUID,
    user: dict = Depends(require_roles("admin", "sales", "accounts")),
):
    """Convert a proforma invoice into a Tax Invoice."""
    db = get_db()
    pi = await get_proforma(pi_id, user)

    if pi["status"] == "converted":
        raise HTTPException(400, "Already converted to invoice")
    if pi["status"] == "cancelled":
        raise HTTPException(400, "Cannot convert a cancelled proforma")

    # Build invoice from PI data
    from app.models.invoice import InvoiceIn, InvoiceItemIn
    from app.routers.invoices import create_invoice

    items_in = []
    for idx, it in enumerate(pi.get("proforma_items", [])):
        items_in.append(InvoiceItemIn(
            product_id=it.get("product_id"),
            description=it["description"],
            hsn_code=it.get("hsn_code") or "",
            uom=it.get("uom", "NOS"),
            qty=it["qty"],
            rate=it["rate"],
            gst_rate=it["gst_rate"],
            sort_order=idx,
        ))

    inv_payload = InvoiceIn(
        company_id=pi["company_id"],
        so_id=pi.get("so_id"),
        date=pi["date"],
        place_of_supply=pi["place_of_supply"],
        items=items_in,
    )
    new_invoice = await create_invoice(inv_payload, user)
    db.table("proforma_invoices").update({
        "status": "converted",
        "converted_invoice_id": new_invoice["id"],
    }).eq("id", str(pi_id)).execute()
    return {"invoice_id": new_invoice["id"], "inv_no": new_invoice["inv_no"]}


@router.patch("/{pi_id}/status")
async def update_status(
    pi_id: UUID,
    status: str,
    user: dict = Depends(require_roles("admin", "sales", "accounts")),
):
    valid = {"draft", "sent", "cancelled"}
    if status not in valid:
        raise HTTPException(400, f"Status must be one of {valid}")
    db = get_db()
    db.table("proforma_invoices").update({"status": status}).eq("id", str(pi_id)).execute()
    return {"status": status}


@router.get("/{pi_id}/pdf")
async def download_pdf(pi_id: UUID, user: dict = Depends(get_current_user)):
    from app.services.proforma_pdf import generate_proforma_pdf
    db = get_db()
    pi = await get_proforma(pi_id, user)
    cs = db.table("company_settings").select("*").limit(1).execute().data
    settings = cs[0] if cs else {}
    pdf = generate_proforma_pdf(pi, settings)
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f"attachment; filename=PI-{pi['pi_no']}.pdf"})
