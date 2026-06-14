from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from uuid import UUID
from decimal import Decimal
from app.auth import get_current_user, require_roles
from app.db.client import get_db
from app.models.quotation import QuotationIn, QuotationOut
from app.utils import jsonify
from app.services.quotation_pdf import generate_quotation_pdf

router = APIRouter(prefix="/quotations", tags=["Quotations"])


def _calc_totals(items: list[dict]) -> dict:
    taxable = sum(Decimal(str(i["qty"])) * Decimal(str(i["rate"])) for i in items)
    gst = sum(
        Decimal(str(i["qty"])) * Decimal(str(i["rate"])) * Decimal(str(i["gst_rate"])) / 100
        for i in items
    )
    return {"taxable_amt": taxable, "total_gst": gst, "total": taxable + gst}


@router.get("/")
async def list_quotations(user: dict = Depends(get_current_user)):
    db = get_db()
    result = db.table("quotations").select("*, companies(name), quotation_items(*)").order("created_at", desc=True).execute()
    return result.data


@router.get("/{quotation_id}")
async def get_quotation(quotation_id: UUID, user: dict = Depends(get_current_user)):
    db = get_db()
    result = db.table("quotations").select("*, companies(*), quotation_items(*)").eq("id", str(quotation_id)).single().execute()
    if not result.data:
        raise HTTPException(404, "Quotation not found")
    return result.data


@router.post("/", status_code=201)
async def create_quotation(
    payload: QuotationIn,
    user: dict = Depends(require_roles("admin", "sales")),
):
    db = get_db()
    items = [i.model_dump() for i in payload.items]
    totals = _calc_totals(items)

    quot_data = {
        **payload.model_dump(exclude={"items"}),
        **totals,
        "created_by": user["id"],
        "company_id": str(payload.company_id),
    }
    # Convert date fields to strings
    quot_data["date"] = str(quot_data["date"])
    if quot_data.get("valid_until"):
        quot_data["valid_until"] = str(quot_data["valid_until"])

    result = db.table("quotations").insert(jsonify(quot_data)).execute()
    quot = result.data[0]

    for item in items:
        item["quotation_id"] = quot["id"]
        if item.get("product_id"):
            item["product_id"] = str(item["product_id"])
    if items:
        db.table("quotation_items").insert(jsonify(items)).execute()

    return await get_quotation(quot["id"], user)


@router.put("/{quotation_id}")
async def update_quotation(
    quotation_id: UUID,
    payload: QuotationIn,
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
    if payload.valid_until:
        update_data["valid_until"] = str(payload.valid_until)

    db.table("quotations").update(jsonify(update_data)).eq("id", str(quotation_id)).execute()
    db.table("quotation_items").delete().eq("quotation_id", str(quotation_id)).execute()

    for item in items:
        item["quotation_id"] = str(quotation_id)
        if item.get("product_id"):
            item["product_id"] = str(item["product_id"])
    if items:
        db.table("quotation_items").insert(jsonify(items)).execute()

    return await get_quotation(quotation_id, user)


@router.delete("/{quotation_id}", status_code=204)
async def delete_quotation(
    quotation_id: UUID,
    user: dict = Depends(require_roles("admin")),
):
    db = get_db()
    db.table("quotations").delete().eq("id", str(quotation_id)).execute()


@router.post("/{quotation_id}/convert-to-so", status_code=201)
async def convert_to_so(
    quotation_id: UUID,
    user: dict = Depends(require_roles("admin", "sales")),
):
    """Convert accepted quotation to Sales Order."""
    db = get_db()
    result = db.table("quotations").select("*, quotation_items(*)").eq("id", str(quotation_id)).single().execute()
    quot = result.data
    if not quot:
        raise HTTPException(404, "Quotation not found")
    if quot["status"] not in ("accepted", "sent"):
        raise HTTPException(400, f"Cannot convert quotation in status '{quot['status']}'")

    so_data = {
        "quotation_id": str(quotation_id),
        "company_id": quot["company_id"],
        "date": quot["date"],
        "taxable_amt": quot["taxable_amt"],
        "total_gst": quot["total_gst"],
        "total": quot["total"],
        "created_by": user["id"],
    }
    so_result = db.table("sales_orders").insert(so_data).execute()
    so = so_result.data[0]

    so_items = [
        {
            "so_id": so["id"],
            "product_id": item.get("product_id"),
            "description": item["description"],
            "hsn_code": item["hsn_code"],
            "uom": item["uom"],
            "qty": item["qty"],
            "rate": item["rate"],
            "gst_rate": item["gst_rate"],
            "sort_order": item.get("sort_order", 0),
        }
        for item in quot["quotation_items"]
    ]
    if so_items:
        db.table("so_items").insert(so_items).execute()

    db.table("quotations").update({"status": "accepted"}).eq("id", str(quotation_id)).execute()
    return {"so_id": so["id"], "so_no": so["so_no"]}


@router.get("/{quotation_id}/pdf")
async def download_quotation_pdf(
    quotation_id: UUID,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    result = db.table("quotations").select("*, companies(*), quotation_items(*)").eq("id", str(quotation_id)).single().execute()
    if not result.data:
        raise HTTPException(404, "Quotation not found")
    pdf_bytes = generate_quotation_pdf(result.data)
    filename = f"{result.data['quot_no']}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
