from pydantic import BaseModel
from uuid import UUID
from datetime import datetime


class TimestampMixin(BaseModel):
    created_at: datetime | None = None
    updated_at: datetime | None = None


class IDMixin(BaseModel):
    id: UUID | None = None
