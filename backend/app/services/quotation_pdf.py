"""Quotation PDF generator using ReportLab."""
from io import BytesIO
from decimal import Decimal
import httpx
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_CENTER


def _get_company_settings() -> dict:
    from app.db.client import get_db
    result = get_db().table("company_settings").select("*").limit(1).execute()
    return result.data[0] if result.data else {}


def generate_quotation_pdf(quotation: dict) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=15*mm, rightMargin=15*mm, topMargin=15*mm, bottomMargin=15*mm)
    styles = getSampleStyleSheet()
    story = []

    bold = ParagraphStyle("bold", parent=styles["Normal"], fontName="Helvetica-Bold")
    right = ParagraphStyle("right", parent=styles["Normal"], alignment=TA_RIGHT)
    small = ParagraphStyle("small", parent=styles["Normal"], fontSize=8)

    our = _get_company_settings()
    customer = quotation.get("companies", {})

    # Logo + title row
    logo_element = None
    if our.get("logo_url"):
        try:
            img_bytes = httpx.get(our["logo_url"], timeout=5).content
            logo_element = Image(BytesIO(img_bytes), width=30*mm, height=15*mm, kind="proportional")
        except Exception:
            logo_element = None

    title_para = Paragraph("QUOTATION", ParagraphStyle("h1", parent=bold, fontSize=14, alignment=TA_CENTER))
    if logo_element:
        top_row = Table([[logo_element, title_para, ""]], colWidths=[35*mm, 110*mm, 35*mm])
        top_row.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("ALIGN", (1, 0), (1, 0), "CENTER")]))
        story.append(top_row)
    else:
        story.append(title_para)
    story.append(Spacer(1, 4*mm))

    # Seller + Quotation details side by side
    seller_text = (
        f"<b>{our.get('name', 'Our Company')}</b><br/>"
        f"{our.get('address', '')}<br/>"
        f"GSTIN: {our.get('gstin', '')}<br/>"
        f"State: {our.get('state_code', '')}"
    )
    quot_text = (
        f"<b>Quotation No:</b> {quotation.get('quot_no', 'N/A')}<br/>"
        f"<b>Date:</b> {quotation.get('date', '')}<br/>"
        f"<b>Valid Until:</b> {quotation.get('valid_until', '-')}"
    )
    header_data = [[
        Paragraph(seller_text, styles["Normal"]),
        Paragraph(quot_text, styles["Normal"]),
    ]]
    header_table = Table(header_data, colWidths=[95*mm, 85*mm])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.grey),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 3*mm))

    # Bill To
    bill_to = (
        f"<b>To:</b><br/>"
        f"{customer.get('name', '')}<br/>"
        f"{customer.get('address', '')}<br/>"
        f"GSTIN: {customer.get('gstin', 'URP')}"
    )
    story.append(Paragraph(bill_to, styles["Normal"]))
    story.append(Spacer(1, 4*mm))

    # Items table — no tax breakdown columns, just Taxable + GST% + Total
    col_headers = ["#", "Description", "HSN", "Qty", "Unit", "Rate", "Taxable", "GST%", "Total"]
    rows = [col_headers]
    for idx, item in enumerate(quotation.get("quotation_items", []), 1):
        qty = Decimal(str(item["qty"]))
        rate = Decimal(str(item["rate"]))
        gst_rate = Decimal(str(item["gst_rate"]))
        taxable = qty * rate
        gst_amt = taxable * gst_rate / 100
        rows.append([
            str(idx),
            item["description"],
            item["hsn_code"],
            str(item["qty"]),
            item["uom"],
            f"{rate:,.2f}",
            f"{taxable:,.2f}",
            f"{gst_rate}%",
            f"{taxable + gst_amt:,.2f}",
        ])

    col_widths = [8*mm, 50*mm, 15*mm, 12*mm, 10*mm, 18*mm, 20*mm, 12*mm, 20*mm]
    item_table = Table(rows, colWidths=col_widths, repeatRows=1)
    item_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2563eb")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.grey),
        ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
        ("PADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(item_table)
    story.append(Spacer(1, 4*mm))

    # Totals
    totals_data = [
        ["Taxable Amount", f"₹ {Decimal(str(quotation.get('taxable_amt', 0))):,.2f}"],
        ["GST", f"₹ {Decimal(str(quotation.get('total_gst', 0))):,.2f}"],
        ["", ""],
        [Paragraph("<b>Total</b>", bold), Paragraph(f"<b>₹ {Decimal(str(quotation.get('total', 0))):,.2f}</b>", right)],
    ]
    totals_table = Table(totals_data, colWidths=[80*mm, 60*mm], hAlign="RIGHT")
    totals_table.setStyle(TableStyle([
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("LINEABOVE", (-1, -1), (-1, -1), 0.5, colors.black),
        ("PADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(totals_table)

    # Terms & Conditions
    if quotation.get("terms"):
        story.append(Spacer(1, 6*mm))
        story.append(Paragraph("<b>Terms &amp; Conditions</b>", bold))
        story.append(Spacer(1, 2*mm))
        story.append(Paragraph(quotation["terms"], small))

    # Notes
    if quotation.get("notes"):
        story.append(Spacer(1, 4*mm))
        story.append(Paragraph("<b>Notes</b>", bold))
        story.append(Spacer(1, 2*mm))
        story.append(Paragraph(quotation["notes"], small))

    doc.build(story)
    return buf.getvalue()
