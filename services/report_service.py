import io
import csv
from datetime import datetime, timezone
from models import db, User, Transaction, Category, Goal, RecurringPayment, Bill, Asset, Liability

def build_report_data(user_id: int, report_type: str = "monthly", year: int = None, month: int = None) -> dict:
    """
    Builds comprehensive financial report data based on real user records.
    Report types: 'monthly', 'yearly', 'income', 'expense', 'category', 'savings', 'net_worth'
    """
    user = db.session.get(User, user_id)
    if not user:
        return {"error": "User not found"}

    currency = user.currency
    now = datetime.now(timezone.utc)
    if not year:
        year = now.year
    if not month:
        month = now.month

    period_str = f"{year}-{month:02d}"
    year_str = str(year)

    # Base query
    tx_query = Transaction.query.filter_by(user_id=user_id)
    if report_type == "monthly":
        txs = tx_query.filter(Transaction.date.startswith(period_str)).order_by(Transaction.date.desc()).all()
        period_title = f"{datetime(year, month, 1).strftime('%B %Y')}"
    elif report_type == "yearly":
        txs = tx_query.filter(Transaction.date.startswith(year_str)).order_by(Transaction.date.desc()).all()
        period_title = f"Calendar Year {year}"
    elif report_type == "income":
        txs = tx_query.filter_by(type="income").order_by(Transaction.date.desc()).all()
        period_title = "All Recorded Income"
    elif report_type == "expense":
        txs = tx_query.filter_by(type="expense").order_by(Transaction.date.desc()).all()
        period_title = "All Recorded Expenses"
    else:
        txs = tx_query.order_by(Transaction.date.desc()).all()
        period_title = "Comprehensive Ledger Report"

    income_total = sum(t.amount for t in txs if t.type == "income")
    expense_total = sum(t.amount for t in txs if t.type == "expense")
    net_savings = income_total - expense_total
    savings_rate = round((net_savings / income_total * 100.0), 1) if income_total > 0 else 0.0

    # Category breakdown
    cat_breakdown = {}
    for t in txs:
        cat_name = t.category.name if t.category else "Uncategorized"
        cat_color = t.category.color if t.category else "#64748B"
        if cat_name not in cat_breakdown:
            cat_breakdown[cat_name] = {"name": cat_name, "color": cat_color, "type": t.type, "total": 0.0, "count": 0}
        cat_breakdown[cat_name]["total"] += t.amount
        cat_breakdown[cat_name]["count"] += 1

    sorted_categories = sorted(cat_breakdown.values(), key=lambda x: x["total"], reverse=True)

    # Assets & Liabilities for Net Worth
    assets = Asset.query.filter_by(user_id=user_id).all()
    liabilities = Liability.query.filter_by(user_id=user_id).all()
    tot_assets = sum(a.value for a in assets)
    tot_liab = sum(l.amount for l in liabilities)
    net_worth = tot_assets - tot_liab

    return {
        "report_type": report_type,
        "period_title": period_title,
        "currency": currency,
        "user_name": user.full_name,
        "generated_at": now.strftime("%Y-%m-%d %H:%M:%S UTC"),
        "summary": {
            "total_income": round(income_total, 2),
            "total_expenses": round(expense_total, 2),
            "net_savings": round(net_savings, 2),
            "savings_rate": savings_rate,
            "transaction_count": len(txs),
            "total_assets": round(tot_assets, 2),
            "total_liabilities": round(tot_liab, 2),
            "net_worth": round(net_worth, 2),
        },
        "categories": sorted_categories,
        "transactions": [t.to_dict() for t in txs],
        "assets": [a.to_dict() for a in assets],
        "liabilities": [l.to_dict() for l in liabilities],
    }

def export_report_csv(user_id: int, report_type: str = "monthly", year: int = None, month: int = None) -> io.StringIO:
    """Generates formatted CSV for report export."""
    data = build_report_data(user_id, report_type, year, month)
    csv_buf = io.StringIO()
    writer = csv.writer(csv_buf)

    writer.writerow(["LEDGER FINANCIAL REPORT", data["period_title"]])
    writer.writerow(["User", data["user_name"]])
    writer.writerow(["Generated At", data["generated_at"]])
    writer.writerow([])

    # Summary
    writer.writerow(["EXECUTIVE SUMMARY"])
    writer.writerow(["Total Income", f"{data['currency']}{data['summary']['total_income']:,.2f}"])
    writer.writerow(["Total Expenses", f"{data['currency']}{data['summary']['total_expenses']:,.2f}"])
    writer.writerow(["Net Savings", f"{data['currency']}{data['summary']['net_savings']:,.2f}"])
    writer.writerow(["Savings Rate", f"{data['summary']['savings_rate']}%"])
    writer.writerow(["Net Worth", f"{data['currency']}{data['summary']['net_worth']:,.2f}"])
    writer.writerow([])

    # Categories
    writer.writerow(["CATEGORY BREAKDOWN"])
    writer.writerow(["Category", "Type", "Transactions", "Total Amount"])
    for c in data["categories"]:
        writer.writerow([c["name"], c["type"], c["count"], f"{data['currency']}{c['total']:,.2f}"])
    writer.writerow([])

    # Transactions
    writer.writerow(["RECORDED TRANSACTIONS"])
    writer.writerow(["Date", "Type", "Merchant", "Category", "Payment Method", "Amount", "Notes"])
    for t in data["transactions"]:
        writer.writerow([t["date"], t["type"], t["merchant"], t["category_name"], t["payment_method"], t["amount"], t["notes"]])

    csv_buf.seek(0)
    return csv_buf

def export_report_pdf(user_id: int, report_type: str = "monthly", year: int = None, month: int = None) -> io.BytesIO:
    """
    Generates a professional, branded PDF financial report using ReportLab.
    Features the official Ledger branding, Executive Summary table,
    Category Breakdown table, and Transaction register.
    """
    import os
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    data = build_report_data(user_id, report_type, year, month)
    pdf_buffer = io.BytesIO()
    doc = SimpleDocTemplate(pdf_buffer, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    story = []

    styles = getSampleStyleSheet()

    # Custom styling
    brand_primary = colors.HexColor("#06D6A0")  # Teal
    brand_dark = colors.HexColor("#070D1E")     # Navy
    brand_text = colors.HexColor("#0F172A")
    brand_muted = colors.HexColor("#64748B")

    title_style = ParagraphStyle(
        "LedgerTitle",
        parent=styles["Heading1"],
        fontSize=20,
        leading=24,
        textColor=brand_dark,
        fontName="Helvetica-Bold"
    )
    subtitle_style = ParagraphStyle(
        "LedgerSubtitle",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
        textColor=brand_muted,
        fontName="Helvetica"
    )
    section_style = ParagraphStyle(
        "LedgerSection",
        parent=styles["Heading2"],
        fontSize=12,
        leading=16,
        textColor=brand_dark,
        fontName="Helvetica-Bold",
        spaceBefore=14,
        spaceAfter=6
    )
    cell_style = ParagraphStyle(
        "LedgerCell",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
        textColor=brand_text,
        fontName="Helvetica"
    )
    cell_bold = ParagraphStyle(
        "LedgerCellBold",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
        textColor=brand_text,
        fontName="Helvetica-Bold"
    )

    # Header with Logo if available
    logo_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "icons", "logo-192.png")
    header_data = []
    if os.path.exists(logo_path):
        try:
            img = Image(logo_path, width=38, height=38)
            header_table = Table([[img, Paragraph(f"<b>LEDGER</b> • {data['period_title']}<br/><font size=8 color='#64748B'>Your Personal Financial Operating System</font>", title_style)]], colWidths=[48, 490])
            header_table.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('BOTTOMPADDING', (0,0), (-1,-1), 8),
            ]))
            story.append(header_table)
        except Exception:
            story.append(Paragraph(f"LEDGER • {data['period_title']}", title_style))
    else:
        story.append(Paragraph(f"LEDGER • {data['period_title']}", title_style))

    story.append(Paragraph(f"Prepared for: <b>{data['user_name']}</b> | Generated: {data['generated_at']}", subtitle_style))
    story.append(Spacer(1, 12))

    # Executive Summary Box
    story.append(Paragraph("Executive Summary", section_style))
    curr = data["currency"]
    summ = data["summary"]
    summary_matrix = [
        [Paragraph("Total Income", cell_bold), Paragraph(f"{curr}{summ['total_income']:,.2f}", cell_style),
         Paragraph("Total Expenses", cell_bold), Paragraph(f"{curr}{summ['total_expenses']:,.2f}", cell_style)],
        [Paragraph("Net Savings", cell_bold), Paragraph(f"{curr}{summ['net_savings']:,.2f}", cell_style),
         Paragraph("Savings Rate", cell_bold), Paragraph(f"{summ['savings_rate']}%", cell_style)],
        [Paragraph("Net Worth", cell_bold), Paragraph(f"{curr}{summ['net_worth']:,.2f}", cell_style),
         Paragraph("Recorded Transactions", cell_bold), Paragraph(str(summ['transaction_count']), cell_style)],
    ]
    summary_table = Table(summary_matrix, colWidths=[130, 140, 130, 140])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F8FAFC")),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 10))

    # Categories Breakdown Table
    if data["categories"]:
        story.append(Paragraph("Category Outflow Breakdown", section_style))
        cat_rows = [[Paragraph("<b>Category</b>", cell_bold), Paragraph("<b>Type</b>", cell_bold), Paragraph("<b>Transactions</b>", cell_bold), Paragraph("<b>Total Amount</b>", cell_bold)]]
        for c in data["categories"][:8]:
            cat_rows.append([
                Paragraph(c["name"], cell_style),
                Paragraph(c["type"].capitalize(), cell_style),
                Paragraph(str(c["count"]), cell_style),
                Paragraph(f"{curr}{c['total']:,.2f}", cell_style),
            ])
        cat_table = Table(cat_rows, colWidths=[180, 100, 100, 160])
        cat_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#070D1E")),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('BOTTOMPADDING', (0,0), (-1,0), 6),
            ('TOPPADDING', (0,0), (-1,0), 6),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F8FAFC")]),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ]))
        story.append(cat_table)
        story.append(Spacer(1, 10))

    # Recent Transactions Table
    if data["transactions"]:
        story.append(Paragraph("Recorded Transactions Register", section_style))
        tx_rows = [[
            Paragraph("<b>Date</b>", cell_bold),
            Paragraph("<b>Description</b>", cell_bold),
            Paragraph("<b>Category</b>", cell_bold),
            Paragraph("<b>Method</b>", cell_bold),
            Paragraph("<b>Amount</b>", cell_bold)
        ]]
        for t in data["transactions"][:25]:  # Up to 25 items for clean 1-2 page layout
            desc = t["merchant"] or ("Income" if t["type"]=="income" else "Expense")
            amt_str = f"+{curr}{t['amount']:,.2f}" if t["type"] == "income" else f"-{curr}{t['amount']:,.2f}"
            tx_rows.append([
                Paragraph(t["date"], cell_style),
                Paragraph(desc[:26], cell_style),
                Paragraph(t["category_name"][:20], cell_style),
                Paragraph(t["payment_method"], cell_style),
                Paragraph(amt_str, cell_style),
            ])
        tx_table = Table(tx_rows, colWidths=[75, 175, 120, 80, 90])
        tx_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#070D1E")),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F8FAFC")]),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ]))
        story.append(tx_table)

    doc.build(story)
    pdf_buffer.seek(0)
    return pdf_buffer

