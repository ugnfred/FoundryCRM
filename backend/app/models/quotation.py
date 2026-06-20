from pydantic import BaseModel, field_validator
from uuid import UUID
from datetime import date
from decimal import Decimal
from typing import Literal


QuotationStatus = Literal["draft", "sent", "accepted", "lost", "expired"]


class QuotationItemIn(BaseModel):
    product_id: UUID | None = None
    description: str
    hsn_code: str
    uom: str
    qty: Decimal
    rate: Decimal
    gst_rate: Decimal
    sort_order: int = 0


class QuotationItemOut(QuotationItemIn):
    id: UUID
    quotation_id: UUID
    amount: Decimal


class QuotationIn(BaseModel):
    company_id: UUID
    date: date
    valid_until: date | None = None
    status: QuotationStatus = "draft"
    notes: str | None = None
    terms: str | None = None
    items: list[QuotationItemIn]

    @field_validator('valid_until', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        return None if v == '' else v


class QuotationOut(BaseModel):
    id: UUID
    quot_no: str
    company_id: UUID
    date: date
    valid_until: date | None
    status: QuotationStatus
    notes: str | None
    terms: str | None
    taxable_amt: Decimal
    total_gst: Decimal
    total: Decimal
    items: list[QuotationItemOut] = []
    created_at: str | None = None
