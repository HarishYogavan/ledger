from datetime import datetime, timedelta, timezone
from models import db, User, Transaction, Goal, RecurringPayment, Bill, Asset

def evaluate_financial_health(user_id: int):
    """
    Evaluates 6 separate health indicators with the strict 3-step explanation:
    What changed -> Why it changed -> What data supports it
    Grounded strictly in the user's recorded database records.
    """
    user = db.session.get(User, user_id)
    if not user:
        return None

    currency = user.currency
    now = datetime.now(timezone.utc)
    current_month_str = now.strftime("%Y-%m")
    last_month_dt = (now.replace(day=1) - timedelta(days=1))
    last_month_str = last_month_dt.strftime("%Y-%m")

    # Fetch transactions
    all_txs = Transaction.query.filter_by(user_id=user_id).all()
    if not all_txs:
        # Meaningful empty state when fresh account has no records
        return {
            "has_data": False,
            "message": "Add your first transaction or set up onboarding to view your Financial Health indicators.",
            "indicators": []
        }

    # 1. Spending Stability
    curr_expenses = [t.amount for t in all_txs if t.type == "expense" and t.date.startswith(current_month_str)]
    last_expenses = [t.amount for t in all_txs if t.type == "expense" and t.date.startswith(last_month_str)]

    sum_curr_exp = sum(curr_expenses)
    sum_last_exp = sum(last_expenses)

    if sum_last_exp > 0:
        spend_var_pct = ((sum_curr_exp - sum_last_exp) / sum_last_exp) * 100.0
        if abs(spend_var_pct) <= 10.0:
            stability_status = "Stable"
            stability_badge = "success"
            what = f"Spending is highly stable ({abs(spend_var_pct):.1f}% change compared to last month)."
        elif spend_var_pct > 10.0:
            stability_status = "Elevated"
            stability_badge = "warning"
            what = f"Spending increased by {spend_var_pct:.1f}% compared to last month."
        else:
            stability_status = "Reduced"
            stability_badge = "success"
            what = f"Spending decreased by {abs(spend_var_pct):.1f}% compared to last month."
        why = f"Current month expenditure is {currency}{sum_curr_exp:,.2f} versus {currency}{sum_last_exp:,.2f} recorded in {last_month_dt.strftime('%B')}."
        data_support = f"Recorded {len(curr_expenses)} expenses this month averaging {currency}{(sum_curr_exp/len(curr_expenses) if curr_expenses else 0):,.2f} per transaction."
    else:
        stability_status = "Establishing"
        stability_badge = "info"
        what = "Initial spending baseline is currently being established."
        why = f"Recorded {currency}{sum_curr_exp:,.2f} in expenses for this month with no prior month comparison."
        data_support = f"{len(curr_expenses)} transactions logged in current period."

    # 2. Savings Progress
    curr_income = sum(t.amount for t in all_txs if t.type == "income" and t.date.startswith(current_month_str))
    if curr_income <= 0 and user.monthly_income > 0:
        curr_income = user.monthly_income

    if curr_income > 0:
        net_saved = curr_income - sum_curr_exp
        savings_rate = max(0.0, round((net_saved / curr_income) * 100.0, 1))
        if savings_rate >= 30.0:
            savings_status = "Optimal"
            savings_badge = "success"
        elif savings_rate >= 15.0:
            savings_status = "On Track"
            savings_badge = "success"
        elif savings_rate > 0:
            savings_status = "Low"
            savings_badge = "warning"
        else:
            savings_status = "Deficit"
            savings_badge = "danger"

        what_sav = f"Current observed savings rate is {savings_rate}% ({currency}{max(0.0, net_saved):,.2f} net surplus)."
        why_sav = f"Earned {currency}{curr_income:,.2f} against {currency}{sum_curr_exp:,.2f} in total recorded expenses."
        target_note = f"Target was {currency}{user.savings_target:,.2f}." if user.savings_target > 0 else "No monthly target defined."
        data_support_sav = f"Income: {currency}{curr_income:,.2f}, Expenses: {currency}{sum_curr_exp:,.2f}. {target_note}"
    else:
        savings_status = "Pending Income"
        savings_badge = "info"
        what_sav = "Savings rate will calculate once income is recorded for this month."
        why_sav = "No income transactions or monthly salary profile recorded yet."
        data_support_sav = f"Current month expenses logged: {currency}{sum_curr_exp:,.2f}."

    # 3. Recurring-Cost Load
    recurring_items = RecurringPayment.query.filter_by(user_id=user_id, status="active").all()
    monthly_rec_cost = 0.0
    for r in recurring_items:
        if r.frequency == "monthly":
            monthly_rec_cost += r.amount
        elif r.frequency == "weekly":
            monthly_rec_cost += r.amount * 4.33
        elif r.frequency == "daily":
            monthly_rec_cost += r.amount * 30.0
        elif r.frequency == "yearly":
            monthly_rec_cost += r.amount / 12.0

    inc_base = curr_income if curr_income > 0 else user.monthly_income
    if inc_base > 0:
        rec_load_pct = round((monthly_rec_cost / inc_base) * 100.0, 1)
        if rec_load_pct <= 30.0:
            rec_status = "Healthy"
            rec_badge = "success"
        elif rec_load_pct <= 50.0:
            rec_status = "Moderate"
            rec_badge = "warning"
        else:
            rec_status = "Heavy"
            rec_badge = "danger"
        what_rec = f"Committed recurring obligations represent {rec_load_pct}% of monthly income."
        why_rec = f"Fixed recurring commitments total {currency}{monthly_rec_cost:,.2f} per month across {len(recurring_items)} subscriptions/bills."
        data_support_rec = f"Monthly recurring: {currency}{monthly_rec_cost:,.2f} / Base income: {currency}{inc_base:,.2f}."
    else:
        rec_status = "Recorded" if recurring_items else "None"
        rec_badge = "info"
        what_rec = f"Total of {len(recurring_items)} active recurring commitments tracked."
        why_rec = f"Monthly recurring commitment is {currency}{monthly_rec_cost:,.2f}."
        data_support_rec = f"{len(recurring_items)} recurring payment records in database."

    # 4. Cash-Flow Consistency
    total_inc_all = sum(t.amount for t in all_txs if t.type == "income")
    total_exp_all = sum(t.amount for t in all_txs if t.type == "expense")
    net_all = total_inc_all - total_exp_all

    if net_all >= 0:
        cf_status = "Positive"
        cf_badge = "success"
        what_cf = f"Cumulative net cash flow remains positive by {currency}{net_all:,.2f}."
        why_cf = f"All-time income ({currency}{total_inc_all:,.2f}) exceeds all-time expenses ({currency}{total_exp_all:,.2f})."
        data_support_cf = f"Total lifetime transactions: {len(all_txs)} ({currency}{total_inc_all:,.2f} in, {currency}{total_exp_all:,.2f} out)."
    else:
        cf_status = "Negative"
        cf_badge = "danger"
        what_cf = f"Cumulative cash flow shows an expenditure surplus of {currency}{abs(net_all):,.2f}."
        why_cf = f"Total recorded expenses ({currency}{total_exp_all:,.2f}) exceed recorded income ({currency}{total_inc_all:,.2f})."
        data_support_cf = f"Net delta: -{currency}{abs(net_all):,.2f} across all recorded transactions."

    # 5. Goal Progress
    goals = Goal.query.filter_by(user_id=user_id).all()
    if goals:
        active_goals = [g for g in goals if g.status == "active"]
        total_target = sum(g.target_amount for g in active_goals)
        total_curr = sum(g.current_amount for g in active_goals)
        overall_progress = round((total_curr / total_target * 100.0), 1) if total_target > 0 else 0

        goal_status = "Advancing" if overall_progress >= 50 else "In Progress"
        goal_badge = "success"
        what_goal = f"Active goals are {overall_progress}% funded across {len(active_goals)} targets."
        why_goal = f"Accumulated {currency}{total_curr:,.2f} toward total target of {currency}{total_target:,.2f}."
        data_support_goal = f"{len(active_goals)} active goals with {currency}{sum(g.monthly_contribution for g in active_goals):,.2f} committed monthly contributions."
    else:
        goal_status = "No Active Goals"
        goal_badge = "info"
        what_goal = "No financial goals currently configured."
        why_goal = "Setting clear targets helps measure your savings velocity."
        data_support_goal = "0 goals recorded in system."

    # 6. Upcoming Obligation Load
    now_str = now.strftime("%Y-%m-%d")
    next_30_str = (now + timedelta(days=30)).strftime("%Y-%m-%d")
    unpaid_bills = Bill.query.filter(
        Bill.user_id == user_id,
        Bill.is_paid == False,
        Bill.due_date >= now_str,
        Bill.due_date <= next_30_str
    ).all()
    total_due_30 = sum(b.amount for b in unpaid_bills)

    # Current liquid assets
    cash_assets = db.session.query(db.func.sum(Asset.value)).filter(
        Asset.user_id == user_id, Asset.category.in_(["cash", "savings"])
    ).scalar() or 0.0
    liquid_reserves = max(0.0, (total_inc_all - total_exp_all) + cash_assets)

    if total_due_30 > 0:
        coverage = (liquid_reserves / total_due_30) if total_due_30 > 0 else 999.0
        if coverage >= 2.0:
            ob_status = "Well Covered"
            ob_badge = "success"
            what_ob = f"Liquid funds cover upcoming 30-day obligations by {coverage:.1f}x."
        elif coverage >= 1.0:
            ob_status = "Covered"
            ob_badge = "warning"
            what_ob = f"Available funds cover upcoming bills, but buffer is narrow ({coverage:.1f}x)."
        else:
            ob_status = "Attention Needed"
            ob_badge = "danger"
            what_ob = f"Upcoming obligations ({currency}{total_due_30:,.2f}) exceed current liquid reserves ({currency}{liquid_reserves:,.2f})."
        why_ob = f"{len(unpaid_bills)} bills totaling {currency}{total_due_30:,.2f} are due in the next 30 days."
        data_support_ob = f"Liquid reserves: {currency}{liquid_reserves:,.2f} vs Obligations: {currency}{total_due_30:,.2f}."
    else:
        ob_status = "Clear"
        ob_badge = "success"
        what_ob = "No upcoming unpaid bills scheduled in the next 30 days."
        why_ob = "All recorded bills are either settled or scheduled beyond 30 days."
        data_support_ob = f"0 pending bills due before {next_30_str}."

    return {
        "has_data": True,
        "evaluated_at": now.isoformat(),
        "indicators": [
            {
                "key": "spending_stability",
                "title": "Spending Stability",
                "status": stability_status,
                "badge": stability_badge,
                "what_changed": what,
                "why_it_changed": why,
                "data_support": data_support,
            },
            {
                "key": "savings_progress",
                "title": "Savings Progress",
                "status": savings_status,
                "badge": savings_badge,
                "what_changed": what_sav,
                "why_it_changed": why_sav,
                "data_support": data_support_sav,
            },
            {
                "key": "recurring_load",
                "title": "Recurring-Cost Load",
                "status": rec_status,
                "badge": rec_badge,
                "what_changed": what_rec,
                "why_it_changed": why_rec,
                "data_support": data_support_rec,
            },
            {
                "key": "cash_flow_consistency",
                "title": "Cash-Flow Consistency",
                "status": cf_status,
                "badge": cf_badge,
                "what_changed": what_cf,
                "why_it_changed": why_cf,
                "data_support": data_support_cf,
            },
            {
                "key": "goal_progress",
                "title": "Goal Progress",
                "status": goal_status,
                "badge": goal_badge,
                "what_changed": what_goal,
                "why_it_changed": why_goal,
                "data_support": data_support_goal,
            },
            {
                "key": "obligation_load",
                "title": "Upcoming Obligation Load",
                "status": ob_status,
                "badge": ob_badge,
                "what_changed": what_ob,
                "why_it_changed": why_ob,
                "data_support": data_support_ob,
            },
        ]
    }
