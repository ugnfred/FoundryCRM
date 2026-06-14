from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from uuid import UUID
from decimal import Decimal
from app.auth import get_current_user, require_roles
from app.db.client import get_db
from app.models.credit_note import CreditNoteIn
from app.utils import jsonify
from app.routers.invoices import _calc_gst
from app.services.credit_note_pdf import generate_credit_note_pdf

router = APIRouter(prefix="/credit-notes", tags=["Credit Notes"])


@router.get("/")
async def list_credit_notes(user: dict = Depends(get_current_user)):
    db = get_db()
    return (
        db.table("credit_notes")
        .select("*, companies(name), invoices!invoice_id(inv_no)")
        .order("created_at", desc=True)
        .execute()
        .data
    )


@router.get("/{cn_id}")
async def get_credit_note(cn_id: UUID, user: dict = Depends(get_current_user)):
    db = get_db()
    result = (
        db.table("credit_notes")
        .select("*, companies(*), invoices!invoice_id(id, inv_no, balance_due, total), credit_note_items(*)")
        .eq("id", str(cn_id))
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(404, "Credit note not found")
    return result.data


@router.post("/", status_code=201)
async def create_credit_note(
    payload: CreditNoteIn,
    user: dict = Depends(require_roles("admin", "accounts")),
):
    db = get_db()
    items = [i.model_dump() for i in payload.items]
    calc = _calc_gst(items, payload.place_of_supply)

    # Validate: CN total must not exceed linked invoice total
    if payload.invoice_id:
        inv = db.table("invoices").select("total, balance_due, status").eq("id", str(payload.invoice_id)).single().execute().data
        if not inv:
            raise HTTPException(404, "Linked invoice not found")
        if inv["status"] == "cancelled":
            raise HTTPException(400, "Cannot issue CN against a cancelled invoice")

    cn_data = {
        "invoice_id": str(payload.invoice_id) if payload.invoice_id else None,
        "company_id": str(payload.company_id),
        "date": str(payload.date),
        "reason": payload.reason,
        "place_of_supply": payload.place_of_supply,
        "taxable_amt": float(calc["taxable_amt"]),
        "cgst_amt": float(calc["cgst"]),
        "sgst_amt": float(calc["sgst"]),
        "igst_amt": float(calc["igst"]),
        "total_gst": float(calc["cgst"] + calc["sgst"] + calc["igst"]),
        "total": float(calc["total"]),
        "status": "draft",
        "created_by": user["id"],
    }
    cn_result = db.table("credit_notes").insert(jsonify(cn_data)).execute()
    cn = cn_result.data[0]

    # Insert items with enriched GST breakdown
    item_rows = []
    for item, enriched in zip(items, calc["enriched_items"]):
        qty = Decimal(str(item["qty"]))
        rate = Decimal(str(item["rate"]))
        taxable = qty * rate
        total = taxable + enriched["cgst_amt"] + enriched["sgst_amt"] + enriched["igst_amt"]
        item_rows.append({
            "cn_id": cn["id"],
            "product_id": str(item["product_id"]) if item.get("product_id") else None,
            "description": item["description"],
            "hsn_code": item.get("hsn_code"),
            "uom": item.get("uom"),
            "qty": float(qty),
            "rate": float(rate),
            "gst_rate": float(item["gst_rate"]),
            "taxable_amt": float(taxable),
            "cgst_amt": float(enriched["cgst_amt"]),
            "sgst_amt": float(enriched["sgst_amt"]),
            "igst_amt": float(enriched["igst_amt"]),
            "total": float(total),
            "sort_order": item.get("sort_order", 0),
        })
    if item_rows:
        db.table("credit_note_items").insert(jsonify(item_rows)).execute()

    return await get_credit_note(cn["id"], user)


@router.post("/{cn_id}/issue")
async def issue_credit_note(
    cn_id: UUID,
    user: dict = Depends(require_roles("admin", "accounts")),
):
    """Issue a draft CN: update invoice balance_due and post to customer_ledger."""
    db = get_db()
    cn = db.table("credit_notes").select("*").eq("id", str(cn_id)).single().execute().data
    if not cn:
        raise HTTPException(404, "Credit note not found")
    if cn["status"] != "draft":
        raise HTTPException(400, f"CN is already {cn['status']}")

    cn_total = Decimal(str(cn["total"]))

    # Reduce linked invoice balance_due (if linked)
    if cn.get("invoice_id"):
        inv = db.table("invoices").select("balance_due, status").eq("id", cn["invoice_id"]).single().execute().data
        if inv:
            new_balance = max(Decimal("0"), Decimal(str(inv["balance_due"])) - cn_total)
            new_status = "paid" if new_balance == 0 else inv["status"]
            db.table("invoices").update({"balance_due": float(new_balance), "status": new_status}).eq("id", cn["invoice_id"]).execute()

    # Post credit entry to customer_ledger
    db.table("customer_ledger").insert({
        "company_id": cn["company_id"],
        "doc_type": "cn",
        "doc_id": str(cn_id),
        "doc_no": cn["cn_no"],
        "doc_date": cn["date"],
        "credit": float(cn_total),
        "notes": cn.get("reason"),
    }).execute()

    # Mark CN as issued
    db.table("credit_notes").update({"status": "issued"}).eq("id", str(cn_id)).execute()
    return await get_credit_note(cn_id, user)


@router.post("/{cn_id}/cancel")
async def cancel_credit_note(
    cn_id: UUID,
    user: dict = Depends(require_roles("admin")),
):
    db = get_db()
    cn = db.table("credit_notes").select("*").eq("id", str(cn_id)).single().execute().data
    if not cn:
        raise HTTPException(404, "Credit note not found")
    if cn["status"] == "cancelled":
        raise HTTPException(400, "CN is already cancelled")

    # If issued, reverse the invoice balance and ledger
    if cn["status"] == "issued" and cn.get("invoice_id"):
        inv = db.table("invoices").select("balance_due, total, status").eq("id", cn["invoice_id"]).single().execute().data
        if inv:
            restored = Decimal(str(inv["balance_due"])) + Decimal(str(cn["total"]))
            restored = min(restored, Decimal(str(inv["total"])))
            db.table("invoices").update({"balance_due": float(restored), "status": "sent"}).eq("id", cn["invoice_id"]).execute()
        # Remove ledger entry
        db.table("customer_ledger").delete().eq("doc_id", str(cn_id)).eq("doc_type", "cn").execute()

    db.table("credit_notes").update({"status": "cancelled"}).eq("id", str(cn_id)).execute()
    return {"status": "cancelled"}


@router.get("/{cn_id}/pdf")
async def download_cn_pdf(cn_id: UUID, user: dict = Depends(get_current_user)):
    db = get_db()
    result = (
        db.table("credit_notes")
        .select("*, companies(*), invoices!invoice_id(inv_no), credit_note_items(*)")
        .eq("id", str(cn_id))
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(404, "Credit note not found")
    pdf_bytes = generate_credit_note_pdf(result.data)
    filename = f"{result.data.get('cn_no', cn_id)}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
