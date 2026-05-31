from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.auth import require_roles, get_current_user
from app.db.client import get_db

router = APIRouter(prefix="/settings", tags=["Settings"])


class CompanySettingsIn(BaseModel):
    name: str
    gstin: str
    state_code: str
    address: str | None = None
    pan: str | None = None
    phone: str | None = None
    email: str | None = None
    cin: str | None = None
    bank_name: str | None = None
    bank_account: str | None = None
    bank_ifsc: str | None = None
    upi_id: str | None = None
    logo_url: str | None = None


@router.get("/company")
async def get_company_settings(user: dict = Depends(get_current_user)):
    db = get_db()
    result = db.table("company_settings").select("*").limit(1).execute()
    return result.data[0] if result.data else {}


@router.put("/company")
async def upsert_company_settings(
    payload: CompanySettingsIn,
    user: dict = Depends(require_roles("admin")),
):
    db = get_db()
    existing = db.table("company_settings").select("id").limit(1).execute().data
    if existing:
        db.table("company_settings").update(payload.model_dump()).eq("id", existing[0]["id"]).execute()
    else:
        db.table("company_settings").insert(payload.model_dump()).execute()
    return await get_company_settings(user)


@router.get("/users")
async def list_users(user: dict = Depends(require_roles("admin"))):
    db = get_db()
    return db.table("profiles").select("*").order("name").execute().data


@router.put("/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    role: str,
    user: dict = Depends(require_roles("admin")),
):
    valid_roles = {"admin", "sales", "accounts", "dispatch"}
    if role not in valid_roles:
        raise HTTPException(400, f"Role must be one of {valid_roles}")
    db = get_db()
    db.table("profiles").update({"role": role}).eq("id", user_id).execute()
    return {"status": "updated"}


@router.get("/companies")
async def list_companies(user: dict = Depends(get_current_user)):
    db = get_db()
    return db.table("companies").select("*").eq("is_active", True).order("name").execute().data


@router.post("/companies", status_code=201)
async def create_company(
    payload: dict,
    user: dict = Depends(require_roles("admin", "accounts")),
):
    db = get_db()
    return db.table("companies").insert(payload).execute().data[0]


@router.put("/companies/{company_id}")
async def update_company(
    company_id: str,
    payload: dict,
    user: dict = Depends(require_roles("admin", "accounts")),
):
    db = get_db()
    payload.pop("id", None)
    payload.pop("created_at", None)
    payload.pop("updated_at", None)
    db.table("companies").update(payload).eq("id", company_id).execute()
    return db.table("companies").select("*").eq("id", company_id).single().execute().data


@router.delete("/companies/{company_id}", status_code=204)
async def deactivate_company(
    company_id: str,
    user: dict = Depends(require_roles("admin")),
):
    db = get_db()
    db.table("companies").update({"is_active": False}).eq("id", company_id).execute()


@router.get("/products")
async def list_products(user: dict = Depends(get_current_user)):
    db = get_db()
    return db.table("products").select("*").eq("is_active", True).order("name").execute().data


@router.post("/products", status_code=201)
async def create_product(
    payload: dict,
    user: dict = Depends(require_roles("admin", "accounts")),
):
    db = get_db()
    return db.table("products").insert(payload).execute().data[0]


@router.put("/products/{product_id}")
async def update_product(
    product_id: str,
    payload: dict,
    user: dict = Depends(require_roles("admin", "accounts")),
):
    db = get_db()
    payload.pop("id", None)
    payload.pop("created_at", None)
    payload.pop("updated_at", None)
    db.table("products").update(payload).eq("id", product_id).execute()
    return db.table("products").select("*").eq("id", product_id).single().execute().data


@router.delete("/products/{product_id}", status_code=204)
async def deactivate_product(
    product_id: str,
    user: dict = Depends(require_roles("admin")),
):
    db = get_db()
    db.table("products").update({"is_active": False}).eq("id", product_id).execute()
