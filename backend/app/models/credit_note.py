from pydantic import BaseModel
from uuid import UUID
from datetime import date
from decimal import Decimal


class CNItemIn(BaseModel):
    product_id: UUID | None = None
    description: str
    hsn_code: str | None = None
    uom: str | None = None
    qty: Decimal
    rate: Decimal
    gst_rate: Decimal = Decimal("0")
    sort_order: int = 0


class CreditNoteIn(BaseModel):
    invoice_id: UUID | None = None
    company_id: UUID
    date: date
    reason: str | None = None
    place_of_supply: str = "27"
    items: list[CNItemIn]
