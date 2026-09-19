from datetime import datetime, timedelta, timezone
from flask import Blueprint, jsonify, request
from models import db, Transaction, Category, Goal, RecurringPayment, Bill, Asset, Liability
from services.ai_service import generate_spending_summary
from routes import login_required

dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")

@dashboard_bp.route("/overview", methods=["GET"])
@login_required
def get_overview():
    user = request.current_user
    user_id = user.id
    currency = user.currency

    now = datetime.now(timezone.utc)
    curr_month_str = now.strftime("%Y-%m")
    last_month_dt = (now.replace(day=1) - timedelta(days=1))
    last_month_str = last_month_dt.strftime("%Y-%m")

    # All transactions
    all_txs = Transaction.query.filter_by(user_id=user_id).order_by(Transaction.date.desc()).all()

    # Lifetime balance calculation
    tot_inc_lifetime = sum(t.amount for t in all_txs if t.type == "income")
    tot_exp_lifetime = sum(t.amount for t in all_txs if t.type == "expense")
    liquid_assets = db.session.query(db.func.sum(Asset.value)).filter(
        Asset.user_id == user_id, Asset.category.in_(["cash", "savings"])
    ).scalar() or 0.0
    current_balance = (tot_inc_lifetime - tot_exp_lifetime) + liquid_assets

    # Current month metrics
    curr_month_txs = [t for t in all_txs if t.date.startswith(curr_month_str)]
    curr_income = sum(t.amount for t in curr_month_txs if t.type == "income")
    curr_expense = sum(t.amount for t in curr_month_txs if t.type == "expense")
    net_savings = curr_income - curr_expense
    savings_rate = round((net_savings / curr_income * 100.0), 1) if curr_income > 0 else 0.0

    # Net worth
    tot_assets = db.session.query(db.func.sum(Asset.value)).filter(Asset.user_id == user_id).scalar() or 0.0
    tot_liabilities = db.session.query(db.func.sum(Liability.amount)).filter(Liability.user_id == user_id).scalar() or 0.0
    net_worth = (current_balance + (tot_assets - liquid_assets)) - tot_liabilities

    # Upcoming obligations (bills due in next 14 days)
    today_str = now.strftime("%Y-%m-%d")
    in_14_days_str = (now + timedelta(days=14)).strftime("%Y-%m-%d")
    upcoming_bills = Bill.query.filter(
        Bill.user_id == user_id,
        Bill.is_paid == False,
        Bill.due_date >= today_str,
        Bill.due_date <= in_14_days_str
    ).order_by(Bill.due_date.asc()).all()
    upcoming_obligations_total = sum(b.amount for b in upcoming_bills)

    # Cash Flow Trend (last 6 months)
    cashflow_trend = []
    for i in range(5, -1, -1):
        # Calculate month date
        m_date = now - timedelta(days=30 * i)
        m_str = m_date.strftime("%Y-%m")
        m_label = m_date.strftime("%b %Y")
        m_txs = [t for t in all_txs if t.date.startswith(m_str)]
        m_inc = sum(t.amount for t in m_txs if t.type == "income")
        m_exp = sum(t.amount for t in m_txs if t.type == "expense")
        cashflow_trend.append({
            "month": m_label,
            "income": round(m_inc, 2),
            "expense": round(m_exp, 2),
            "net": round(m_inc - m_exp, 2),
        })

    # Spending Category Breakdown (current month or recent 30 days)
    cat_spending = {}
    for t in curr_month_txs:
        if t.type == "expense":
            c_name = t.category.name if t.category else "Other Expenses"
            c_color = t.category.color if t.category else "#64748B"
            c_icon = t.category.icon if t.category else "tag"
            if c_name not in cat_spending:
                cat_spending[c_name] = {"name": c_name, "amount": 0.0, "color": c_color, "icon": c_icon}
            cat_spending[c_name]["amount"] += t.amount

    spending_breakdown = list(cat_spending.values())
    for item in spending_breakdown:
        item["percent"] = round((item["amount"] / curr_expense * 100.0), 1) if curr_expense > 0 else 0.0
    spending_breakdown.sort(key=lambda x: x["amount"], reverse=True)

    # Goals summary
    goals = Goal.query.filter_by(user_id=user_id, status="active").order_by(Goal.target_date.asc()).limit(4).all()

    # Recurring payments summary
    recurring = RecurringPayment.query.filter_by(user_id=user_id, status="active").limit(5).all()

    # Recent transactions
    recent_transactions = [t.to_dict() for t in all_txs[:7]]

    # AI Summary
    ai_summary = generate_spending_summary(user_id)

    return jsonify({
        "currency": currency,
        "overview": {
            "current_balance": round(current_balance, 2),
            "total_income": round(curr_income, 2),
            "total_expenses": round(curr_expense, 2),
            "net_savings": round(net_savings, 2),
            "savings_rate": savings_rate,
            "net_worth": round(net_worth, 2),
            "upcoming_obligations": round(upcoming_obligations_total, 2),
            "has_data": len(all_txs) > 0,
        },
        "cashflow_trend": cashflow_trend,
        "spending_breakdown": spending_breakdown,
        "top_categories": spending_breakdown[:4],
        "goals": [g.to_dict() for g in goals],
        "upcoming_bills": [b.to_dict() for b in upcoming_bills],
        "recurring_payments": [r.to_dict() for r in recurring],
        "recent_transactions": recent_transactions,
        "ai_summary": ai_summary,
    }), 200
