from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.db.client import get_db

bearer = HTTPBearer()


async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> dict:
    db = get_db()

    # Verify token by calling Supabase auth — no JWT secret needed
    try:
        auth_response = db.auth.get_user(creds.credentials)
        user_id = auth_response.user.id
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    result = db.table("profiles").select("*").eq("id", user_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=401, detail="User profile not found")
    if not result.data.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account deactivated. Contact your administrator.")
    return result.data


def require_roles(*roles: str):
    async def checker(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return checker


# Convenience dependency aliases
AdminOnly = Depends(require_roles("admin"))
AdminAccounts = Depends(require_roles("admin", "accounts"))
AdminSales = Depends(require_roles("admin", "sales"))
AnyStaff = Depends(get_current_user)
