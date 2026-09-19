from datetime import datetime, timedelta, timezone
from models import db, User, Transaction, Goal, RecurringPayment, Bill, Asset, Scenario, ScenarioChange

def calculate_baseline_metrics(user_id: int):
    """
    Computes real recorded financial metrics as the foundation for simulations:
    - Current liquid balance
    - Average monthly income (last 3-6 months or user setting)
    - Average monthly expenses
    - Total monthly recurring obligations
    - Total active goal contributions
    """
    user = db.session.get(User, user_id)
    if not user:
        return None

    # Calculate real liquid balance from transactions + cash assets
    income_sum = db.session.query(db.func.sum(Transaction.amount)).filter(
        Transaction.user_id == user_id, Transaction.type == "income"
    ).scalar() or 0.0

    expense_sum = db.session.query(db.func.sum(Transaction.amount)).filter(
        Transaction.user_id == user_id, Transaction.type == "expense"
    ).scalar() or 0.0

    # Cash & savings assets
    liquid_assets = db.session.query(db.func.sum(Asset.value)).filter(
        Asset.user_id == user_id, Asset.category.in_(["cash", "savings"])
    ).scalar() or 0.0

    current_balance = (income_sum - expense_sum) + liquid_assets

    # Monthly recurring expenses from active recurring payments & bills
    recurring_items = RecurringPayment.query.filter_by(user_id=user_id, status="active").all()
    monthly_recurring_cost = 0.0
    for r in recurring_items:
        if r.frequency == "monthly":
            monthly_recurring_cost += r.amount
        elif r.frequency == "weekly":
            monthly_recurring_cost += r.amount * 4.33
        elif r.frequency == "daily":
            monthly_recurring_cost += r.amount * 30.0
        elif r.frequency == "yearly":
            monthly_recurring_cost += r.amount / 12.0

    # Determine base monthly income
    monthly_income = user.monthly_income
    if monthly_income <= 0.0:
        # Fallback to recorded income transactions over last 90 days
        cutoff = (datetime.now(timezone.utc) - timedelta(days=90)).strftime("%Y-%m-%d")
        recent_income = db.session.query(db.func.sum(Transaction.amount)).filter(
            Transaction.user_id == user_id, Transaction.type == "income", Transaction.date >= cutoff
        ).scalar() or 0.0
        monthly_income = round(recent_income / 3.0, 2) if recent_income > 0 else 0.0

    # Determine non-recurring average discretionary spending
    cutoff_90 = (datetime.now(timezone.utc) - timedelta(days=90)).strftime("%Y-%m-%d")
    recent_expense = db.session.query(db.func.sum(Transaction.amount)).filter(
        Transaction.user_id == user_id, Transaction.type == "expense", Transaction.date >= cutoff_90
    ).scalar() or 0.0
    avg_monthly_expense = round(recent_expense / 3.0, 2) if recent_expense > 0 else monthly_recurring_cost
    if avg_monthly_expense < monthly_recurring_cost:
        avg_monthly_expense = monthly_recurring_cost

    # Active goal commitments
    active_goals = Goal.query.filter_by(user_id=user_id, status="active").all()
    monthly_goal_savings = sum(g.monthly_contribution for g in active_goals)

    return {
        "current_balance": round(current_balance, 2),
        "monthly_income": round(monthly_income, 2),
        "monthly_expense": round(avg_monthly_expense, 2),
        "monthly_recurring_cost": round(monthly_recurring_cost, 2),
        "monthly_goal_savings": round(monthly_goal_savings, 2),
        "currency": user.currency,
    }

def run_twin_simulation(user_id: int, scenario_changes_list: list, months: int = 12):
    """
    Runs the 12-month Financial Twin simulation.
    Strictly isolated: does NOT create or mutate any records in the transactions table.
    """
    baseline = calculate_baseline_metrics(user_id)
    if not baseline:
        return {"error": "User not found"}

    now = datetime.now(timezone.utc)
    month_labels = []
    baseline_timeline = []
    simulated_timeline = []

    base_balance = baseline["current_balance"]
    sim_balance = base_balance

    base_inc = baseline["monthly_income"]
    base_exp = baseline["monthly_expense"]
    base_savings = max(0.0, base_inc - base_exp)

    goals = Goal.query.filter_by(user_id=user_id, status="active").all()

    for m in range(months):
        target_date = now + timedelta(days=30 * m)
        label = target_date.strftime("%b %Y")
        month_labels.append(label)

        # Baseline projection for this month
        base_net = base_inc - base_exp
        base_balance += base_net
        baseline_timeline.append({
            "month_index": m,
            "label": label,
            "income": round(base_inc, 2),
            "expense": round(base_exp, 2),
            "net_cashflow": round(base_net, 2),
            "cumulative_balance": round(base_balance, 2),
        })

        # Calculate adjustments for this month from scenario changes
        sim_inc_delta = 0.0
        sim_exp_delta = 0.0

        for ch in scenario_changes_list:
            ch_type = ch.get("change_type", "")
            amount = float(ch.get("amount", 0.0))
            offset = int(ch.get("start_month_offset", 0))
            freq = ch.get("frequency", "once")

            if ch_type == "one_off_expense":
                if m == offset:
                    sim_exp_delta += amount
            elif ch_type == "income_change":
                if freq == "monthly" and m >= offset:
                    sim_inc_delta += amount
                elif freq == "once" and m == offset:
                    sim_inc_delta += amount
            elif ch_type == "recurring_expense":
                # Can be positive (new subscription/rent hike) or negative (canceled service)
                if freq == "monthly" and m >= offset:
                    sim_exp_delta += amount
                elif freq == "once" and m == offset:
                    sim_exp_delta += amount
            elif ch_type == "savings_boost":
                # Diverts to savings: increases savings allocation
                if freq == "monthly" and m >= offset:
                    sim_exp_delta += 0.0  # Kept in savings

        month_sim_inc = max(0.0, base_inc + sim_inc_delta)
        month_sim_exp = max(0.0, base_exp + sim_exp_delta)
        month_sim_net = month_sim_inc - month_sim_exp
        sim_balance += month_sim_net

        simulated_timeline.append({
            "month_index": m,
            "label": label,
            "income": round(month_sim_inc, 2),
            "expense": round(month_sim_exp, 2),
            "net_cashflow": round(month_sim_net, 2),
            "cumulative_balance": round(sim_balance, 2),
            "diff_from_baseline": round(sim_balance - base_balance, 2),
        })

    # Evaluate goal impacts
    goal_impacts = []
    for g in goals:
        rem = max(0.0, g.target_amount - g.current_amount)
        if g.monthly_contribution > 0:
            base_months_to_complete = rem / g.monthly_contribution
        else:
            base_months_to_complete = 999.0

        # In simulation, determine if final balance allows funding or if delayed
        final_sim_diff = simulated_timeline[-1]["diff_from_baseline"]
        status_note = "Unchanged"
        delayed_months = 0
        if final_sim_diff < -rem * 0.2:
            # Significant drain, delayed
            delayed_months = max(1, int(abs(final_sim_diff) / (g.monthly_contribution or 1000)))
            status_note = f"Likely delayed by ~{delayed_months} month(s)"
        elif final_sim_diff > rem * 0.2:
            status_note = "Can be accelerated"

        goal_impacts.append({
            "goal_id": g.id,
            "goal_name": g.name,
            "target_amount": g.target_amount,
            "remaining": rem,
            "baseline_est_months": round(base_months_to_complete, 1) if base_months_to_complete < 900 else "N/A",
            "simulation_impact": status_note,
            "delayed_months": delayed_months,
        })

    return {
        "baseline_summary": baseline,
        "labels": month_labels,
        "baseline_timeline": baseline_timeline,
        "simulated_timeline": simulated_timeline,
        "final_baseline_balance": round(base_balance, 2),
        "final_simulated_balance": round(sim_balance, 2),
        "net_difference": round(sim_balance - base_balance, 2),
        "goal_impacts": goal_impacts,
    }

def analyze_purchase_impact(user_id: int, item_name: str, price: float, planned_date: str):
    """
    Purchase Impact Analyzer:
    Analyzes how an upcoming planned purchase impacts cash liquidity, upcoming obligations, and goals.
    Does NOT finalize or make purchasing decisions for the user; presents clear factual data.
    """
    baseline = calculate_baseline_metrics(user_id)
    if not baseline:
        return {"error": "User not found"}

    curr_balance = baseline["current_balance"]

    # Check upcoming bills in the next 30 days
    now = datetime.now(timezone.utc)
    next_30 = (now + timedelta(days=30)).strftime("%Y-%m-%d")
    upcoming_bills = Bill.query.filter(
        Bill.user_id == user_id,
        Bill.is_paid == False,
        Bill.due_date <= next_30
    ).all()
    upcoming_bills_total = sum(b.amount for b in upcoming_bills)

    # Remaining funds after purchase and upcoming bills
    remaining_after_purchase = curr_balance - price
    buffer_after_obligations = remaining_after_purchase - upcoming_bills_total

    # Impact assessment
    monthly_inc = baseline["monthly_income"]
    emergency_threshold = baseline["monthly_expense"] * 1.5  # Recommended safety margin

    safety_rating = "Healthy"
    if buffer_after_obligations < 0:
        safety_rating = "Deficit Risk"
        explanation = f"Purchasing {item_name} for {baseline['currency']}{price:,.2f} leaves a projected deficit of {baseline['currency']}{abs(buffer_after_obligations):,.2f} after accounting for upcoming obligations."
    elif buffer_after_obligations < emergency_threshold:
        safety_rating = "Tight Buffer"
        explanation = f"Purchasing {item_name} leaves {baseline['currency']}{buffer_after_obligations:,.2f} liquid reserve, which is lower than your estimated 1.5-month expense buffer."
    else:
        safety_rating = "Comfortable"
        explanation = f"Your recorded available funds absorb the {baseline['currency']}{price:,.2f} purchase with {baseline['currency']}{buffer_after_obligations:,.2f} remaining above known obligations."

    # Simulation impact on 12-month trajectory
    single_change = [{
        "change_type": "one_off_expense",
        "title": f"Purchase {item_name}",
        "amount": price,
        "frequency": "once",
        "start_month_offset": 0,
    }]
    twin_results = run_twin_simulation(user_id, single_change, months=6)

    return {
        "item_name": item_name,
        "price": price,
        "planned_date": planned_date,
        "currency": baseline["currency"],
        "current_available_funds": curr_balance,
        "upcoming_known_obligations": upcoming_bills_total,
        "upcoming_bills_count": len(upcoming_bills),
        "projected_remaining_funds": round(remaining_after_purchase, 2),
        "buffer_after_known_obligations": round(buffer_after_obligations, 2),
        "safety_rating": safety_rating,
        "explanation": explanation,
        "goal_impacts": twin_results.get("goal_impacts", []),
    }

def forecast_upcoming_expenses(user_id: int, days: int = 30) -> dict:
    """
    Expense Forecast:
    Estimates upcoming expenses based strictly on historical patterns, bills, and recurring commitments.
    Every projection is clearly labeled as Estimated with its historical basis.
    """
    baseline = calculate_baseline_metrics(user_id)
    if not baseline:
        return {"error": "User not found"}

    now = datetime.now(timezone.utc)
    future_limit = (now + timedelta(days=days)).strftime("%Y-%m-%d")
    today_str = now.strftime("%Y-%m-%d")

    forecast_items = []

    # 1. Unpaid Bills in window
    bills = Bill.query.filter(
        Bill.user_id == user_id,
        Bill.is_paid == False,
        Bill.due_date >= today_str,
        Bill.due_date <= future_limit
    ).order_by(Bill.due_date.asc()).all()

    for b in bills:
        forecast_items.append({
            "title": b.title,
            "type": "Bill",
            "expected_date": b.due_date,
            "estimated_amount": b.amount,
            "category": b.category.name if b.category else "Bills & Utilities",
            "historical_basis": "Scheduled recurring bill in Ledger",
            "is_estimated": False,
            "confidence": "High",
        })

    # 2. Recurring payments due
    recurring = RecurringPayment.query.filter_by(user_id=user_id, status="active").all()
    for r in recurring:
        next_due = r.next_due_date or today_str
        if today_str <= next_due <= future_limit:
            forecast_items.append({
                "title": r.name,
                "type": "Subscription / Recurring",
                "expected_date": next_due,
                "estimated_amount": r.amount,
                "category": r.category.name if r.category else "Subscriptions",
                "historical_basis": f"Active {r.frequency} recurring commitment",
                "is_estimated": True,
                "confidence": "High",
            })

    # 3. Regular category discretionary estimates
    # Based on 60-day historical average
    cutoff_60 = (now - timedelta(days=60)).strftime("%Y-%m-%d")
    recent_txs = Transaction.query.filter(
        Transaction.user_id == user_id,
        Transaction.type == "expense",
        Transaction.date >= cutoff_60
    ).all()

    cat_totals = {}
    for t in recent_txs:
        c_name = t.category.name if t.category else "Discretionary"
        cat_totals[c_name] = cat_totals.get(c_name, 0.0) + t.amount

    for c_name, tot in cat_totals.items():
        # Scale to window
        est_window_spend = round((tot / 60.0) * days, 2)
        if est_window_spend > 0 and c_name not in ["Bills", "Utilities & Bills"]:
            forecast_items.append({
                "title": f"Regular {c_name}",
                "type": "Category Run-Rate",
                "expected_date": f"Throughout next {days} days",
                "estimated_amount": est_window_spend,
                "category": c_name,
                "historical_basis": f"Projected from recorded 60-day average ({baseline['currency']}{round(tot/2, 2)}/mo)",
                "is_estimated": True,
                "confidence": "Medium",
            })

    total_forecasted = round(sum(item["estimated_amount"] for item in forecast_items), 2)

    return {
        "currency": baseline["currency"],
        "forecast_days": days,
        "total_estimated_outflow": total_forecasted,
        "current_balance": baseline["current_balance"],
        "projected_balance_after_forecast": round(baseline["current_balance"] - total_forecasted, 2),
        "forecast_items": sorted(forecast_items, key=lambda x: str(x["expected_date"])),
    }

def simulate_emergency_fund(user_id: int, target_amount: float = None, current_amount: float = None, contribution_tiers: list = None) -> dict:
    """
    Emergency Fund Simulator:
    Simulates time-to-target for multiple monthly saving tiers (e.g. ₹2k, ₹5k, ₹8k/mo)
    against either user-specified target or a recommended 3 to 6-month expense safety net.
    """
    baseline = calculate_baseline_metrics(user_id)
    if not baseline:
        return {"error": "User not found"}

    monthly_exp = baseline["monthly_expense"] or 20000.0
    rec_3_months = round(monthly_exp * 3.0, 2)
    rec_6_months = round(monthly_exp * 6.0, 2)

    target = float(target_amount) if target_amount and float(target_amount) > 0 else rec_6_months
    current = float(current_amount) if current_amount is not None else baseline["current_balance"]
    remaining = max(0.0, target - current)

    tiers = contribution_tiers or [2000.0, 5000.0, 8000.0]
    # Adjust tiers dynamically if baseline income is much higher or different currency
    if baseline["currency"] != "₹" or baseline["monthly_income"] > 100000.0:
        base_step = round(max(100.0, (baseline["monthly_income"] * 0.1) / 100.0) * 100.0, 2)
        tiers = [base_step, base_step * 2.0, base_step * 3.0]

    scenarios = []
    for contrib in tiers:
        contrib = float(contrib)
        months_needed = round(remaining / contrib, 1) if contrib > 0 else 999.0
        now = datetime.now(timezone.utc)
        target_date_est = (now + timedelta(days=int(months_needed * 30.4))).strftime("%B %Y") if months_needed < 600 else "N/A"

        scenarios.append({
            "monthly_contribution": contrib,
            "months_to_target": months_needed if months_needed < 600 else "Over 50 years",
            "estimated_completion_date": target_date_est,
            "feasibility_note": (
                "Comfortable within current monthly surplus"
                if (baseline["monthly_income"] - baseline["monthly_expense"]) >= contrib
                else "Exceeds current observed monthly surplus"
            ),
        })

    return {
        "currency": baseline["currency"],
        "target_amount": target,
        "current_amount": current,
        "remaining_to_fund": remaining,
        "recommended_3_months": rec_3_months,
        "recommended_6_months": rec_6_months,
        "monthly_expense_basis": monthly_exp,
        "scenarios": scenarios,
    }

def simulate_income_change(user_id: int, income_delta: float, duration_months: int = 12, change_label: str = "Income Modification") -> dict:
    """
    Income Change Simulator:
    Simulates higher, lower, or temporary income interruption without modifying real records.
    """
    baseline = calculate_baseline_metrics(user_id)
    if not baseline:
        return {"error": "User not found"}

    change_payload = [{
        "change_type": "income_change",
        "title": change_label,
        "amount": income_delta,
        "frequency": "monthly",
        "start_month_offset": 0,
    }]

    twin_sim = run_twin_simulation(user_id, change_payload, months=duration_months)

    new_monthly_income = max(0.0, baseline["monthly_income"] + income_delta)
    new_monthly_surplus = round(new_monthly_income - baseline["monthly_expense"], 2)

    return {
        "change_label": change_label,
        "income_delta": income_delta,
        "baseline_monthly_income": baseline["monthly_income"],
        "simulated_monthly_income": new_monthly_income,
        "simulated_monthly_surplus": new_monthly_surplus,
        "currency": baseline["currency"],
        "is_positive": income_delta >= 0,
        "twin_simulation": twin_sim,
    }

def simulate_life_event_impact(user_id: int, event_name: str, cost: float, target_date: str, recurring_cost_delta: float = 0.0, income_delta: float = 0.0) -> dict:
    """
    Life Event Simulator:
    Clearly distinguishes:
    1. Actual Data (recorded balance, income, expenses)
    2. User Estimates (event cost, recurring delta, income delta)
    3. Simulation Results (projected 12-month trajectory, goal impacts)
    """
    baseline = calculate_baseline_metrics(user_id)
    if not baseline:
        return {"error": "User not found"}

    # Calculate month offset for target_date
    now = datetime.now(timezone.utc)
    offset_months = 0
    try:
        t_dt = datetime.strptime(target_date, "%Y-%m-%d")
        diff_days = (t_dt - now).days
        offset_months = max(0, min(11, int(diff_days / 30.4)))
    except Exception:
        offset_months = 0

    changes = []
    if cost > 0:
        changes.append({
            "change_type": "one_off_expense",
            "title": f"{event_name} Initial Cost",
            "amount": cost,
            "frequency": "once",
            "start_month_offset": offset_months,
        })
    if recurring_cost_delta != 0:
        changes.append({
            "change_type": "recurring_expense",
            "title": f"{event_name} Recurring Change",
            "amount": recurring_cost_delta,
            "frequency": "monthly",
            "start_month_offset": offset_months,
        })
    if income_delta != 0:
        changes.append({
            "change_type": "income_change",
            "title": f"{event_name} Income Change",
            "amount": income_delta,
            "frequency": "monthly",
            "start_month_offset": offset_months,
        })

    twin_sim = run_twin_simulation(user_id, changes, months=12)

    return {
        "event_name": event_name,
        "target_date": target_date,
        "offset_months": offset_months,
        "currency": baseline["currency"],
        "actual_data": {
            "current_liquid_balance": baseline["current_balance"],
            "monthly_income": baseline["monthly_income"],
            "monthly_expense": baseline["monthly_expense"],
            "monthly_surplus": round(baseline["monthly_income"] - baseline["monthly_expense"], 2),
        },
        "user_estimates": {
            "initial_event_cost": cost,
            "recurring_monthly_cost_change": recurring_cost_delta,
            "monthly_income_change": income_delta,
        },
        "simulation_results": {
            "final_projected_balance": twin_sim["final_simulated_balance"],
            "net_difference_from_plan": twin_sim["net_difference"],
            "timeline": twin_sim["simulated_timeline"],
            "goal_impacts": twin_sim["goal_impacts"],
        }
    }
