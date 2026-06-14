import json
from datetime import date
from fastapi import APIRouter, Depends, Query, Response
from app.auth import require_roles, get_current_user
from app.db.client import get_db
from app.services.gstr1 import compute_gstr1, generate_gstr1_excel
from app.services.gstr3b import compute_gstr3b, generate_gstr3b_excel
from app.services.aging import compute_receivables_aging, compute_payables_aging, generate_aging_excel

router = APIRouter(prefix="/reports", tags=["Reports"])


def _fetch_invoices(db, from_date: str, to_date: str) -> list[dict]:
    q = db.table("invoices").select(
        "*, companies(name, gstin), invoice_items(hsn_code, description, uom, qty, rate, gst_rate, cgst_amt, sgst_amt, igst_amt)"
    ).gte("date", from_date).lte("date", to_date).execute()
    return q.data or []


def _fetch_credit_notes(db, from_date: str, to_date: str) -> list[dict]:
    q = db.table("credit_notes").select(
        "*, companies(name, gstin), invoices!invoice_id(inv_no)"
    ).gte("date", from_date).lte("date", to_date).execute()
    return q.data or []


def _fetch_pos(db, from_date: str, to_date: str) -> list[dict]:
    q = db.table("purchase_orders").select(
        "*, companies(name, gstin)"
    ).gte("date", from_date).lte("date", to_date).execute()
    return q.data or []


# ── GSTR-1 ───────────────────────────────────────────────────────────────────

@router.get("/gstr1")
async def get_gstr1(
    from_date: str = Query(...),
    to_date: str = Query(...),
    user: dict = Depends(require_roles("admin", "accounts")),
):
    db = get_db()
    invoices = _fetch_invoices(db, from_date, to_date)
    credit_notes = _fetch_credit_notes(db, from_date, to_date)
    data = compute_gstr1(invoices, credit_notes)
    # Convert Decimal → float for JSON serialisation
    return _jsonify_report(data)


@router.get("/gstr1/excel")
async def download_gstr1_excel(
    from_date: str = Query(...),
    to_date: str = Query(...),
    user: dict = Depends(require_roles("admin", "accounts")),
):
    db = get_db()
    invoices = _fetch_invoices(db, from_date, to_date)
    credit_notes = _fetch_credit_notes(db, from_date, to_date)
    data = compute_gstr1(invoices, credit_notes)
    period = f"{from_date} to {to_date}"
    xlsx = generate_gstr1_excel(data, period)
    filename = f"GSTR-1_{from_date}_{to_date}.xlsx"
    return Response(
        content=xlsx,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/gstr1/json")
async def download_gstr1_json(
    from_date: str = Query(...),
    to_date: str = Query(...),
    user: dict = Depends(require_roles("admin", "accounts")),
):
    """Download NIC-compatible GSTR-1 JSON payload."""
    db = get_db()
    invoices = _fetch_invoices(db, from_date, to_date)
    credit_notes = _fetch_credit_notes(db, from_date, to_date)
    data = compute_gstr1(invoices, credit_notes)
    # Fetch our company GSTIN for the payload header
    cs = db.table("company_settings").select("gstin").limit(1).execute()
    company_gstin = (cs.data[0].get("gstin") if cs.data else None) or ""
    nic_payload = _build_nic_gstr1(data, from_date, to_date, company_gstin, invoices)
    json_bytes = json.dumps(nic_payload, indent=2, default=str).encode()
    filename = f"GSTR-1_{from_date}_{to_date}.json"
    return Response(
        content=json_bytes,
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── GSTR-3B ──────────────────────────────────────────────────────────────────

@router.get("/gstr3b")
async def get_gstr3b(
    from_date: str = Query(...),
    to_date: str = Query(...),
    user: dict = Depends(require_roles("admin", "accounts")),
):
    db = get_db()
    invoices = _fetch_invoices(db, from_date, to_date)
    credit_notes = _fetch_credit_notes(db, from_date, to_date)
    purchase_orders = _fetch_pos(db, from_date, to_date)
    data = compute_gstr3b(invoices, credit_notes, purchase_orders)
    return data


@router.get("/gstr3b/excel")
async def download_gstr3b_excel(
    from_date: str = Query(...),
    to_date: str = Query(...),
    user: dict = Depends(require_roles("admin", "accounts")),
):
    db = get_db()
    invoices = _fetch_invoices(db, from_date, to_date)
    credit_notes = _fetch_credit_notes(db, from_date, to_date)
    purchase_orders = _fetch_pos(db, from_date, to_date)
    data = compute_gstr3b(invoices, credit_notes, purchase_orders)
    period = f"{from_date} to {to_date}"
    xlsx = generate_gstr3b_excel(data, period)
    filename = f"GSTR-3B_{from_date}_{to_date}.xlsx"
    return Response(
        content=xlsx,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── Receivables Aging ─────────────────────────────────────────────────────────

@router.get("/aging/receivables")
async def get_receivables_aging(
    as_of: str | None = Query(None),
    user: dict = Depends(require_roles("admin", "accounts")),
):
    db = get_db()
    as_of_date = date.fromisoformat(as_of) if as_of else date.today()
    invoices = db.table("invoices").select(
        "*, companies(name, gstin)"
    ).execute().data or []
    rows = compute_receivables_aging(invoices, as_of_date)
    return {"as_of": str(as_of_date), "rows": rows}


@router.get("/aging/receivables/excel")
async def download_receivables_excel(
    as_of: str | None = Query(None),
    user: dict = Depends(require_roles("admin", "accounts")),
):
    db = get_db()
    as_of_date = date.fromisoformat(as_of) if as_of else date.today()
    invoices = db.table("invoices").select("*, companies(name, gstin)").execute().data or []
    rows = compute_receivables_aging(invoices, as_of_date)
    xlsx = generate_aging_excel(rows, "Receivables Aging", "customer_name", as_of_date)
    filename = f"Receivables_Aging_{as_of_date}.xlsx"
    return Response(
        content=xlsx,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── Payables Aging ────────────────────────────────────────────────────────────

@router.get("/aging/payables")
async def get_payables_aging(
    as_of: str | None = Query(None),
    user: dict = Depends(require_roles("admin", "accounts")),
):
    db = get_db()
    as_of_date = date.fromisoformat(as_of) if as_of else date.today()
    pos = db.table("purchase_orders").select("*, companies(name, gstin)").execute().data or []
    rows = compute_payables_aging(pos, as_of_date)
    return {"as_of": str(as_of_date), "rows": rows}


@router.get("/aging/payables/excel")
async def download_payables_excel(
    as_of: str | None = Query(None),
    user: dict = Depends(require_roles("admin", "accounts")),
):
    db = get_db()
    as_of_date = date.fromisoformat(as_of) if as_of else date.today()
    pos = db.table("purchase_orders").select("*, companies(name, gstin)").execute().data or []
    rows = compute_payables_aging(pos, as_of_date)
    xlsx = generate_aging_excel(rows, "Payables Aging", "supplier_name", as_of_date)
    filename = f"Payables_Aging_{as_of_date}.xlsx"
    return Response(
        content=xlsx,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

def _jsonify_report(obj):
    """Recursively convert Decimal → float for JSON."""
    from decimal import Decimal
    if isinstance(obj, dict):
        return {k: _jsonify_report(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_jsonify_report(i) for i in obj]
    if isinstance(obj, Decimal):
        return round(float(obj), 2)
    return obj


def _build_nic_gstr1(data: dict, from_date: str, to_date: str, company_gstin: str, raw_invoices: list) -> dict:
    """Build NIC GST portal compatible GSTR-1 JSON structure."""
    from collections import defaultdict

    # Build inv_no → items lookup for per-rate breakdown
    inv_items_map: dict = {}
    for inv in raw_invoices:
        inv_items_map[inv.get("inv_no", "")] = inv.get("invoice_items") or []

    def _itms(inv_no: str, taxable_amt, cgst, sgst, igst) -> list:
        items = inv_items_map.get(inv_no, [])
        if items:
            groups: dict = defaultdict(lambda: {"txval": 0.0, "camt": 0.0, "samt": 0.0, "iamt": 0.0})
            for it in items:
                rt = float(it.get("gst_rate", 0))
                groups[rt]["txval"] += float(it.get("qty", 0)) * float(it.get("rate", 0))
                groups[rt]["camt"] += float(it.get("cgst_amt", 0))
                groups[rt]["samt"] += float(it.get("sgst_amt", 0))
                groups[rt]["iamt"] += float(it.get("igst_amt", 0))
            return [
                {"num": i + 1, "itm_det": {
                    "rt": rt, "txval": round(v["txval"], 2),
                    "iamt": round(v["iamt"], 2), "csamt": 0,
                    "camt": round(v["camt"], 2), "samt": round(v["samt"], 2),
                }}
                for i, (rt, v) in enumerate(groups.items())
            ]
        # Fallback: derive rate from totals
        t = float(taxable_amt or 0)
        total_gst = float(cgst or 0) + float(sgst or 0) + float(igst or 0)
        rt = round(total_gst / t * 100) if t else 0
        return [{"num": 1, "itm_det": {
            "rt": rt, "txval": round(t, 2),
            "iamt": round(float(igst or 0), 2), "csamt": 0,
            "camt": round(float(cgst or 0), 2), "samt": round(float(sgst or 0), 2),
        }}]

    # B2B
    b2b_nic = []
    for entry in data.get("b2b", []):
        inv_list = [
            {
                "inum": inv["inv_no"],
                "idt": str(inv["date"]),
                "val": round(float(inv["total"]), 2),
                "pos": inv["place_of_supply"],
                "rchrg": "N",
                "inv_typ": "R",
                "itms": _itms(inv["inv_no"], inv["taxable_amt"], inv["cgst"], inv["sgst"], inv["igst"]),
            }
            for inv in entry.get("invoices", [])
        ]
        b2b_nic.append({"ctin": entry.get("gstin", ""), "inv": inv_list})

    # B2CS
    b2cs_nic = [
        {
            "pos": row["place_of_supply"], "typ": "OE",
            "txval": round(float(row["taxable_amt"]), 2),
            "iamt": round(float(row["igst"]), 2),
            "camt": round(float(row["cgst"]), 2),
            "samt": round(float(row["sgst"]), 2),
            "csamt": 0,
        }
        for row in data.get("b2cs", [])
    ]

    # CDNR (credit notes to registered buyers)
    cdnr_nic = []
    for entry in data.get("cdnr", []):
        nt_list = []
        for cn in entry.get("notes", []):
            t = float(cn.get("taxable_amt", 0))
            total_gst = float(cn.get("cgst", 0)) + float(cn.get("sgst", 0)) + float(cn.get("igst", 0))
            rt = round(total_gst / t * 100) if t else 0
            nt_list.append({
                "ntty": "C", "nt_num": cn["cn_no"], "nt_dt": str(cn["date"]),
                "val": round(float(cn["total"]), 2),
                "pos": cn.get("place_of_supply", "27"), "rchrg": "N", "inv_typ": "R",
                "itms": [{"num": 1, "itm_det": {
                    "rt": rt, "txval": round(t, 2),
                    "iamt": round(float(cn.get("igst", 0)), 2), "csamt": 0,
                    "camt": round(float(cn.get("cgst", 0)), 2),
                    "samt": round(float(cn.get("sgst", 0)), 2),
                }}],
            })
        if nt_list:
            cdnr_nic.append({"ctin": entry.get("gstin", ""), "nt": nt_list})

    # CDNS (credit notes to unregistered)
    cdns_nic = []
    for cn in data.get("cdns", []):
        t = float(cn.get("taxable_amt", 0))
        total_gst = float(cn.get("cgst", 0)) + float(cn.get("sgst", 0)) + float(cn.get("igst", 0))
        rt = round(total_gst / t * 100) if t else 0
        cdns_nic.append({
            "pos": cn.get("place_of_supply", "27"), "typ": "OE", "ntty": "C",
            "nt_num": cn["cn_no"], "nt_dt": str(cn["date"]),
            "val": round(float(cn["total"]), 2), "txval": round(t, 2),
            "iamt": round(float(cn.get("igst", 0)), 2), "csamt": 0,
            "camt": round(float(cn.get("cgst", 0)), 2),
            "samt": round(float(cn.get("sgst", 0)), 2),
        })

    gt = sum(round(float(inv["total"]), 2) for e in data.get("b2b", []) for inv in e.get("invoices", []))
    gt += sum(r["txval"] + r["camt"] + r["samt"] + r["iamt"] for r in b2cs_nic)

    return {
        "gstin": company_gstin,
        "fp": from_date[:7].replace("-", ""),
        "gt": round(gt, 2),
        "cur_gt": round(gt, 2),
        "b2b": b2b_nic,
        "b2cs": b2cs_nic,
        "cdnr": cdnr_nic,
        "cdns": cdns_nic,
    }
