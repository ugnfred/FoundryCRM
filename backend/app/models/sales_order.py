from pydantic import BaseModel, field_validator
from uuid import UUID
from datetime import date
from decimal import Decimal
from typing import Literal


SOStatus = Literal["draft", "confirmed", "dispatched", "closed", "cancelled"]


class SOItemIn(BaseModel):
    product_id: UUID | None = None
    description: str
    hsn_code: str
    uom: str
    qty: Decimal
    rate: Decimal
    gst_rate: Decimal
    sort_order: int = 0


class SOItemOut(SOItemIn):
    id: UUID
    so_id: UUID
    amount: Decimal
    dispatched_qty: Decimal


class SOIn(BaseModel):
    quotation_id: UUID | None = None
    company_id: UUID
    date: date
    delivery_date: date | None = None
    po_reference: str | None = None
    status: SOStatus = "draft"
    notes: str | None = None
    terms: str | None = None
    items: list[SOItemIn]

    @field_validator('delivery_date', 'quotation_id', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        return None if v == '' else v


class SOOut(BaseModel):
    id: UUID
    so_no: str
    quotation_id: UUID | None
    company_id: UUID
    date: date
    delivery_date: date | None
    po_reference: str | None
    status: SOStatus
    taxable_amt: Decimal
    total_gst: Decimal
    total: Decimal
    items: list[SOItemOut] = []
    created_at: str | None = None
