"""
Invoice PDF generator using ReportLab.
"""
from io import BytesIO
from decimal import Decimal
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_CENTER


def generate_invoice_pdf(invoice: dict) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=15*mm, rightMargin=15*mm, topMargin=15*mm, bottomMargin=15*mm)
    styles = getSampleStyleSheet()
    story = []

    bold = ParagraphStyle("bold", parent=styles["Normal"], fontName="Helvetica-Bold")
    center = ParagraphStyle("center", parent=styles["Normal"], alignment=TA_CENTER)
    right = ParagraphStyle("right", parent=styles["Normal"], alignment=TA_RIGHT)

    company = invoice.get("companies", {})

    # Header
    story.append(Paragraph("TAX INVOICE", ParagraphStyle("h1", parent=bold, fontSize=14, alignment=TA_CENTER)))
    story.append(Spacer(1, 4*mm))

    # Company + Invoice details side by side
    header_data = [
        [
            Paragraph(f"<b>{company.get('name', '')}</b><br/>{company.get('address', '')}<br/>GSTIN: {company.get('gstin', '')}", styles["Normal"]),
            Paragraph(f"<b>Invoice No:</b> {invoice['inv_no']}<br/><b>Date:</b> {invoice['date']}<br/><b>Due Date:</b> {invoice.get('due_date', '-')}", styles["Normal"]),
        ]
    ]
    header_table = Table(header_data, colWidths=[95*mm, 85*mm])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.grey),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 4*mm))

    # Items table
    col_headers = ["#", "Description", "HSN", "Qty", "Unit", "Rate", "Amount", "GST%", "Tax", "Total"]
    rows = [col_headers]

    for idx, item in enumerate(invoice.get("invoice_items", []), 1):
        amt = Decimal(str(item["amount"]))
        tax = Decimal(str(item.get("cgst_amt", 0))) + Decimal(str(item.get("sgst_amt", 0))) + Decimal(str(item.get("igst_amt", 0)))
        rows.append([
            str(idx),
            item["description"],
            item["hsn_code"],
            str(item["qty"]),
            item["uom"],
            f"{Decimal(str(item['rate'])):,.2f}",
            f"{amt:,.2f}",
            f"{item['gst_rate']}%",
            f"{tax:,.2f}",
            f"{amt + tax:,.2f}",
        ])

    col_widths = [8*mm, 45*mm, 15*mm, 12*mm, 10*mm, 16*mm, 16*mm, 10*mm, 16*mm, 18*mm]
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
        ["Taxable Amount", f"₹ {Decimal(str(invoice['taxable_amt'])):,.2f}"],
    ]
    if Decimal(str(invoice.get("cgst", 0))) > 0:
        totals_data.append(["CGST", f"₹ {Decimal(str(invoice['cgst'])):,.2f}"])
        totals_data.append(["SGST", f"₹ {Decimal(str(invoice['sgst'])):,.2f}"])
    if Decimal(str(invoice.get("igst", 0))) > 0:
        totals_data.append(["IGST", f"₹ {Decimal(str(invoice['igst'])):,.2f}"])
    totals_data.append(["", ""])
    totals_data.append([Paragraph("<b>Total</b>", bold), Paragraph(f"<b>₹ {Decimal(str(invoice['total'])):,.2f}</b>", right)])
    totals_data.append(["Amount Paid", f"₹ {Decimal(str(invoice.get('amount_paid', 0))):,.2f}"])
    totals_data.append([Paragraph("<b>Balance Due</b>", bold), Paragraph(f"<b>₹ {Decimal(str(invoice.get('balance_due', invoice['total']))):,.2f}</b>", right)])

    totals_table = Table(totals_data, colWidths=[80*mm, 60*mm], hAlign="RIGHT")
    totals_table.setStyle(TableStyle([
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("LINEABOVE", (-1, -3), (-1, -3), 0.5, colors.black),
        ("PADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(totals_table)

    # IRN / EWB if present
    if invoice.get("irn"):
        story.append(Spacer(1, 4*mm))
        story.append(Paragraph(f"IRN: {invoice['irn']}", styles["Normal"]))
    if invoice.get("ewb_no"):
        story.append(Paragraph(f"E-Way Bill No: {invoice['ewb_no']}", styles["Normal"]))

    doc.build(story)
    return buf.getvalue()
