"""Delivery Challan PDF generation."""
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT


BLUE = colors.HexColor("#1a56db")
LIGHT_BLUE = colors.HexColor("#eff6ff")
GREY = colors.HexColor("#6b7280")


def generate_dc_pdf(dc: dict, company_settings: dict) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            topMargin=15*mm, bottomMargin=15*mm,
                            leftMargin=15*mm, rightMargin=15*mm)
    story = []

    normal = ParagraphStyle("n", fontSize=8, leading=11)
    bold = ParagraphStyle("b", fontSize=8, leading=11, fontName="Helvetica-Bold")
    small_grey = ParagraphStyle("sg", fontSize=7, leading=10, textColor=GREY)

    # ── Header bar ──────────────────────────────────────────────────────────
    header = Table([[
        Paragraph(f"<font color='white'><b>{company_settings.get('name', 'Company')}</b></font>",
                  ParagraphStyle("h", fontSize=14, fontName="Helvetica-Bold", textColor=colors.white)),
        Paragraph("<font color='white'><b>DELIVERY CHALLAN</b></font>",
                  ParagraphStyle("hr", fontSize=16, fontName="Helvetica-Bold",
                                 textColor=colors.white, alignment=TA_RIGHT))
    ]], colWidths=[100*mm, 80*mm])
    header.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), BLUE),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING", (0,0), (-1,-1), 8),
        ("BOTTOMPADDING", (0,0), (-1,-1), 8),
        ("LEFTPADDING", (0,0), (0,0), 6),
        ("RIGHTPADDING", (-1,-1), (-1,-1), 6),
    ]))
    story.append(header)
    story.append(Spacer(1, 3*mm))

    # ── Meta ────────────────────────────────────────────────────────────────
    customer = dc.get("companies") or {}
    so = dc.get("sales_orders") or {}
    meta = [
        [Paragraph("<b>Deliver To:</b>", bold),
         Paragraph(f"<b>DC No:</b> {dc.get('dc_no', '')}", bold)],
        [Paragraph(customer.get("name", ""), normal),
         Paragraph(f"<b>Date:</b> {dc.get('date', '')}", normal)],
        [Paragraph(customer.get("address", "") or "", normal),
         Paragraph(f"<b>SO Ref:</b> {so.get('so_no', 'N/A')}", normal)],
        [Paragraph(f"GSTIN: {customer.get('gstin', 'N/A')}", small_grey),
         Paragraph(f"<b>Vehicle No:</b> {dc.get('vehicle_no', 'N/A')}", normal)],
        ["",
         Paragraph(f"<b>Transporter:</b> {dc.get('transporter_name', 'N/A')}", normal)],
    ]
    meta_table = Table(meta, colWidths=[90*mm, 90*mm])
    meta_table.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("TOPPADDING", (0,0), (-1,-1), 2),
        ("BOTTOMPADDING", (0,0), (-1,-1), 2),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 3*mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BLUE))
    story.append(Spacer(1, 2*mm))

    # ── Items table (NO prices, NO GST) ────────────────────────────────────
    items = dc.get("dc_items") or []
    col_headers = ["#", "Description", "HSN Code", "UOM", "Qty"]
    col_widths = [8*mm, 95*mm, 25*mm, 18*mm, 20*mm]

    rows = [col_headers]
    for idx, it in enumerate(items, 1):
        rows.append([str(idx), it.get("description", ""), it.get("hsn_code", ""),
                     it.get("uom", "NOS"), f"{float(it.get('qty', 0)):.2f}"])

    item_table = Table(rows, colWidths=col_widths, repeatRows=1)
    item_table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), BLUE),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE", (0,0), (-1,-1), 8),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, LIGHT_BLUE]),
        ("GRID", (0,0), (-1,-1), 0.3, colors.HexColor("#e5e7eb")),
        ("ALIGN", (4,0), (4,-1), "RIGHT"),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING", (0,0), (-1,-1), 4),
        ("BOTTOMPADDING", (0,0), (-1,-1), 4),
    ]))
    story.append(item_table)
    story.append(Spacer(1, 8*mm))

    # ── Signature block ─────────────────────────────────────────────────────
    sig_data = [[
        Paragraph("Received by: ___________________________", normal),
        Paragraph("Authorised Signatory: ___________________________", normal),
    ], [
        Paragraph("Date: _______________________", normal),
        Paragraph(f"For {company_settings.get('name', '')}", normal),
    ]]
    sig_table = Table(sig_data, colWidths=[90*mm, 90*mm])
    sig_table.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("TOPPADDING", (0,0), (-1,-1), 4),
        ("BOTTOMPADDING", (0,0), (-1,-1), 4),
    ]))
    story.append(sig_table)
    story.append(Spacer(1, 5*mm))

    # ── Footer ──────────────────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=0.5, color=BLUE))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph(
        "E. & O.E. — This Delivery Challan is for delivery purposes only and does not constitute a Tax Invoice.",
        ParagraphStyle("f", fontSize=7, textColor=GREY, alignment=TA_CENTER)
    ))

    doc.build(story)
    return buf.getvalue()
