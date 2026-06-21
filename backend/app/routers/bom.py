from fastapi import APIRouter, Depends, HTTPException
from uuid import UUID
from pydantic import BaseModel
from typing import Optional
from app.auth import get_current_user, require_roles
from app.db.client import get_db
from app.utils import jsonify

router = APIRouter(prefix="/bom", tags=["Bill of Materials"])


class BOMItemIn(BaseModel):
    component_id: UUID
    qty: float
    uom: str = "NOS"
    notes: Optional[str] = None


class BOMIn(BaseModel):
    product_id: UUID
    notes: Optional[str] = None
    items: list[BOMItemIn]


@router.get("/")
async def list_bom(
    product_id: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    q = db.table("bom_headers").select(
        "*, products!product_id(name, uom), bom_items(*, products!component_id(name, uom))"
    ).order("created_at", desc=True)
    if product_id:
        q = q.eq("product_id", product_id)
    return q.execute().data or []


@router.get("/active")
async def get_active_bom(product_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    result = db.table("bom_headers").select(
        "*, products!product_id(name), bom_items(*, products!component_id(name, uom))"
    ).eq("product_id", product_id).eq("is_active", True).execute()
    if not result.data:
        raise HTTPException(404, "No active BOM for this product")
    return result.data[0]


@router.get("/{bom_id}")
async def get_bom(bom_id: UUID, user: dict = Depends(get_current_user)):
    db = get_db()
    result = db.table("bom_headers").select(
        "*, products!product_id(name, uom), bom_items(*, products!component_id(name, uom))"
    ).eq("id", str(bom_id)).execute()
    if not result.data:
        raise HTTPException(404, "BOM not found")
    return result.data[0]


@router.post("/", status_code=201)
async def create_bom(
    payload: BOMIn,
    user: dict = Depends(require_roles("admin", "accounts")),
):
    db = get_db()
    # Deactivate any existing active BOM for this product and bump version
    existing = db.table("bom_headers").select("id, version").eq("product_id", str(payload.product_id)).eq("is_active", True).execute().data or []
    if existing:
        db.table("bom_headers").update({"is_active": False}).eq("product_id", str(payload.product_id)).execute()
        next_version = max(e["version"] for e in existing) + 1
    else:
        next_version = 1

    bom_data = {
        "product_id": str(payload.product_id),
        "version": next_version,
        "is_active": True,
        "notes": payload.notes,
        "created_by": user["id"],
    }
    result = db.table("bom_headers").insert(bom_data).execute()
    bom = result.data[0]

    for item in payload.items:
        db.table("bom_items").insert({
            "bom_id": bom["id"],
            "component_id": str(item.component_id),
            "qty": item.qty,
            "uom": item.uom,
            "notes": item.notes,
        }).execute()

    return await get_bom(bom["id"], user)


@router.put("/{bom_id}")
async def update_bom(
    bom_id: UUID,
    payload: BOMIn,
    user: dict = Depends(require_roles("admin", "accounts")),
):
    """Create a new version from an existing BOM (immutable versioning)."""
    db = get_db()
    old_rows = db.table("bom_headers").select("version, product_id").eq("id", str(bom_id)).execute().data
    if not old_rows:
        raise HTTPException(404, "BOM not found")

    # Deactivate all for this product
    db.table("bom_headers").update({"is_active": False}).eq("product_id", str(payload.product_id)).execute()

    # Use max existing version + 1 to avoid UNIQUE(product_id, version) conflict
    all_versions = db.table("bom_headers").select("version").eq("product_id", str(payload.product_id)).execute().data or []
    max_version = max((r["version"] for r in all_versions), default=0)

    bom_data = {
        "product_id": str(payload.product_id),
        "version": max_version + 1,
        "is_active": True,
        "notes": payload.notes,
        "created_by": user["id"],
    }
    result = db.table("bom_headers").insert(bom_data).execute()
    new_bom = result.data[0]

    for item in payload.items:
        db.table("bom_items").insert({
            "bom_id": new_bom["id"],
            "component_id": str(item.component_id),
            "qty": item.qty,
            "uom": item.uom,
            "notes": item.notes,
        }).execute()

    return await get_bom(new_bom["id"], user)
