"""Credit Note PDF generator using ReportLab."""
from io import BytesIO
from decimal import Decimal
import httpx
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT

RED = colors.HexColor("#dc2626")


def _get_company_settings() -> dict:
    from app.db.client import get_db
    result = get_db().table("company_settings").select("*").limit(1).execute()
    return result.data[0] if result.data else {}


def generate_credit_note_pdf(cn: dict) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=15*mm, rightMargin=15*mm, topMargin=15*mm, bottomMargin=15*mm)
    styles = getSampleStyleSheet()
    bold = ParagraphStyle("bold", parent=styles["Normal"], fontName="Helvetica-Bold")
    right = ParagraphStyle("right", parent=styles["Normal"], alignment=TA_RIGHT)
    small = ParagraphStyle("small", parent=styles["Normal"], fontSize=8)
    story = []

    our = _get_company_settings()
    customer = cn.get("companies") or {}
    linked_inv = cn.get("invoices") or {}

    # Logo + title
    logo_element = None
    if our.get("logo_url"):
        try:
            img_bytes = httpx.get(our["logo_url"], timeout=5).content
            logo_element = Image(BytesIO(img_bytes), width=30*mm, height=15*mm, kind="proportional")
        except Exception:
            pass

    title_para = Paragraph("CREDIT NOTE", ParagraphStyle("h1", parent=bold, fontSize=14, textColor=RED, alignment=TA_CENTER))
    if logo_element:
        top_row = Table([[logo_element, title_para, ""]], colWidths=[35*mm, 110*mm, 35*mm])
        top_row.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("ALIGN", (1, 0), (1, 0), "CENTER")]))
        story.append(top_row)
    else:
        story.append(title_para)
    story.append(Spacer(1, 4*mm))

    # Seller + CN details side by side
    seller_text = (
        f"<b>{our.get('name', 'Our Company')}</b><br/>"
        f"{our.get('address', '')}<br/>"
        f"GSTIN: {our.get('gstin', '')}<br/>"
        f"State Code: {our.get('state_code', '')}"
    )
    inv_ref = linked_inv.get("inv_no", "—") if linked_inv else "—"
    cn_text = (
        f"<b>Credit Note No:</b> {cn.get('cn_no', 'N/A')}<br/>"
        f"<b>Date:</b> {cn.get('date', '')}<br/>"
        f"<b>Against Invoice:</b> {inv_ref}<br/>"
        f"<b>Reason:</b> {cn.get('reason', '—')}"
    )
    header_table = Table(
        [[Paragraph(seller_text, styles["Normal"]), Paragraph(cn_text, styles["Normal"])]],
        colWidths=[95*mm, 85*mm],
    )
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.grey),
        ("LINEAFTER", (0, 0), (0, -1), 0.5, colors.grey),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 3*mm))

    # Bill To
    bill_to = (
        f"<b>Credit Issued To:</b><br/>"
        f"{customer.get('name', '')}<br/>"
        f"{customer.get('address', '')}<br/>"
        f"GSTIN: {customer.get('gstin', 'URP')}"
    )
    story.append(Paragraph(bill_to, styles["Normal"]))
    story.append(Spacer(1, 4*mm))

    # Determine intra/inter state for column headers
    place_of_supply = cn.get("place_of_supply", "27")
    our_state = our.get("state_code", "27")
    intra = our_state == place_of_supply

    if intra:
        col_headers = ["#", "Description", "HSN", "Qty", "Unit", "Rate", "Taxable", "CGST", "SGST", "Total"]
        col_widths = [7*mm, 45*mm, 14*mm, 11*mm, 10*mm, 16*mm, 18*mm, 16*mm, 16*mm, 18*mm]
    else:
        col_headers = ["#", "Description", "HSN", "Qty", "Unit", "Rate", "Taxable", "IGST", "Total"]
        col_widths = [7*mm, 52*mm, 14*mm, 11*mm, 10*mm, 18*mm, 20*mm, 18*mm, 21*mm]

    rows = [col_headers]
    for idx, item in enumerate(cn.get("credit_note_items", []), 1):
        if intra:
            rows.append([
                str(idx), item.get("description", ""), item.get("hsn_code", ""),
                str(item.get("qty", "")), item.get("uom", ""),
                f"{Decimal(str(item.get('rate', 0))):,.2f}",
                f"{Decimal(str(item.get('taxable_amt', 0))):,.2f}",
                f"{Decimal(str(item.get('cgst_amt', 0))):,.2f}",
                f"{Decimal(str(item.get('sgst_amt', 0))):,.2f}",
                f"{Decimal(str(item.get('total', 0))):,.2f}",
            ])
        else:
            rows.append([
                str(idx), item.get("description", ""), item.get("hsn_code", ""),
                str(item.get("qty", "")), item.get("uom", ""),
                f"{Decimal(str(item.get('rate', 0))):,.2f}",
                f"{Decimal(str(item.get('taxable_amt', 0))):,.2f}",
                f"{Decimal(str(item.get('igst_amt', 0))):,.2f}",
                f"{Decimal(str(item.get('total', 0))):,.2f}",
            ])

    item_table = Table(rows, colWidths=col_widths, repeatRows=1)
    item_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), RED),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fff5f5")]),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.grey),
        ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
        ("PADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(item_table)
    story.append(Spacer(1, 4*mm))

    # Totals
    totals_data = [
        ["Taxable Amount", f"₹ {Decimal(str(cn.get('taxable_amt', 0))):,.2f}"],
    ]
    if intra:
        totals_data += [
            ["CGST", f"₹ {Decimal(str(cn.get('cgst_amt', 0))):,.2f}"],
            ["SGST", f"₹ {Decimal(str(cn.get('sgst_amt', 0))):,.2f}"],
        ]
    else:
        totals_data.append(["IGST", f"₹ {Decimal(str(cn.get('igst_amt', 0))):,.2f}"])
    totals_data.append(["", ""])
    totals_data.append([
        Paragraph("<b>Credit Amount</b>", bold),
        Paragraph(f"<b>₹ {Decimal(str(cn.get('total', 0))):,.2f}</b>", right),
    ])
    totals_table = Table(totals_data, colWidths=[80*mm, 60*mm], hAlign="RIGHT")
    totals_table.setStyle(TableStyle([
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("LINEABOVE", (-1, -1), (-1, -1), 0.5, colors.black),
        ("PADDING", (0, 0), (-1, -1), 3),
        ("TEXTCOLOR", (-1, -1), (-1, -1), RED),
    ]))
    story.append(totals_table)
    story.append(Spacer(1, 6*mm))
    story.append(Paragraph("This is a Credit Note issued in accordance with GST regulations.", small))

    doc.build(story)
    return buf.getvalue()
