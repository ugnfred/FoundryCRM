from fastapi import APIRouter, Depends, HTTPException
from uuid import UUID
from pydantic import BaseModel
from app.auth import require_roles
from app.db.client import get_db
from app.services.nic_client import NICClient

router = APIRouter(prefix="/einvoice", tags=["E-Invoice"])


class EWBRequest(BaseModel):
    invoice_id: UUID
    vehicle_no: str
    transporter_id: str | None = None
    distance_km: int | None = None
    mode_of_trans: str = "road"


@router.post("/generate")
async def generate_irn(
    invoice_id: UUID,
    user: dict = Depends(require_roles("admin", "accounts")),
):
    """Generate IRN via NIC API and log the result."""
    db = get_db()
    invoice = db.table("invoices").select("*, companies(*), invoice_items(*)").eq("id", str(invoice_id)).single().execute().data
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    if invoice.get("irn"):
        raise HTTPException(400, "IRN already generated for this invoice")

    nic = NICClient()
    try:
        irn_data = await nic.generate_irn(invoice)
    except Exception as e:
        db.table("einvoice_log").insert({
            "invoice_id": str(invoice_id),
            "status": "pending",
            "error_details": {"error": str(e)},
        }).execute()
        raise HTTPException(502, f"NIC API error: {e}")

    log_data = {
        "invoice_id": str(invoice_id),
        "irn": irn_data["Irn"],
        "ack_no": irn_data.get("AckNo"),
        "ack_date": irn_data.get("AckDt"),
        "signed_invoice": irn_data.get("SignedInvoice"),
        "qr_code": irn_data.get("QRCodeUrl"),
        "status": "generated",
    }
    db.table("einvoice_log").insert(log_data).execute()
    db.table("invoices").update({"irn": irn_data["Irn"]}).eq("id", str(invoice_id)).execute()

    return log_data


@router.post("/cancel/{invoice_id}")
async def cancel_irn(
    invoice_id: UUID,
    reason: str,
    user: dict = Depends(require_roles("admin", "accounts")),
):
    db = get_db()
    log = db.table("einvoice_log").select("irn").eq("invoice_id", str(invoice_id)).single().execute().data
    if not log or not log.get("irn"):
        raise HTTPException(404, "No IRN found for this invoice")

    nic = NICClient()
    await nic.cancel_irn(log["irn"], reason)

    db.table("einvoice_log").update({"status": "cancelled"}).eq("invoice_id", str(invoice_id)).execute()
    db.table("invoices").update({"irn": None}).eq("id", str(invoice_id)).execute()
    return {"status": "cancelled"}


@router.post("/ewaybill")
async def generate_ewaybill(
    payload: EWBRequest,
    user: dict = Depends(require_roles("admin", "accounts")),
):
    db = get_db()
    invoice = db.table("invoices").select("*, invoice_items(*)").eq("id", str(payload.invoice_id)).single().execute().data
    if not invoice:
        raise HTTPException(404, "Invoice not found")

    nic = NICClient()
    ewb_data = await nic.generate_ewaybill(invoice, payload.model_dump())

    log_data = {
        "invoice_id": str(payload.invoice_id),
        "ewb_no": ewb_data["EwbNo"],
        "valid_upto": ewb_data.get("EwbValidTill"),
        "vehicle_no": payload.vehicle_no,
        "transporter_id": payload.transporter_id,
        "distance_km": payload.distance_km,
        "mode_of_trans": payload.mode_of_trans,
    }
    db.table("ewaybill_log").insert(log_data).execute()
    db.table("invoices").update({"ewb_no": ewb_data["EwbNo"]}).eq("id", str(payload.invoice_id)).execute()

    return log_data
