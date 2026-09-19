from datetime import datetime, timedelta, timezone
from flask import Blueprint, request, jsonify
from models import db, Transaction, Category, Goal
from routes import login_required

analytics_bp = Blueprint("analytics", __name__, url_prefix="/api/analytics")

@analytics_bp.route("", methods=["GET"])
@login_required
def get_analytics():
    user = request.current_user
    user_id = user.id
    currency = user.currency

    now = datetime.now(timezone.utc)
    timeframe = request.args.get("timeframe", "monthly")  # 'daily', 'weekly', 'monthly', 'yearly'

    all_txs = Transaction.query.filter_by(user_id=user_id).order_by(Transaction.date.asc()).all()
    if not all_txs:
        return jsonify({
            "has_data": False,
            "currency": currency,
            "message": "Add your first transaction to view detailed financial analytics.",
            "spending_trend": [],
            "category_analytics": [],
            "income_sources": [],
            "savings_trend": [],
            "summary": {}
        }), 200

    # 1. Spending & Income Trend
    # Group by month or day depending on timeframe
    trend_map = {}
    for t in all_txs:
        key = t.date[:7] if timeframe in ["monthly", "yearly"] else t.date
        if key not in trend_map:
            trend_map[key] = {"label": key, "income": 0.0, "expense": 0.0, "net": 0.0}
        if t.type == "income":
            trend_map[key]["income"] += t.amount
        else:
            trend_map[key]["expense"] += t.amount
        trend_map[key]["net"] = trend_map[key]["income"] - trend_map[key]["expense"]

    sorted_trend = sorted(trend_map.values(), key=lambda x: x["label"])
    # Format labels
    for item in sorted_trend:
        item["income"] = round(item["income"], 2)
        item["expense"] = round(item["expense"], 2)
        item["net"] = round(item["net"], 2)

    # 2. Category Analytics (Expenses)
    cat_stats = {}
    tot_expense = sum(t.amount for t in all_txs if t.type == "expense")
    for t in all_txs:
        if t.type == "expense":
            c_name = t.category.name if t.category else "Uncategorized"
            c_color = t.category.color if t.category else "#64748B"
            c_icon = t.category.icon if t.category else "tag"
            if c_name not in cat_stats:
                cat_stats[c_name] = {
                    "category": c_name,
                    "color": c_color,
                    "icon": c_icon,
                    "total": 0.0,
                    "count": 0,
                }
            cat_stats[c_name]["total"] += t.amount
            cat_stats[c_name]["count"] += 1

    cat_list = list(cat_stats.values())
    for c in cat_list:
        c["total"] = round(c["total"], 2)
        c["average"] = round(c["total"] / c["count"], 2) if c["count"] > 0 else 0.0
        c["percent"] = round((c["total"] / tot_expense * 100.0), 1) if tot_expense > 0 else 0.0
    cat_list.sort(key=lambda x: x["total"], reverse=True)

    # 3. Income Sources Analytics
    inc_sources = {}
    tot_income = sum(t.amount for t in all_txs if t.type == "income")
    for t in all_txs:
        if t.type == "income":
            source_name = (t.merchant or (t.category.name if t.category else "General Income")).strip()
            if source_name not in inc_sources:
                inc_sources[source_name] = {"source": source_name, "total": 0.0, "count": 0}
            inc_sources[source_name]["total"] += t.amount
            inc_sources[source_name]["count"] += 1

    income_list = list(inc_sources.values())
    for inc in income_list:
        inc["total"] = round(inc["total"], 2)
        inc["percent"] = round((inc["total"] / tot_income * 100.0), 1) if tot_income > 0 else 0.0
    income_list.sort(key=lambda x: x["total"], reverse=True)

    # 4. Savings Trend
    savings_trend = []
    for item in sorted_trend:
        inc = item["income"]
        exp = item["expense"]
        net = inc - exp
        rate = round((net / inc * 100.0), 1) if inc > 0 else 0.0
        savings_trend.append({
            "label": item["label"],
            "net_savings": round(net, 2),
            "savings_rate": rate,
        })

    return jsonify({
        "has_data": True,
        "currency": currency,
        "timeframe": timeframe,
        "summary": {
            "total_income": round(tot_income, 2),
            "total_expense": round(tot_expense, 2),
            "net_cashflow": round(tot_income - tot_expense, 2),
            "overall_savings_rate": round(((tot_income - tot_expense) / tot_income * 100.0), 1) if tot_income > 0 else 0.0,
            "transaction_count": len(all_txs),
        },
        "spending_trend": sorted_trend,
        "category_analytics": cat_list,
        "income_sources": income_list,
        "savings_trend": savings_trend,
    }), 200
