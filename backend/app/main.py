import traceback
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import settings
from app.routers import quotations, orders, invoices, purchase_orders, inventory, einvoice, settings as settings_router, grns, credit_notes, reports, proforma, delivery_challans, advance_receipts, bom, work_orders

app = FastAPI(
    title="Foundry ERP API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exc()
    print(f"\n[ERROR] {request.method} {request.url}\n{tb}")
    return JSONResponse(status_code=500, content={"detail": str(exc), "traceback": tb.splitlines()[-3:]})

app.include_router(quotations.router, prefix="/api/v1")
app.include_router(orders.router, prefix="/api/v1")
app.include_router(invoices.router, prefix="/api/v1")
app.include_router(purchase_orders.router, prefix="/api/v1")
app.include_router(inventory.router, prefix="/api/v1")
app.include_router(einvoice.router, prefix="/api/v1")
app.include_router(settings_router.router, prefix="/api/v1")
app.include_router(grns.router, prefix="/api/v1")
app.include_router(credit_notes.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(proforma.router, prefix="/api/v1")
app.include_router(delivery_challans.router, prefix="/api/v1")
app.include_router(advance_receipts.router, prefix="/api/v1")
app.include_router(bom.router, prefix="/api/v1")
app.include_router(work_orders.router, prefix="/api/v1")


@app.get("/health")
def health():
    return {"status": "ok"}
