from pydantic import BaseModel
from uuid import UUID
from datetime import date
from decimal import Decimal
from typing import Literal


POStatus = Literal["draft", "sent", "partial", "received", "closed", "cancelled"]


class POItemIn(BaseModel):
    product_id: UUID | None = None
    description: str
    hsn_code: str
    uom: str
    qty: Decimal
    rate: Decimal
    gst_rate: Decimal
    sort_order: int = 0


class POItemOut(POItemIn):
    id: UUID
    po_id: UUID
    amount: Decimal
    received_qty: Decimal


class POIn(BaseModel):
    company_id: UUID
    date: date
    delivery_date: date | None = None
    status: POStatus = "draft"
    notes: str | None = None
    terms: str | None = None
    items: list[POItemIn]


class POOut(BaseModel):
    id: UUID
    po_no: str
    company_id: UUID
    date: date
    delivery_date: date | None
    status: POStatus
    taxable_amt: Decimal
    total_gst: Decimal
    total: Decimal
    items: list[POItemOut] = []
    created_at: str | None = None


class GRNItemIn(BaseModel):
    po_item_id: UUID
    product_id: UUID
    qty_received: Decimal
    rate: Decimal


class GRNIn(BaseModel):
    po_id: UUID
    received_date: date
    notes: str | None = None
    items: list[GRNItemIn]
