"""Proforma Invoice PDF generation."""
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
BLACK = colors.black


def _money(v) -> str:
    return f"₹{float(v or 0):,.2f}"


def generate_proforma_pdf(pi: dict, company_settings: dict) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            topMargin=15*mm, bottomMargin=15*mm,
                            leftMargin=15*mm, rightMargin=15*mm)
    styles = getSampleStyleSheet()
    normal = ParagraphStyle("n", fontSize=8, leading=11)
    bold = ParagraphStyle("b", fontSize=8, leading=11, fontName="Helvetica-Bold")
    small_grey = ParagraphStyle("sg", fontSize=7, leading=10, textColor=GREY)
    story = []

    # ── Header bar ──────────────────────────────────────────────────────────
    header_table = Table([[
        Paragraph(f"<font color='white'><b>{company_settings.get('name', 'Company')}</b></font>",
                  ParagraphStyle("hc", fontSize=14, fontName="Helvetica-Bold", textColor=colors.white)),
        Paragraph("<font color='white'><b>PROFORMA INVOICE</b></font>",
                  ParagraphStyle("hr", fontSize=16, fontName="Helvetica-Bold",
                                 textColor=colors.white, alignment=TA_RIGHT))
    ]], colWidths=[100*mm, 80*mm])
    header_table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), BLUE),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING", (0,0), (-1,-1), 8),
        ("BOTTOMPADDING", (0,0), (-1,-1), 8),
        ("LEFTPADDING", (0,0), (0,0), 6),
        ("RIGHTPADDING", (-1,-1), (-1,-1), 6),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 2*mm))

    # Sub-header: Not a tax invoice notice
    story.append(Paragraph(
        "<i>This is a Proforma Invoice and not a Tax Invoice. No tax liability arises on this document.</i>",
        ParagraphStyle("notice", fontSize=7.5, textColor=GREY, alignment=TA_CENTER)
    ))
    story.append(Spacer(1, 3*mm))

    # ── Meta info ───────────────────────────────────────────────────────────
    customer = pi.get("companies") or {}
    meta_data = [
        [Paragraph("<b>Bill To:</b>", bold),
         Paragraph(f"<b>PI No:</b> {pi.get('pi_no', '')}", bold)],
        [Paragraph(customer.get("name", ""), normal),
         Paragraph(f"<b>Date:</b> {pi.get('date', '')}", normal)],
        [Paragraph(customer.get("address", "") or "", normal),
         Paragraph(f"<b>Valid Until:</b> {pi.get('validity_date', 'N/A')}", normal)],
        [Paragraph(f"GSTIN: {customer.get('gstin', 'N/A')}", small_grey),
         Paragraph(f"<b>Place of Supply:</b> {pi.get('place_of_supply', '')}", normal)],
    ]
    meta_table = Table(meta_data, colWidths=[90*mm, 90*mm])
    meta_table.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("TOPPADDING", (0,0), (-1,-1), 2),
        ("BOTTOMPADDING", (0,0), (-1,-1), 2),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 3*mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BLUE))
    story.append(Spacer(1, 2*mm))

    # ── Items table ─────────────────────────────────────────────────────────
    items = pi.get("proforma_items") or []
    intra = True  # we'll use CGST+SGST if cgst > 0
    has_igst = any(float(it.get("igst_amt", 0)) > 0 for it in items)
    has_intra = any(float(it.get("cgst_amt", 0)) > 0 for it in items)

    if has_igst and not has_intra:
        tax_cols = ["IGST"]
    else:
        tax_cols = ["CGST", "SGST"]

    col_headers = ["#", "Description", "HSN", "UOM", "Qty", "Rate (₹)"] + tax_cols + ["Amount (₹)"]
    col_widths_map = {
        2: [5*mm, 58*mm, 14*mm, 11*mm, 11*mm, 16*mm, 16*mm, 16*mm, 18*mm],
        1: [5*mm, 65*mm, 14*mm, 11*mm, 11*mm, 16*mm, 20*mm, 18*mm],
    }
    col_widths = col_widths_map[len(tax_cols)]

    rows = [col_headers]
    for idx, it in enumerate(items, 1):
        qty = float(it.get("qty", 0))
        rate = float(it.get("rate", 0))
        amt = qty * rate
        tax_vals = [_money(it.get("cgst_amt", 0)), _money(it.get("sgst_amt", 0))] if len(tax_cols)==2 else [_money(it.get("igst_amt", 0))]
        rows.append([str(idx), it.get("description", ""), it.get("hsn_code", ""),
                     it.get("uom", ""), f"{qty:.2f}", _money(rate)] + tax_vals + [_money(amt)])

    item_table = Table(rows, colWidths=col_widths, repeatRows=1)
    item_table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), BLUE),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE", (0,0), (-1,-1), 7.5),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, LIGHT_BLUE]),
        ("GRID", (0,0), (-1,-1), 0.3, colors.HexColor("#e5e7eb")),
        ("ALIGN", (4,0), (-1,-1), "RIGHT"),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING", (0,0), (-1,-1), 3),
        ("BOTTOMPADDING", (0,0), (-1,-1), 3),
    ]))
    story.append(item_table)
    story.append(Spacer(1, 3*mm))

    # ── Totals ──────────────────────────────────────────────────────────────
    total_rows = [
        ["Taxable Amount", _money(pi.get("taxable_amt", 0))],
    ]
    if float(pi.get("cgst", 0)) > 0:
        total_rows += [
            ["CGST", _money(pi.get("cgst", 0))],
            ["SGST", _money(pi.get("sgst", 0))],
        ]
    if float(pi.get("igst", 0)) > 0:
        total_rows.append(["IGST", _money(pi.get("igst", 0))])
    total_rows.append(["TOTAL", _money(pi.get("total", 0))])

    totals_table = Table([[
        "",
        Table([[r[0], r[1]] for r in total_rows],
              colWidths=[40*mm, 30*mm],
              style=TableStyle([
                  ("FONTSIZE", (0,0), (-1,-1), 8),
                  ("ALIGN", (1,0), (1,-1), "RIGHT"),
                  ("LINEABOVE", (0,-1), (-1,-1), 1, BLUE),
                  ("FONTNAME", (0,-1), (-1,-1), "Helvetica-Bold"),
                  ("TOPPADDING", (0,0), (-1,-1), 2),
                  ("BOTTOMPADDING", (0,0), (-1,-1), 2),
              ]))
    ]], colWidths=[110*mm, 70*mm])
    story.append(totals_table)
    story.append(Spacer(1, 5*mm))

    # ── Footer ──────────────────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=0.5, color=BLUE))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph(
        "This is a Proforma Invoice and NOT a Tax Invoice. GST is not payable on this document. "
        "A Tax Invoice will be issued upon order confirmation.",
        ParagraphStyle("footer", fontSize=7, textColor=GREY, alignment=TA_CENTER)
    ))

    if company_settings.get("bank_name"):
        story.append(Spacer(1, 3*mm))
        story.append(Paragraph(
            f"<b>Bank:</b> {company_settings.get('bank_name')} | "
            f"<b>A/C:</b> {company_settings.get('bank_account', '')} | "
            f"<b>IFSC:</b> {company_settings.get('bank_ifsc', '')}",
            ParagraphStyle("bank", fontSize=7.5, textColor=GREY)
        ))

    doc.build(story)
    return buf.getvalue()
