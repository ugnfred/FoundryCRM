from pydantic import BaseModel
from uuid import UUID
from datetime import date
from decimal import Decimal
from typing import Literal


InvoiceStatus = Literal["draft", "sent", "paid", "partially_paid", "overdue", "cancelled"]


class InvoiceItemIn(BaseModel):
    product_id: UUID | None = None
    description: str
    hsn_code: str
    uom: str
    qty: Decimal
    rate: Decimal
    gst_rate: Decimal
    sort_order: int = 0


class InvoiceItemOut(InvoiceItemIn):
    id: UUID
    invoice_id: UUID
    amount: Decimal
    cgst_amt: Decimal
    sgst_amt: Decimal
    igst_amt: Decimal


class InvoiceIn(BaseModel):
    so_id: UUID | None = None
    company_id: UUID
    date: date
    due_date: date | None = None
    place_of_supply: str
    status: InvoiceStatus = "draft"
    notes: str | None = None
    items: list[InvoiceItemIn]


class InvoiceOut(BaseModel):
    id: UUID
    inv_no: str
    so_id: UUID | None
    company_id: UUID
    date: date
    due_date: date | None
    place_of_supply: str
    taxable_amt: Decimal
    cgst: Decimal
    sgst: Decimal
    igst: Decimal
    total: Decimal
    amount_paid: Decimal
    balance_due: Decimal
    status: InvoiceStatus
    irn: str | None
    ewb_no: str | None
    items: list[InvoiceItemOut] = []
    created_at: str | None = None


class PaymentIn(BaseModel):
    invoice_id: UUID | None = None
    amount: Decimal
    date: date
    mode: str = "bank_transfer"
    reference: str | None = None
    notes: str | None = None
    advance_amount: Decimal = Decimal("0")  # amount to apply from advance credit
