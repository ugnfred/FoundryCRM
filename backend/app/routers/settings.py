from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
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
    einvoice_env: str = "sandbox"


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


class CreateUserIn(BaseModel):
    name: str
    email: str
    password: str
    role: str


@router.get("/users")
async def list_users(user: dict = Depends(require_roles("admin"))):
    db = get_db()
    return db.table("profiles").select("*").order("name").execute().data


@router.post("/users", status_code=201)
async def create_user(
    payload: CreateUserIn,
    user: dict = Depends(require_roles("admin")),
):
    valid_roles = {"admin", "sales", "accounts", "dispatch"}
    if payload.role not in valid_roles:
        raise HTTPException(400, f"Role must be one of {valid_roles}")
    if len(payload.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    db = get_db()
    try:
        auth_response = db.auth.admin.create_user({
            "email": payload.email,
            "password": payload.password,
            "email_confirm": True,
            "user_metadata": {"full_name": payload.name},
        })
        new_user_id = auth_response.user.id
    except Exception as e:
        raise HTTPException(400, f"Could not create user: {str(e)}")

    # The handle_new_user trigger should create the profile row automatically,
    # but set role and name explicitly in case it runs async
    db.table("profiles").upsert({
        "id": new_user_id,
        "name": payload.name,
        "email": payload.email,
        "role": payload.role,
        "is_active": True,
    }).execute()
    return {"id": new_user_id, "name": payload.name, "email": payload.email, "role": payload.role}


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


@router.put("/users/{user_id}/deactivate")
async def deactivate_user(
    user_id: str,
    current_user: dict = Depends(require_roles("admin")),
):
    if user_id == current_user["id"]:
        raise HTTPException(400, "You cannot deactivate your own account")
    db = get_db()
    db.table("profiles").update({"is_active": False}).eq("id", user_id).execute()
    return {"status": "deactivated"}


@router.put("/users/{user_id}/reactivate")
async def reactivate_user(
    user_id: str,
    user: dict = Depends(require_roles("admin")),
):
    db = get_db()
    db.table("profiles").update({"is_active": True}).eq("id", user_id).execute()
    return {"status": "reactivated"}


@router.get("/companies/{company_id}/ledger")
async def get_customer_ledger(
    company_id: str,
    from_date: str | None = None,
    to_date: str | None = None,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    query = db.table("customer_ledger").select("*").eq("company_id", company_id).order("doc_date", desc=False)
    if from_date:
        query = query.gte("doc_date", from_date)
    if to_date:
        query = query.lte("doc_date", to_date)
    rows = query.execute().data

    # Compute running balance
    balance = 0.0
    for row in rows:
        balance += float(row.get("debit", 0)) - float(row.get("credit", 0))
        row["running_balance"] = round(balance, 2)

    company = db.table("companies").select("name").eq("id", company_id).single().execute().data
    return {"company": company, "rows": rows, "closing_balance": round(balance, 2)}


@router.post("/companies/{company_id}/ledger/opening")
async def set_opening_balance(
    company_id: str,
    payload: dict,
    user: dict = Depends(require_roles("admin", "accounts")),
):
    """Set or replace the opening balance entry for a customer."""
    db = get_db()
    # Remove any existing opening entry
    db.table("customer_ledger").delete().eq("company_id", company_id).eq("doc_type", "opening").execute()
    amount = float(payload.get("amount", 0))
    if amount != 0:
        # Positive = they owe us (debit); Negative = we owe them (credit)
        db.table("customer_ledger").insert({
            "company_id": company_id,
            "doc_type": "opening",
            "doc_no": "Opening Balance",
            "doc_date": payload.get("as_of_date", "2024-04-01"),
            "debit": amount if amount > 0 else 0,
            "credit": abs(amount) if amount < 0 else 0,
            "notes": "Opening balance",
        }).execute()
    return {"status": "ok"}


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
