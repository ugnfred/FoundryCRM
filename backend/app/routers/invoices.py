from fastapi import APIRouter, Depends, HTTPException, Response
from uuid import UUID
from decimal import Decimal
from datetime import date
from app.auth import get_current_user, require_roles
from app.db.client import get_db
from app.models.invoice import InvoiceIn, PaymentIn
from app.utils import jsonify

router = APIRouter(prefix="/invoices", tags=["Invoices"])


def _get_our_state() -> str:
    db = get_db()
    result = db.table("company_settings").select("state_code").limit(1).execute()
    return result.data[0]["state_code"] if result.data else "27"


def _calc_gst(items: list[dict], place_of_supply: str) -> dict:
    """Auto-split CGST/SGST (intra-state) vs IGST (inter-state)."""
    our_state = _get_our_state()
    intra = our_state == place_of_supply

    taxable = Decimal("0")
    cgst = sgst = igst = Decimal("0")
    enriched = []

    for item in items:
        qty = Decimal(str(item["qty"]))
        rate = Decimal(str(item["rate"]))
        gst_rate = Decimal(str(item["gst_rate"]))
        amt = qty * rate
        gst_amt = amt * gst_rate / 100
        taxable += amt

        if intra:
            item_cgst = gst_amt / 2
            item_sgst = gst_amt / 2
            item_igst = Decimal("0")
            cgst += item_cgst
            sgst += item_sgst
        else:
            item_cgst = item_sgst = Decimal("0")
            item_igst = gst_amt
            igst += item_igst

        enriched.append({**item, "cgst_amt": item_cgst, "sgst_amt": item_sgst, "igst_amt": item_igst})

    return {
        "taxable_amt": taxable,
        "cgst": cgst,
        "sgst": sgst,
        "igst": igst,
        "total": taxable + cgst + sgst + igst,
        "enriched_items": enriched,
    }


def _update_stock(db, product_id: str, qty: Decimal, ref_id, ref_type: str, user_id: str):
    """Append a stock ledger entry with running balance.

    ref_type maps to txn_type enum: 'invoice'→'sale', 'grn'→'grn', else use ref_type as-is.
    """
    last = db.table("stock_ledger").select("balance").eq("product_id", product_id).order("created_at", desc=True).limit(1).execute().data
    prev_balance = Decimal(str(last[0]["balance"])) if last else Decimal("0")
    new_balance = prev_balance + qty
    txn_type_map = {"invoice": "sale", "grn": "grn", "adjustment": "adjustment", "opening": "opening"}
    txn_type = txn_type_map.get(ref_type, "adjustment")
    row = {
        "product_id": product_id,
        "txn_type": txn_type,
        "qty": float(qty),
        "ref_type": ref_type,
        "balance": float(new_balance),
        "created_by": user_id,
    }
    if ref_id is not None:
        row["ref_id"] = str(ref_id)
    db.table("stock_ledger").insert(row).execute()


def _reverse_stock(db, invoice_id: str, user_id: str):
    """Reverse stock deductions for all items of an invoice."""
    items = db.table("invoice_items").select("product_id, qty").eq("invoice_id", invoice_id).execute().data
    for item in items:
        if item.get("product_id"):
            # Positive qty = stock returned (reversal of a sale deduction)
            _update_stock(db, item["product_id"], Decimal(str(item["qty"])), invoice_id, "adjustment", user_id)


def _sync_so_status(db, so_id: str):
    """Update SO status based on its invoice states."""
    so = db.table("sales_orders").select("status").eq("id", so_id).single().execute().data
    if not so or so["status"] in ("cancelled", "closed"):
        return

    invoices = db.table("invoices").select("status").eq("so_id", so_id).execute().data
    if not invoices:
        return

    all_paid = all(inv["status"] == "paid" for inv in invoices)
    any_active = any(inv["status"] in ("sent", "partially_paid", "paid") for inv in invoices)

    if all_paid:
        db.table("sales_orders").update({"status": "closed"}).eq("id", so_id).execute()
    elif any_active and so["status"] == "confirmed":
        db.table("sales_orders").update({"status": "dispatched"}).eq("id", so_id).execute()


@router.get("/")
async def list_invoices(user: dict = Depends(get_current_user)):
    db = get_db()
    invoices = db.table("invoices").select("*, companies(name)").order("date", desc=True).execute().data

    # Auto-flag overdue: sent invoices whose due_date has passed
    today = date.today().isoformat()
    overdue_ids = [
        inv["id"] for inv in invoices
        if inv["status"] == "sent" and inv.get("due_date") and inv["due_date"] < today
    ]
    if overdue_ids:
        for inv_id in overdue_ids:
            db.table("invoices").update({"status": "overdue"}).eq("id", inv_id).execute()
        # Reflect updated status in the response
        for inv in invoices:
            if inv["id"] in overdue_ids:
                inv["status"] = "overdue"

    return invoices


@router.get("/{invoice_id}")
async def get_invoice(invoice_id: UUID, user: dict = Depends(get_current_user)):
    db = get_db()
    result = db.table("invoices").select("*, companies(*), invoice_items(*, products(name)), payments(*)").eq("id", str(invoice_id)).single().execute()
    if not result.data:
        raise HTTPException(404, "Invoice not found")
    return result.data


@router.post("/", status_code=201)
async def create_invoice(
    payload: InvoiceIn,
    user: dict = Depends(require_roles("admin", "sales", "accounts")),
):
    db = get_db()
    items = [i.model_dump() for i in payload.items]
    calc = _calc_gst(items, payload.place_of_supply)

    inv_data = {
        **payload.model_dump(exclude={"items"}),
        "taxable_amt": calc["taxable_amt"],
        "cgst": calc["cgst"],
        "sgst": calc["sgst"],
        "igst": calc["igst"],
        "total": calc["total"],
        "created_by": user["id"],
        "company_id": str(payload.company_id),
        "date": str(payload.date),
    }
    if payload.so_id:
        inv_data["so_id"] = str(payload.so_id)
    if payload.due_date:
        inv_data["due_date"] = str(payload.due_date)

    result = db.table("invoices").insert(jsonify(inv_data)).execute()
    inv = result.data[0]

    for item in calc["enriched_items"]:
        item["invoice_id"] = inv["id"]
        if item.get("product_id"):
            item["product_id"] = str(item["product_id"])
        item.pop("amount", None)
    if calc["enriched_items"]:
        db.table("invoice_items").insert(jsonify(calc["enriched_items"])).execute()

    # Deduct stock for each line item
    for item in calc["enriched_items"]:
        if item.get("product_id"):
            _update_stock(db, item["product_id"], -Decimal(str(item["qty"])), inv["id"], "invoice", user["id"])

    # Sync SO status (confirmed → dispatched)
    if payload.so_id:
        _sync_so_status(db, str(payload.so_id))

    return await get_invoice(inv["id"], user)


@router.put("/{invoice_id}")
async def update_invoice(
    invoice_id: UUID,
    payload: InvoiceIn,
    user: dict = Depends(require_roles("admin", "accounts")),
):
    db = get_db()

    # Reverse stock from old items before replacing them
    _reverse_stock(db, str(invoice_id), user["id"])

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
    }
    for field in ("date", "due_date"):
        if update_data.get(field) is not None:
            update_data[field] = str(update_data[field])

    db.table("invoices").update(jsonify(update_data)).eq("id", str(invoice_id)).execute()
    db.table("invoice_items").delete().eq("invoice_id", str(invoice_id)).execute()

    for item in calc["enriched_items"]:
        item["invoice_id"] = str(invoice_id)
        if item.get("product_id"):
            item["product_id"] = str(item["product_id"])
        item.pop("amount", None)
    if calc["enriched_items"]:
        db.table("invoice_items").insert(jsonify(calc["enriched_items"])).execute()

    # Apply new stock deductions
    for item in calc["enriched_items"]:
        if item.get("product_id"):
            _update_stock(db, item["product_id"], -Decimal(str(item["qty"])), str(invoice_id), "invoice", user["id"])

    return await get_invoice(invoice_id, user)


@router.post("/{invoice_id}/payments", status_code=201)
async def record_payment(
    invoice_id: UUID,
    payload: PaymentIn,
    user: dict = Depends(require_roles("admin", "accounts")),
):
    db = get_db()
    invoice = db.table("invoices").select("total, amount_paid, so_id").eq("id", str(invoice_id)).single().execute().data
    if not invoice:
        raise HTTPException(404, "Invoice not found")

    # Guard: reject overpayment
    balance_due = Decimal(str(invoice["total"])) - Decimal(str(invoice.get("amount_paid") or 0))
    if Decimal(str(payload.amount)) > balance_due:
        raise HTTPException(400, f"Payment {payload.amount} exceeds balance due {float(balance_due):.2f}")

    payment_data = {
        **payload.model_dump(exclude={"invoice_id"}),
        "invoice_id": str(invoice_id),
        "date": str(payload.date),
        "created_by": user["id"],
    }
    db.table("payments").insert(jsonify(payment_data)).execute()

    # Recalculate total paid and update invoice status
    payments = db.table("payments").select("amount").eq("invoice_id", str(invoice_id)).execute().data
    total_paid = sum(Decimal(str(p["amount"])) for p in payments)
    new_status = "paid" if total_paid >= Decimal(str(invoice["total"])) else "partially_paid"
    db.table("invoices").update({"amount_paid": float(total_paid), "status": new_status}).eq("id", str(invoice_id)).execute()

    # Sync SO status (dispatched → closed when fully paid)
    if invoice.get("so_id"):
        _sync_so_status(db, invoice["so_id"])

    return {"amount_paid": float(total_paid), "status": new_status}


@router.get("/{invoice_id}/pdf")
async def download_invoice_pdf(invoice_id: UUID, user: dict = Depends(get_current_user)):
    from app.services.pdf import generate_invoice_pdf
    invoice = (await get_invoice(invoice_id, user))
    pdf_bytes = generate_invoice_pdf(invoice)
    return Response(content=pdf_bytes, media_type="application/pdf",
                    headers={"Content-Disposition": f"attachment; filename=invoice-{invoice['inv_no']}.pdf"})
