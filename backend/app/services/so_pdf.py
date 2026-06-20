"""Sales Order PDF — matches the Tax Invoice and Quotation layout."""
from io import BytesIO
from decimal import Decimal
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable

from app.services.pdf import (
    _s, _money, _get_company_settings, _build_styles,
    _seller_lines, _bill_to_lines, _fetch_logo,
    BLUE_HEADER, BLUE_LIGHT, GREY_BORDER, GREY_ALT_ROW,
    TEXT_LIGHT, L_MARGIN, R_MARGIN, USABLE_W,
)


def generate_so_pdf(so: dict) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=L_MARGIN, rightMargin=R_MARGIN,
        topMargin=14 * mm, bottomMargin=14 * mm,
    )
    st    = _build_styles()
    story = []

    our      = _get_company_settings()
    customer = so.get("companies") or {}

    # ── 1. Title bar ────────────────────────────────────────────────────────
    title_para = Paragraph("SALES ORDER", st["title"])

    logo_el = _fetch_logo(_s(our.get("logo_url"))) if _s(our.get("logo_url")) else None
    if logo_el:
        title_row = Table(
            [[logo_el, title_para, ""]],
            colWidths=[38 * mm, USABLE_W - 76 * mm, 38 * mm],
        )
        title_row.setStyle(TableStyle([
            ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN",         (1, 0), (1,  0),  "CENTER"),
            ("TOPPADDING",    (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        story.append(title_row)
    else:
        story.append(title_para)

    story.append(Spacer(1, 3 * mm))

    # ── 2. Seller + SO meta header box ───────────────────────────────────────
    LEFT_W  = USABLE_W * 0.56
    RIGHT_W = USABLE_W - LEFT_W

    def _so_meta_lines(s: dict, st: dict) -> list:
        lines = []
        def row(label, value):
            if value:
                lines.append(Paragraph(f"<b>{label}:</b> {value}", st["r_normal"]))
        row("Order No",      _s(s.get("so_no")))
        row("Date",          _s(s.get("date")))
        row("Delivery Date", _s(s.get("delivery_date")) or "—")
        row("PO Reference",  _s(s.get("po_reference")))
        return lines

    header_data  = [[_seller_lines(our, st), _so_meta_lines(so, st)]]
    header_table = Table(header_data, colWidths=[LEFT_W, RIGHT_W])
    header_table.setStyle(TableStyle([
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("BOX",           (0, 0), (-1, -1), 0.6, GREY_BORDER),
        ("LINEBEFORE",    (1, 0), (1,  -1), 0.5, GREY_BORDER),
        ("BACKGROUND",    (0, 0), (-1, -1), BLUE_LIGHT),
        ("TOPPADDING",    (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING",   (0, 0), (-1, -1), 7),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 7),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 2 * mm))

    # ── 3. Bill To box ───────────────────────────────────────────────────────
    bill_data  = [[_bill_to_lines(customer, st)]]
    bill_table = Table(bill_data, colWidths=[USABLE_W * 0.55])
    bill_table.setStyle(TableStyle([
        ("BOX",           (0, 0), (-1, -1), 0.6, GREY_BORDER),
        ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING",   (0, 0), (-1, -1), 7),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 7),
    ]))
    story.append(bill_table)
    story.append(Spacer(1, 4 * mm))

    # ── 4. Items table ───────────────────────────────────────────────────────
    col_headers = ["#", "Description", "HSN", "Qty", "Unit", "Rate", "Taxable", "GST %", "Total"]
    col_widths  = [7*mm, 50*mm, 15*mm, 12*mm, 10*mm, 18*mm, 20*mm, 12*mm, 21*mm]

    rows = [col_headers]
    for idx, item in enumerate(so.get("so_items", []), 1):
        qty      = Decimal(str(item.get("qty")      or 0))
        rate     = Decimal(str(item.get("rate")     or 0))
        gst_rate = Decimal(str(item.get("gst_rate") or 0))
        taxable  = qty * rate
        gst_amt  = taxable * gst_rate / 100
        rows.append([
            str(idx),
            _s(item.get("description")),
            _s(item.get("hsn_code")),
            f"{qty:,.3f}".rstrip("0").rstrip("."),
            _s(item.get("uom")),
            f"{rate:,.2f}",
            f"{taxable:,.2f}",
            f"{gst_rate}%",
            f"{taxable + gst_amt:,.2f}",
        ])

    item_table = Table(rows, colWidths=col_widths, repeatRows=1)
    item_table.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0),  BLUE_HEADER),
        ("TEXTCOLOR",     (0, 0), (-1, 0),  colors.white),
        ("FONTNAME",      (0, 0), (-1, 0),  "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1, -1), 7.5),
        ("ALIGN",         (0, 0), (-1, 0),  "CENTER"),
        ("TOPPADDING",    (0, 0), (-1, 0),  5),
        ("BOTTOMPADDING", (0, 0), (-1, 0),  5),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [colors.white, GREY_ALT_ROW]),
        ("GRID",          (0, 0), (-1, -1), 0.3, GREY_BORDER),
        ("ALIGN",         (3, 1), (-1, -1), "RIGHT"),
        ("ALIGN",         (0, 1), (0,  -1), "CENTER"),
        ("TOPPADDING",    (0, 1), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 4),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 4),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(item_table)
    story.append(Spacer(1, 4 * mm))

    # ── 5. Totals block ──────────────────────────────────────────────────────
    T_LABEL_W = 60 * mm
    T_VALUE_W = 45 * mm

    def _trow(label, value, ls="normal", vs="r_normal"):
        return [Paragraph(label, st[ls]), Paragraph(value, st[vs])]

    taxable_amt = Decimal(str(so.get("taxable_amt") or 0))
    total_gst   = Decimal(str(so.get("total_gst")   or 0))
    total       = Decimal(str(so.get("total")        or 0))

    totals_rows = [
        _trow("Taxable Amount", _money(taxable_amt)),
        _trow("GST",            _money(total_gst)),
        ["", ""],
        _trow("<b>Grand Total</b>", f"<b>{_money(total)}</b>", "bold", "r_bold"),
    ]

    totals_table = Table(totals_rows, colWidths=[T_LABEL_W, T_VALUE_W], hAlign="RIGHT")
    totals_table.setStyle(TableStyle([
        ("FONTSIZE",      (0, 0), (-1, -1), 8),
        ("TOPPADDING",    (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING",   (0, 0), (-1, -1), 5),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 5),
        ("ALIGN",         (1, 0), (1,  -1), "RIGHT"),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("LINEABOVE",     (0, 3), (-1, 3),  0.8, GREY_BORDER),
        ("FONTNAME",      (0, 3), (-1, 3),  "Helvetica-Bold"),
        ("BOX",           (0, 0), (-1, -1), 0.5, GREY_BORDER),
        ("TOPPADDING",    (0, 2), (-1, 2),  1),
        ("BOTTOMPADDING", (0, 2), (-1, 2),  1),
    ]))
    story.append(totals_table)

    # ── 6. Terms & Notes ────────────────────────────────────────────────────
    if _s(so.get("terms")) or _s(so.get("notes")):
        story.append(Spacer(1, 6 * mm))
        story.append(HRFlowable(width="100%", thickness=0.5, color=GREY_BORDER))
        story.append(Spacer(1, 3 * mm))
        if _s(so.get("terms")):
            story.append(Paragraph("<b>Terms &amp; Conditions</b>", st["bold"]))
            story.append(Spacer(1, 2 * mm))
            story.append(Paragraph(_s(so["terms"]), st["small"]))
        if _s(so.get("notes")):
            story.append(Spacer(1, 4 * mm))
            story.append(Paragraph("<b>Notes</b>", st["bold"]))
            story.append(Spacer(1, 2 * mm))
            story.append(Paragraph(_s(so["notes"]), st["small"]))

    # ── 7. Footer ────────────────────────────────────────────────────────────
    story.append(Spacer(1, 6 * mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=GREY_BORDER))
    story.append(Spacer(1, 3 * mm))

    co_name  = _s(our.get("name")) or "Company"
    sig_text = (
        f"For <b>{co_name}</b><br/><br/><br/>"
        "________________________________<br/>"
        "<b>Authorised Signatory</b>"
    )
    delivery = _s(so.get("delivery_date")) or "as agreed"
    footer_left = (
        f"Expected delivery: <b>{delivery}</b>.<br/>"
        "This is a confirmed order — please arrange dispatch accordingly."
    )

    footer_data  = [[Paragraph(footer_left, st["footer"]), Paragraph(sig_text, st["small"])]]
    footer_table = Table(footer_data, colWidths=[USABLE_W * 0.62, USABLE_W * 0.38])
    footer_table.setStyle(TableStyle([
        ("VALIGN",        (0, 0), (-1, -1), "BOTTOM"),
        ("ALIGN",         (1, 0), (1,  -1), "RIGHT"),
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
    ]))
    story.append(footer_table)

    doc.build(story)
    return buf.getvalue()
