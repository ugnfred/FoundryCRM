"""Invoice PDF generator using ReportLab."""
from io import BytesIO
from decimal import Decimal
import httpx
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_CENTER, TA_LEFT


# ─── Colour palette ───────────────────────────────────────────────────────────
# Shared neutrals
GREY_BORDER   = colors.HexColor("#cbd5e1")
GREY_ALT_ROW  = colors.HexColor("#f8fafc")
HIGHLIGHT_BG  = colors.HexColor("#fef9c3")   # soft yellow for Balance Due
TEXT_DARK     = colors.HexColor("#111827")
TEXT_MID      = colors.HexColor("#374151")
TEXT_LIGHT    = colors.HexColor("#6b7280")

# Per-document accent colours (kept for backward-compat imports in other modules)
BLUE_HEADER   = colors.HexColor("#1a56db")   # Sales Order — blue
BLUE_LIGHT    = colors.HexColor("#eff6ff")

# Invoice (Tax Invoice) — teal/green
INV_ACCENT    = colors.HexColor("#0f766e")
INV_LIGHT     = colors.HexColor("#f0fdf4")

PAGE_W        = A4[0]
L_MARGIN = R_MARGIN = 15 * mm
USABLE_W      = PAGE_W - L_MARGIN - R_MARGIN   # ≈ 165 mm


# ─── Amount in Words (Indian rupees) ─────────────────────────────────────────
_ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
         'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
         'Seventeen', 'Eighteen', 'Nineteen']
_TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']


def _n2w(n: int) -> str:
    if n < 20:
        return _ONES[n]
    if n < 100:
        return _TENS[n // 10] + (' ' + _ONES[n % 10] if n % 10 else '')
    if n < 1_000:
        return _ONES[n // 100] + ' Hundred' + (' ' + _n2w(n % 100) if n % 100 else '')
    if n < 1_00_000:
        return _n2w(n // 1_000) + ' Thousand' + (' ' + _n2w(n % 1_000) if n % 1_000 else '')
    if n < 1_00_00_000:
        return _n2w(n // 1_00_000) + ' Lakh' + (' ' + _n2w(n % 1_00_000) if n % 1_00_000 else '')
    return _n2w(n // 1_00_00_000) + ' Crore' + (' ' + _n2w(n % 1_00_00_000) if n % 1_00_00_000 else '')


def _amount_in_words(amount: Decimal) -> str:
    amt     = Decimal(str(amount)).quantize(Decimal('0.01'))
    rupees  = int(amt)
    paise   = int(round((amt - rupees) * 100))
    result  = f'Rupees {_n2w(rupees)}' if rupees else 'Rupees Zero'
    if paise:
        result += f' and {_n2w(paise)} Paise'
    return result + ' Only'


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _s(value) -> str:
    """Return a clean string or empty string — never the word 'None'."""
    if value is None:
        return ""
    s = str(value).strip()
    return "" if s.lower() == "none" else s


def _money(value) -> str:
    return f"₹ {Decimal(str(value or 0)):,.2f}"


def _get_company_settings() -> dict:
    from app.db.client import get_db
    result = get_db().table("company_settings").select("*").limit(1).execute()
    return result.data[0] if result.data else {}


def _build_styles(accent=None):
    """Build paragraph styles. Pass accent= to set the document's key colour."""
    _accent = accent if accent is not None else BLUE_HEADER
    base    = getSampleStyleSheet()

    def ps(name, **kw):
        parent = kw.pop("parent", base["Normal"])
        return ParagraphStyle(name, parent=parent, **kw)

    return {
        "normal":    ps("pdf_normal",   fontSize=8,  leading=11, textColor=TEXT_DARK),
        "small":     ps("pdf_small",    fontSize=7,  leading=10, textColor=TEXT_MID),
        "label":     ps("pdf_label",    fontSize=7,  leading=10, textColor=TEXT_LIGHT),
        "bold":      ps("pdf_bold",     fontSize=8,  leading=11, fontName="Helvetica-Bold", textColor=TEXT_DARK),
        "bold_mid":  ps("pdf_bold_mid", fontSize=9,  leading=12, fontName="Helvetica-Bold", textColor=TEXT_DARK),
        "title":     ps("pdf_title",    fontSize=14, leading=17, fontName="Helvetica-Bold",
                        alignment=TA_CENTER, textColor=_accent),
        "subtitle":  ps("pdf_subtitle", fontSize=7.5, leading=10, fontName="Helvetica",
                        alignment=TA_CENTER, textColor=TEXT_LIGHT),
        "co_name":   ps("pdf_co_name",  fontSize=11, leading=14, fontName="Helvetica-Bold", textColor=TEXT_DARK),
        "r_normal":  ps("pdf_r_normal", fontSize=8,  leading=11, alignment=TA_RIGHT, textColor=TEXT_DARK),
        "r_bold":    ps("pdf_r_bold",   fontSize=9,  leading=12, fontName="Helvetica-Bold",
                        alignment=TA_RIGHT, textColor=TEXT_DARK),
        "r_large":   ps("pdf_r_large",  fontSize=10, leading=13, fontName="Helvetica-Bold",
                        alignment=TA_RIGHT, textColor=_accent),
        "footer":    ps("pdf_footer",   fontSize=7,  leading=10, textColor=TEXT_LIGHT),
        "c_normal":  ps("pdf_c_normal", fontSize=8,  leading=11, alignment=TA_CENTER, textColor=TEXT_DARK),
        "words":     ps("pdf_words",    fontSize=7.5, leading=10, fontName="Helvetica-Oblique",
                        textColor=TEXT_MID),
    }


def _watermark_fn(text: str, fill_color=None):
    """Return an onPage/onLaterPages callback that stamps a diagonal watermark."""
    from reportlab.lib.colors import Color
    wm_color = fill_color or Color(0.75, 0.75, 0.75, alpha=0.15)

    def draw(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica-Bold", 72)
        canvas.setFillColor(wm_color)
        canvas.translate(A4[0] / 2, A4[1] / 2)
        canvas.rotate(45)
        canvas.drawCentredString(0, 0, text)
        canvas.restoreState()

    return draw


def _fetch_logo(url: str):
    """Download logo bytes and return a ReportLab Image, or None."""
    try:
        data = httpx.get(url, timeout=5).content
        return Image(BytesIO(data), width=36 * mm, height=18 * mm, kind="proportional")
    except Exception:
        return None


def _seller_lines(our: dict, st: dict) -> list:
    """Return a list of Paragraph objects for the seller (left) column."""
    lines = []
    lines.append(Paragraph(_s(our.get("name")) or "Our Company", st["co_name"]))

    # Structured address (new fields); fall back to legacy address blob if not set
    line1 = _s(our.get("address_line1")) or _s(our.get("address"))
    line2 = _s(our.get("address_line2"))
    city    = _s(our.get("city"))
    pincode = _s(our.get("pincode"))

    if line1:
        lines.append(Paragraph(line1, st["normal"]))
    if line2:
        lines.append(Paragraph(line2, st["normal"]))

    city_pin = ""
    if city and pincode:
        city_pin = f"{city} – {pincode}"
    elif city:
        city_pin = city
    elif pincode:
        city_pin = pincode
    if city_pin:
        lines.append(Paragraph(city_pin, st["normal"]))

    parts = []
    if _s(our.get("gstin")):
        parts.append(f"GSTIN: {_s(our['gstin'])}")
    if _s(our.get("state_code")):
        parts.append(f"State: {_s(our['state_code'])}")
    if parts:
        lines.append(Paragraph(" │ ".join(parts), st["small"]))

    contact = []
    if _s(our.get("phone")):
        contact.append(f"Ph: {_s(our['phone'])}")
    if _s(our.get("email")):
        contact.append(_s(our["email"]))
    if contact:
        lines.append(Paragraph("  ".join(contact), st["small"]))

    return lines


def _invoice_detail_lines(invoice: dict, st: dict) -> list:
    """Return a list of Paragraph objects for the invoice meta (right) column."""
    lines = []

    def row(label, value):
        if value:
            lines.append(Paragraph(f"<b>{label}:</b> {value}", st["r_normal"]))

    row("Invoice No", _s(invoice.get("inv_no")))
    row("Date",       _s(invoice.get("date")))
    row("Due Date",   _s(invoice.get("due_date")) or "—")
    if _s(invoice.get("po_no")):
        row("PO No", _s(invoice["po_no"]))
    return lines


def _bill_to_lines(customer: dict, st: dict) -> list:
    """Return formatted address lines for the Bill To block."""
    lines = []
    lines.append(Paragraph("BILL TO", st["label"]))
    lines.append(Paragraph(_s(customer.get("name")) or "—", st["bold_mid"]))

    addr = _s(customer.get("address"))
    if addr:
        lines.append(Paragraph(addr, st["normal"]))

    city     = _s(customer.get("city"))
    pincode  = _s(customer.get("pincode"))
    city_pin = ""
    if city and pincode:
        city_pin = f"{city} – {pincode}"
    elif city:
        city_pin = city
    elif pincode:
        city_pin = pincode
    if city_pin:
        lines.append(Paragraph(city_pin, st["normal"]))

    meta = []
    if _s(customer.get("state_code")):
        meta.append(f"State: {_s(customer['state_code'])}")
    gstin = _s(customer.get("gstin"))
    if gstin:
        meta.append(f"GSTIN: {gstin}")
    else:
        meta.append("GSTIN: URP")
    if meta:
        lines.append(Paragraph(" │ ".join(meta), st["small"]))

    phone = _s(customer.get("phone"))
    email = _s(customer.get("email"))
    contact = []
    if phone:
        contact.append(f"Ph: {phone}")
    if email:
        contact.append(email)
    if contact:
        lines.append(Paragraph("  ".join(contact), st["small"]))

    return lines


def _cell(paragraphs: list, padding: int = 5) -> list:
    """Wrap a list of paragraphs in a single-cell inner table for uniform padding."""
    return paragraphs   # used directly in table cells; padding handled by TableStyle


# ─── Main generator ───────────────────────────────────────────────────────────

def generate_invoice_pdf(invoice: dict) -> bytes:
    buf    = BytesIO()
    doc    = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=L_MARGIN, rightMargin=R_MARGIN,
        topMargin=14 * mm, bottomMargin=14 * mm,
    )
    st    = _build_styles(accent=INV_ACCENT)
    story = []

    our      = _get_company_settings()
    customer = invoice.get("companies") or {}
    status   = _s(invoice.get("status"))

    # Watermark callback based on invoice status
    from reportlab.lib.colors import Color
    _wm = None
    if status == "paid":
        _wm = _watermark_fn("PAID",      Color(0.06, 0.47, 0.07, alpha=0.18))
    elif status == "cancelled":
        _wm = _watermark_fn("CANCELLED", Color(0.8, 0.1, 0.1, alpha=0.15))
    elif status == "draft":
        _wm = _watermark_fn("DRAFT")
    elif status == "overdue":
        _wm = _watermark_fn("OVERDUE",   Color(0.8, 0.2, 0.0, alpha=0.15))

    # ── 1. Title bar ────────────────────────────────────────────────────────
    logo_el = _fetch_logo(_s(our.get("logo_url"))) if _s(our.get("logo_url")) else None

    title_para = Paragraph("TAX INVOICE", st["title"])

    if logo_el:
        title_row = Table(
            [[logo_el, title_para, ""]],
            colWidths=[38 * mm, USABLE_W - 76 * mm, 38 * mm],
        )
        title_row.setStyle(TableStyle([
            ("VALIGN",  (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN",   (1, 0), (1, 0),   "CENTER"),
            ("ALIGN",   (2, 0), (2, 0),   "RIGHT"),
            ("TOPPADDING",    (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        story.append(title_row)
    else:
        story.append(title_para)

    story.append(Spacer(1, 3 * mm))

    # ── 2. Seller + Invoice details header box ───────────────────────────────
    LEFT_W  = USABLE_W * 0.56
    RIGHT_W = USABLE_W - LEFT_W

    seller_content   = _seller_lines(our, st)
    invoice_content  = _invoice_detail_lines(invoice, st)

    header_data = [[seller_content, invoice_content]]
    header_table = Table(header_data, colWidths=[LEFT_W, RIGHT_W])
    header_table.setStyle(TableStyle([
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("BOX",           (0, 0), (-1, -1), 0.6, GREY_BORDER),
        ("LINEBEFORE",    (1, 0), (1, -1),  0.5, GREY_BORDER),
        ("BACKGROUND",    (0, 0), (-1, -1), INV_LIGHT),
        ("TOPPADDING",    (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING",   (0, 0), (-1, -1), 7),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 7),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 2 * mm))

    # ── 3. Bill To box ──────────────────────────────────────────────────────
    bill_content  = _bill_to_lines(customer, st)
    bill_data     = [[bill_content]]
    bill_table    = Table(bill_data, colWidths=[USABLE_W * 0.55])
    bill_table.setStyle(TableStyle([
        ("BOX",           (0, 0), (-1, -1), 0.6, GREY_BORDER),
        ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING",   (0, 0), (-1, -1), 7),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 7),
    ]))
    story.append(bill_table)
    story.append(Spacer(1, 4 * mm))

    # ── 4. Items table ──────────────────────────────────────────────────────
    col_headers = ["#", "Description", "HSN", "Qty", "Unit", "Rate", "Amount", "GST %", "Tax", "Total"]
    col_widths  = [7*mm, 46*mm, 14*mm, 11*mm, 10*mm, 17*mm, 17*mm, 11*mm, 17*mm, 19*mm]

    rows = [col_headers]
    for idx, item in enumerate(invoice.get("invoice_items", []), 1):
        qty  = Decimal(str(item.get("qty")  or 0))
        rate = Decimal(str(item.get("rate") or 0))
        amt  = qty * rate
        cgst = Decimal(str(item.get("cgst_amt") or 0))
        sgst = Decimal(str(item.get("sgst_amt") or 0))
        igst = Decimal(str(item.get("igst_amt") or 0))
        tax  = cgst + sgst + igst
        rows.append([
            str(idx),
            _s(item.get("description")),
            _s(item.get("hsn_code")),
            _s(item.get("qty")),
            _s(item.get("uom")),
            f"{Decimal(str(item.get('rate') or 0)):,.2f}",
            f"{amt:,.2f}",
            f"{_s(item.get('gst_rate'))}%",
            f"{tax:,.2f}",
            f"{amt + tax:,.2f}",
        ])

    item_table = Table(rows, colWidths=col_widths, repeatRows=1)
    item_table.setStyle(TableStyle([
        # Header row
        ("BACKGROUND",    (0, 0), (-1, 0),  INV_ACCENT),
        ("TEXTCOLOR",     (0, 0), (-1, 0),  colors.white),
        ("FONTNAME",      (0, 0), (-1, 0),  "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1, 0),  7.5),
        ("ALIGN",         (0, 0), (-1, 0),  "CENTER"),
        ("TOPPADDING",    (0, 0), (-1, 0),  5),
        ("BOTTOMPADDING", (0, 0), (-1, 0),  5),
        # Body rows
        ("FONTSIZE",      (0, 1), (-1, -1), 7.5),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [colors.white, GREY_ALT_ROW]),
        ("GRID",          (0, 0), (-1, -1), 0.3, GREY_BORDER),
        # Right-align numeric columns (Qty, Rate, Amount, GST%, Tax, Total)
        ("ALIGN",         (3, 1), (-1, -1), "RIGHT"),
        ("ALIGN",         (0, 1), (0, -1),  "CENTER"),   # row #
        ("TOPPADDING",    (0, 1), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 4),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 4),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(item_table)
    story.append(Spacer(1, 4 * mm))

    # ── 5. Totals block ─────────────────────────────────────────────────────
    # Aligned to the right half of the page
    T_LABEL_W = 60 * mm
    T_VALUE_W = 45 * mm
    T_TOTAL_W = T_LABEL_W + T_VALUE_W

    def _trow(label, value, label_style="normal", value_style="r_normal"):
        return [Paragraph(label, st[label_style]), Paragraph(value, st[value_style])]

    taxable   = Decimal(str(invoice.get("taxable_amt") or 0))
    cgst_amt  = Decimal(str(invoice.get("cgst")        or 0))
    sgst_amt  = Decimal(str(invoice.get("sgst")        or 0))
    igst_amt  = Decimal(str(invoice.get("igst")        or 0))
    total     = Decimal(str(invoice.get("total")       or 0))
    paid      = Decimal(str(invoice.get("amount_paid") or 0))
    balance   = max(Decimal("0"), total - paid)

    totals_rows = []
    totals_rows.append(_trow("Taxable Amount", _money(taxable)))

    if cgst_amt > 0:
        totals_rows.append(_trow("CGST", _money(cgst_amt)))
    if sgst_amt > 0:
        totals_rows.append(_trow("SGST", _money(sgst_amt)))
    if igst_amt > 0:
        totals_rows.append(_trow("IGST", _money(igst_amt)))

    # Separator + Grand Total
    totals_rows.append(["", ""])   # blank spacer row
    blank_idx = len(totals_rows) - 1
    totals_rows.append(_trow("<b>Grand Total</b>", f"<b>{_money(total)}</b>", "bold", "r_bold"))
    grand_idx = len(totals_rows) - 1

    # Amount in Words — full-width spanning row
    words_text = _amount_in_words(total)
    totals_rows.append([Paragraph(f"<i>{words_text}</i>", st["words"]), ""])
    words_idx = len(totals_rows) - 1

    totals_rows.append(_trow("Amount Paid", _money(paid)))

    balance_label = Paragraph("<b>Balance Due</b>", st["bold"])
    balance_value = Paragraph(f"<b>{_money(balance)}</b>", st["r_large"])
    totals_rows.append([balance_label, balance_value])
    balance_idx = len(totals_rows) - 1

    totals_table = Table(totals_rows, colWidths=[T_LABEL_W, T_VALUE_W], hAlign="RIGHT")
    totals_table.setStyle(TableStyle([
        ("FONTSIZE",      (0, 0), (-1, -1), 8),
        ("TOPPADDING",    (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING",   (0, 0), (-1, -1), 5),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 5),
        ("ALIGN",         (1, 0), (1, -1),  "RIGHT"),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        # Amount in Words spans full width
        ("SPAN",          (0, words_idx), (1, words_idx)),
        ("BACKGROUND",    (0, words_idx), (-1, words_idx), colors.HexColor("#f8f8f4")),
        ("TOPPADDING",    (0, words_idx), (-1, words_idx), 4),
        ("BOTTOMPADDING", (0, words_idx), (-1, words_idx), 4),
        # Top border on Grand Total row
        ("LINEABOVE",     (0, grand_idx), (-1, grand_idx), 0.8, GREY_BORDER),
        # Top border above Balance Due
        ("LINEABOVE",     (0, balance_idx), (-1, balance_idx), 0.5, GREY_BORDER),
        # Highlight Balance Due row
        ("BACKGROUND",    (0, balance_idx), (-1, balance_idx), HIGHLIGHT_BG),
        ("FONTNAME",      (0, grand_idx),   (-1, grand_idx),   "Helvetica-Bold"),
        # Outer box
        ("BOX",           (0, 0), (-1, -1), 0.5, GREY_BORDER),
        # Blank spacer
        ("TOPPADDING",    (0, blank_idx), (-1, blank_idx), 1),
        ("BOTTOMPADDING", (0, blank_idx), (-1, blank_idx), 1),
    ]))
    story.append(totals_table)

    # ── 6. IRN / E-way bill ─────────────────────────────────────────────────
    if _s(invoice.get("irn")) or _s(invoice.get("ewb_no")):
        story.append(Spacer(1, 3 * mm))
        if _s(invoice.get("irn")):
            story.append(Paragraph(f"<b>IRN:</b> {_s(invoice['irn'])}", st["small"]))
        if _s(invoice.get("ewb_no")):
            story.append(Paragraph(f"<b>E-Way Bill No:</b> {_s(invoice['ewb_no'])}", st["small"]))

    # ── 7. Footer: bank details + signature ─────────────────────────────────
    story.append(Spacer(1, 6 * mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=GREY_BORDER))
    story.append(Spacer(1, 3 * mm))

    bank_parts = []
    if _s(our.get("bank_name")):
        bank_parts.append(f"<b>Bank:</b> {_s(our['bank_name'])}")
    if _s(our.get("bank_account")):
        bank_parts.append(f"<b>A/C:</b> {_s(our['bank_account'])}")
    if _s(our.get("bank_ifsc")):
        bank_parts.append(f"<b>IFSC:</b> {_s(our['bank_ifsc'])}")
    if _s(our.get("upi_id")):
        bank_parts.append(f"<b>UPI:</b> {_s(our['upi_id'])}")

    co_name  = _s(our.get("name")) or "Company"
    sig_text = (
        f"For <b>{co_name}</b><br/>"
        "<br/><br/>"
        "________________________________<br/>"
        "<b>Authorised Signatory</b>"
    )

    bank_para = Paragraph(
        "  │  ".join(bank_parts) if bank_parts else " ",
        st["footer"]
    )
    sig_para  = Paragraph(sig_text, ParagraphStyle(
        "sig", parent=st["small"], alignment=TA_RIGHT, leading=11
    ))

    footer_data  = [[bank_para, sig_para]]
    footer_table = Table(footer_data, colWidths=[USABLE_W * 0.62, USABLE_W * 0.38])
    footer_table.setStyle(TableStyle([
        ("VALIGN",  (0, 0), (-1, -1), "BOTTOM"),
        ("ALIGN",   (1, 0), (1, -1),  "RIGHT"),
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
    ]))
    story.append(footer_table)

    # ── 8. Build PDF ────────────────────────────────────────────────────────
    if _wm:
        doc.build(story, onFirstPage=_wm, onLaterPages=_wm)
    else:
        doc.build(story)
    return buf.getvalue()
