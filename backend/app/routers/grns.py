from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from uuid import UUID
from app.auth import get_current_user, require_roles
from app.db.client import get_db
from app.services.grn_pdf import generate_grn_pdf

router = APIRouter(prefix="/grns", tags=["GRNs"])


@router.get("/")
async def list_grns(user: dict = Depends(get_current_user)):
    db = get_db()
    return (
        db.table("grn")
        .select("*, purchase_orders(po_no, companies(name))")
        .order("created_at", desc=True)
        .execute()
        .data
    )


@router.get("/{grn_id}")
async def get_grn(grn_id: UUID, user: dict = Depends(get_current_user)):
    db = get_db()
    result = (
        db.table("grn")
        .select("*, purchase_orders(po_no, companies(name, address, gstin)), grn_items(*, products(name, hsn_code, uom))")
        .eq("id", str(grn_id))
        .execute()
    )
    if not result.data:
        raise HTTPException(404, "GRN not found")
    return result.data[0]


@router.get("/{grn_id}/pdf")
async def download_grn_pdf(grn_id: UUID, user: dict = Depends(get_current_user)):
    db = get_db()
    result = (
        db.table("grn")
        .select("*, purchase_orders(po_no, companies(name, address, gstin)), grn_items(*, products(name, hsn_code, uom))")
        .eq("id", str(grn_id))
        .execute()
    )
    if not result.data:
        raise HTTPException(404, "GRN not found")
    pdf_bytes = generate_grn_pdf(result.data[0])
    filename = f"{result.data[0].get('grn_no', grn_id)}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
