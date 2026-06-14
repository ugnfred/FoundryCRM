"""GRN PDF generator using ReportLab."""
from io import BytesIO
from decimal import Decimal
import httpx
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT

GREEN = colors.HexColor("#059669")


def _get_company_settings() -> dict:
    from app.db.client import get_db
    result = get_db().table("company_settings").select("*").limit(1).execute()
    return result.data[0] if result.data else {}


def generate_grn_pdf(grn: dict) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=15*mm, rightMargin=15*mm, topMargin=15*mm, bottomMargin=15*mm)
    styles = getSampleStyleSheet()
    bold = ParagraphStyle("bold", parent=styles["Normal"], fontName="Helvetica-Bold")
    small = ParagraphStyle("small", parent=styles["Normal"], fontSize=8)
    story = []

    our = _get_company_settings()
    po = grn.get("purchase_orders") or {}
    supplier = po.get("companies") or {}

    # Header bar
    title_data = [[Paragraph("GOODS RECEIPT NOTE", ParagraphStyle(
        "title", parent=bold, fontSize=14, textColor=colors.white, alignment=TA_CENTER
    ))]]
    title_table = Table(title_data, colWidths=[180*mm])
    title_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GREEN),
        ("PADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(title_table)
    story.append(Spacer(1, 4*mm))

    # Meta block: our company left, GRN details right
    our_text = (
        f"<b>{our.get('name', 'Our Company')}</b><br/>"
        f"{our.get('address', '')}<br/>"
        f"GSTIN: {our.get('gstin', '')}"
    )
    grn_text = (
        f"<b>GRN No:</b> {grn.get('grn_no', 'N/A')}<br/>"
        f"<b>PO No:</b> {po.get('po_no', '—')}<br/>"
        f"<b>Received Date:</b> {grn.get('received_date', '')}"
    )
    meta_table = Table(
        [[Paragraph(our_text, styles["Normal"]), Paragraph(grn_text, styles["Normal"])]],
        colWidths=[95*mm, 85*mm],
    )
    meta_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.grey),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 3*mm))

    # Supplier block
    supplier_text = (
        f"<b>Received From (Supplier):</b><br/>"
        f"{supplier.get('name', '')}<br/>"
        f"{supplier.get('address', '')}<br/>"
        f"GSTIN: {supplier.get('gstin', 'URP')}"
    )
    story.append(Paragraph(supplier_text, styles["Normal"]))
    story.append(Spacer(1, 4*mm))

    # Items table
    col_headers = ["#", "Product / Description", "HSN Code", "UOM", "Qty Ordered", "Qty Received"]
    rows = [col_headers]
    for idx, item in enumerate(grn.get("grn_items", []), 1):
        product = item.get("products") or {}
        po_item = {}  # po_item qty would require a join — show qty_received and note ordered separately
        rows.append([
            str(idx),
            product.get("name", item.get("description", "")),
            product.get("hsn_code", ""),
            product.get("uom", ""),
            "—",
            str(item.get("qty_received", "")),
        ])

    col_widths = [8*mm, 65*mm, 20*mm, 15*mm, 30*mm, 30*mm]
    item_table = Table(rows, colWidths=col_widths, repeatRows=1)
    item_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), GREEN),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f0fdf4")]),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.grey),
        ("ALIGN", (4, 0), (-1, -1), "RIGHT"),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(item_table)
    story.append(Spacer(1, 6*mm))

    # Notes
    if grn.get("notes"):
        story.append(Paragraph(f"<b>Notes:</b> {grn['notes']}", small))
        story.append(Spacer(1, 4*mm))

    # Signature block
    sig_data = [[
        Paragraph("Received by:<br/><br/>___________________________<br/>Name &amp; Signature", small),
        Paragraph("Verified by:<br/><br/>___________________________<br/>Store Keeper", small),
        Paragraph("Date:<br/><br/>___________________________", small),
    ]]
    sig_table = Table(sig_data, colWidths=[60*mm, 60*mm, 60*mm])
    sig_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, colors.grey),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.grey),
        ("PADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(sig_table)
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph("E. &amp; O.E. — This document is for internal record purposes only.", small))

    doc.build(story)
    return buf.getvalue()
