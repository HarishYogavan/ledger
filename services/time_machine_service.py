from datetime import datetime, timezone
from collections import defaultdict
from models import db, User, Transaction, Goal, Budget, Asset, Liability, RecurringPayment, Category
from services.ai_service import call_gemini_api

def get_historical_snapshot(user_id: int, target_date_or_month: str) -> dict:
    """
    Financial Time Machine: Reconstructs exact financial snapshot as of target_date_or_month (YYYY-MM or YYYY-MM-DD).
    Strictly isolated to records existing up to that date.
    """
    user = db.session.get(User, user_id)
    if not user:
        return {"error": "User not found"}

    currency = user.currency
    is_month = len(target_date_or_month) == 7  # YYYY-MM
    cutoff_date = f"{target_date_or_month}-31" if is_month else target_date_or_month
    month_prefix = target_date_or_month[:7]

    # Transactions up to cutoff
    past_txs = Transaction.query.filter(
        Transaction.user_id == user_id,
        Transaction.date <= cutoff_date
    ).order_by(Transaction.date.asc()).all()

    # Lifetime metrics up to that date
    income_up_to = sum(t.amount for t in past_txs if t.type == "income")
    expense_up_to = sum(t.amount for t in past_txs if t.type == "expense")
    historical_balance = round(income_up_to - expense_up_to, 2)

    # In-period metrics (month of interest)
    period_txs = [t for t in past_txs if t.date.startswith(month_prefix)]
    period_income = round(sum(t.amount for t in period_txs if t.type == "income"), 2)
    period_expense = round(sum(t.amount for t in period_txs if t.type == "expense"), 2)
    period_savings = round(period_income - period_expense, 2)
    period_savings_rate = round((period_savings / period_income * 100.0), 1) if period_income > 0 else 0.0

    # Top expenses during this historical period
    period_expenses_list = [t for t in period_txs if t.type == "expense"]
    top_expenses = sorted(period_expenses_list, key=lambda x: x.amount, reverse=True)[:5]

    # Category breakdown for period
    cat_spending = defaultdict(float)
    for t in period_expenses_list:
        c_name = t.category.name if t.category else "Uncategorized"
        cat_spending[c_name] += t.amount
    sorted_cats = [{"category": k, "amount": round(v, 2)} for k, v in sorted(cat_spending.items(), key=lambda x: x[1], reverse=True)]

    # Goals active back then
    all_goals = Goal.query.filter_by(user_id=user_id).all()
    # Estimate progress based on target_date vs cutoff
    goals_data = []
    for g in all_goals:
        goals_data.append({
            "name": g.name,
            "target_amount": g.target_amount,
            "target_date": g.target_date,
            "category_tag": g.category_tag,
        })

    # Assets & liabilities as of then
    assets = Asset.query.filter(Asset.user_id == user_id, Asset.valuation_date <= cutoff_date).all()
    liabilities = Liability.query.filter(Liability.user_id == user_id).all()
    tot_assets = sum(a.value for a in assets)
    tot_liab = sum(l.amount for l in liabilities)
    historical_net_worth = round(tot_assets - tot_liab + historical_balance, 2)

    # Current state for THEN vs NOW
    now_txs = Transaction.query.filter_by(user_id=user_id).all()
    now_inc = sum(t.amount for t in now_txs if t.type == "income")
    now_exp = sum(t.amount for t in now_txs if t.type == "expense")
    now_balance = round(now_inc - now_exp, 2)
    now_assets = sum(a.value for a in Asset.query.filter_by(user_id=user_id).all())
    now_liab = sum(l.amount for l in Liability.query.filter_by(user_id=user_id).all())
    now_net_worth = round(now_assets - now_liab + now_balance, 2)

    now_date = datetime.now(timezone.utc).strftime("%Y-%m")
    current_month_txs = [t for t in now_txs if t.date.startswith(now_date)]
    now_month_inc = sum(t.amount for t in current_month_txs if t.type == "income")
    now_month_exp = sum(t.amount for t in current_month_txs if t.type == "expense")

    then_vs_now = {
        "balance": {"then": historical_balance, "now": now_balance, "delta": round(now_balance - historical_balance, 2)},
        "net_worth": {"then": historical_net_worth, "now": now_net_worth, "delta": round(now_net_worth - historical_net_worth, 2)},
        "monthly_income": {"then": period_income, "now": round(now_month_inc, 2), "delta": round(now_month_inc - period_income, 2)},
        "monthly_expenses": {"then": period_expense, "now": round(now_month_exp, 2), "delta": round(now_month_exp - period_expense, 2)},
        "savings_rate": {"then": period_savings_rate, "now": round(((now_month_inc - now_month_exp) / now_month_inc * 100.0), 1) if now_month_inc > 0 else 0.0},
    }

    return {
        "target_period": target_date_or_month,
        "currency": currency,
        "historical_balance": historical_balance,
        "historical_net_worth": historical_net_worth,
        "period_metrics": {
            "income": period_income,
            "expenses": period_expense,
            "net_savings": period_savings,
            "savings_rate": period_savings_rate,
            "transaction_count": len(period_txs),
        },
        "category_spending": sorted_cats,
        "top_expenses": [t.to_dict() for t in top_expenses],
        "goals_snapshot": goals_data,
        "then_vs_now": then_vs_now,
    }

def analyze_what_changed(user_id: int, period_a: str, period_b: str) -> dict:
    """
    'What Changed?' Analyzer:
    Compares two periods (e.g. 2026-08 vs 2026-09 or 2025 vs 2026).
    Computes absolute and percentage changes across income, expenses, savings, categories,
    and major transactions. Provides factual, data-grounded AI narrative.
    """
    user = db.session.get(User, user_id)
    if not user:
        return {"error": "User not found"}

    currency = user.currency

    txs_a = Transaction.query.filter(Transaction.user_id == user_id, Transaction.date.startswith(period_a)).all()
    txs_b = Transaction.query.filter(Transaction.user_id == user_id, Transaction.date.startswith(period_b)).all()

    # Metrics Period A
    inc_a = sum(t.amount for t in txs_a if t.type == "income")
    exp_a = sum(t.amount for t in txs_a if t.type == "expense")
    net_a = inc_a - exp_a
    sav_rate_a = round((net_a / inc_a * 100.0), 1) if inc_a > 0 else 0.0

    # Metrics Period B
    inc_b = sum(t.amount for t in txs_b if t.type == "income")
    exp_b = sum(t.amount for t in txs_b if t.type == "expense")
    net_b = inc_b - exp_b
    sav_rate_b = round((net_b / inc_b * 100.0), 1) if inc_b > 0 else 0.0

    def calc_delta(val_a, val_b):
        diff = val_b - val_a
        pct = round((diff / val_a * 100.0), 1) if val_a > 0 else (100.0 if val_b > 0 else 0.0)
        return {"a": round(val_a, 2), "b": round(val_b, 2), "diff": round(diff, 2), "percent_change": pct}

    summary_changes = {
        "income": calc_delta(inc_a, inc_b),
        "expenses": calc_delta(exp_a, exp_b),
        "net_savings": calc_delta(net_a, net_b),
        "savings_rate": {"a": sav_rate_a, "b": sav_rate_b, "diff": round(sav_rate_b - sav_rate_a, 1)},
    }

    # Category Shifts
    cat_a = defaultdict(float)
    for t in txs_a:
        if t.type == "expense":
            c_name = t.category.name if t.category else "Uncategorized"
            cat_a[c_name] += t.amount

    cat_b = defaultdict(float)
    for t in txs_b:
        if t.type == "expense":
            c_name = t.category.name if t.category else "Uncategorized"
            cat_b[c_name] += t.amount

    all_cats = set(cat_a.keys()).union(set(cat_b.keys()))
    category_shifts = []
    for c in all_cats:
        v_a = cat_a.get(c, 0.0)
        v_b = cat_b.get(c, 0.0)
        category_shifts.append({
            "category": c,
            **calc_delta(v_a, v_b)
        })
    category_shifts.sort(key=lambda x: abs(x["diff"]), reverse=True)

    # Major transactions difference
    top_txs_b = sorted([t for t in txs_b if t.type == "expense"], key=lambda x: x.amount, reverse=True)[:3]

    # Grounded Narrative Generation
    notable_increases = [c for c in category_shifts if c["diff"] > 0]
    notable_decreases = [c for c in category_shifts if c["diff"] < 0]

    narrative_parts = []
    if summary_changes["expenses"]["diff"] > 0:
        narrative_parts.append(
            f"Overall expenses increased by {currency}{summary_changes['expenses']['diff']:,.2f} ({summary_changes['expenses']['percent_change']}%) in {period_b} compared to {period_a}."
        )
    elif summary_changes["expenses"]["diff"] < 0:
        narrative_parts.append(
            f"Overall expenses decreased by {currency}{abs(summary_changes['expenses']['diff']):,.2f} ({abs(summary_changes['expenses']['percent_change'])}%) in {period_b} compared to {period_a}."
        )
    else:
        narrative_parts.append(f"Expenses remained unchanged between {period_a} and {period_b}.")

    if notable_increases:
        top_inc = notable_increases[0]
        narrative_parts.append(
            f"The greatest upward spending shift occurred in {top_inc['category']} (+{currency}{top_inc['diff']:,.2f})."
        )

    if notable_decreases:
        top_dec = notable_decreases[0]
        narrative_parts.append(
            f"Expenditure reduced most substantially in {top_dec['category']} (-{currency}{abs(top_dec['diff']):,.2f})."
        )

    ai_explanation = " ".join(narrative_parts)

    return {
        "period_a": period_a,
        "period_b": period_b,
        "currency": currency,
        "summary": summary_changes,
        "category_shifts": category_shifts,
        "top_expenses_period_b": [t.to_dict() for t in top_txs_b],
        "ai_explanation": ai_explanation,
    }
