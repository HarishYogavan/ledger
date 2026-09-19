from datetime import datetime, timezone
from collections import defaultdict
from models import db, User, Transaction, Category

def analyze_expense_dna(user_id: int) -> dict:
    """
    Expense DNA Analyzer:
    Detects repeated patterns, frequent small purchases (Money Leak Map),
    weekend vs weekday splits, merchant patterns, and category trajectories.
    Uses strictly neutral, objective language and factual data links.
    """
    user = db.session.get(User, user_id)
    if not user:
        return {"error": "User not found"}

    currency = user.currency
    txs = Transaction.query.filter_by(user_id=user_id, type="expense").order_by(Transaction.date.asc()).all()

    if len(txs) < 2:
        return {
            "has_data": False,
            "currency": currency,
            "message": "Add transactions over multiple days to generate your Expense DNA.",
            "dna_patterns": [],
            "money_leaks": [],
            "weekday_weekend": {},
            "merchant_patterns": [],
            "category_trends": [],
        }

    # 1. Money Leak Map: Repeated small expenses (< 500 currency units or small ticket threshold)
    # Group small transactions by normalized merchant or category
    small_threshold = 500.0 if currency in ["₹", "Rs", "INR"] else 15.0
    small_txs = [t for t in txs if t.amount <= small_threshold]
    small_grouped = defaultdict(list)
    for t in small_txs:
        merchant_name = (t.merchant or t.notes or "General Small Expense").strip()
        cat_name = t.category.name if t.category else "Uncategorized"
        key = f"{merchant_name}::{cat_name}"
        small_grouped[key].append(t)

    # Determine timespan in months
    try:
        first_date = datetime.strptime(txs[0].date, "%Y-%m-%d")
        last_date = datetime.strptime(txs[-1].date, "%Y-%m-%d")
        days_span = max(1, (last_date - first_date).days)
        months_span = max(1.0, days_span / 30.4)
    except Exception:
        months_span = 1.0

    money_leaks = []
    for key, group in small_grouped.items():
        if len(group) >= 2:
            merchant_name, cat_name = key.split("::")
            total_spent = sum(t.amount for t in group)
            monthly_est = round(total_spent / months_span, 2)
            yearly_est = round(monthly_est * 12.0, 2)
            avg_amt = round(total_spent / len(group), 2)

            freq_desc = "frequent" if len(group) >= 5 else "occasional"
            money_leaks.append({
                "merchant": merchant_name,
                "category": cat_name,
                "transaction_count": len(group),
                "total_amount": round(total_spent, 2),
                "average_amount": avg_amt,
                "monthly_total": monthly_est,
                "estimated_yearly_total": yearly_est,
                "frequency_label": f"{len(group)} transactions over {int(months_span)} mo",
                "underlying_transactions": [t.to_dict() for t in group],
            })

    money_leaks.sort(key=lambda x: x["total_amount"], reverse=True)

    # 2. Weekday vs Weekend Analysis
    weekday_txs = []
    weekend_txs = []
    for t in txs:
        try:
            dt = datetime.strptime(t.date, "%Y-%m-%d")
            # 0=Mon..4=Fri (Weekday: Mon-Thu or Mon-Fri), let's say Mon-Thu vs Fri-Sun or Sat-Sun
            if dt.weekday() in [5, 6]:  # Saturday, Sunday
                weekend_txs.append(t)
            else:
                weekday_txs.append(t)
        except Exception:
            weekday_txs.append(t)

    weekday_total = sum(t.amount for t in weekday_txs)
    weekend_total = sum(t.amount for t in weekend_txs)
    total_exp = weekday_total + weekend_total

    weekday_pct = round((weekday_total / total_exp * 100.0), 1) if total_exp > 0 else 0.0
    weekend_pct = round((weekend_total / total_exp * 100.0), 1) if total_exp > 0 else 0.0

    weekday_weekend = {
        "weekday_total": round(weekday_total, 2),
        "weekend_total": round(weekend_total, 2),
        "weekday_percent": weekday_pct,
        "weekend_percent": weekend_pct,
        "weekday_count": len(weekday_txs),
        "weekend_count": len(weekend_txs),
        "weekday_average": round(weekday_total / len(weekday_txs), 2) if weekday_txs else 0.0,
        "weekend_average": round(weekend_total / len(weekend_txs), 2) if weekend_txs else 0.0,
        "observation": (
            f"Weekend spending represents {weekend_pct}% of total outflows with an average ticket of {currency}{round(weekend_total / len(weekend_txs), 2) if weekend_txs else 0:,.2f}."
            if weekend_txs else "All recorded spending occurred on weekdays."
        ),
    }

    # 3. Repeated Merchant Patterns
    merchant_groups = defaultdict(list)
    for t in txs:
        m_name = (t.merchant or "Unspecified").strip()
        if m_name and m_name.lower() != "unspecified":
            merchant_groups[m_name].append(t)

    merchant_patterns = []
    for m_name, group in merchant_groups.items():
        if len(group) >= 2:
            tot = sum(t.amount for t in group)
            avg = tot / len(group)
            merchant_patterns.append({
                "merchant": m_name,
                "count": len(group),
                "total": round(tot, 2),
                "average": round(avg, 2),
                "last_date": group[-1].date,
                "first_date": group[0].date,
                "category": group[-1].category.name if group[-1].category else "General",
                "trend": "Stable" if abs(group[-1].amount - group[0].amount) / (group[0].amount or 1) < 0.2 else ("Increasing" if group[-1].amount > group[0].amount else "Decreasing"),
                "sample_transactions": [t.to_dict() for t in group[-5:]],
            })
    merchant_patterns.sort(key=lambda x: x["count"], reverse=True)

    # 4. Category Trajectories & Seasonal/Trend Detection
    # Group by month and category
    cat_by_month = defaultdict(lambda: defaultdict(float))
    months_seen = set()
    for t in txs:
        m_key = t.date[:7]
        months_seen.add(m_key)
        cat_name = t.category.name if t.category else "Uncategorized"
        cat_by_month[cat_name][m_key] += t.amount

    sorted_months = sorted(list(months_seen))
    category_trends = []
    for cat_name, m_data in cat_by_month.items():
        monthly_series = [{"month": m, "amount": round(m_data.get(m, 0.0), 2)} for m in sorted_months]
        if len(sorted_months) >= 2:
            m1 = m_data.get(sorted_months[-2], 0.0)
            m2 = m_data.get(sorted_months[-1], 0.0)
            if m1 > 0:
                pct = round(((m2 - m1) / m1) * 100.0, 1)
                trend_direction = "Increasing" if pct > 10.0 else ("Decreasing" if pct < -10.0 else "Stable")
            else:
                pct = 0.0
                trend_direction = "New / Fluctuating"
        else:
            pct = 0.0
            trend_direction = "Baseline Establishing"

        category_trends.append({
            "category": cat_name,
            "trend_direction": trend_direction,
            "recent_change_pct": pct,
            "monthly_series": monthly_series,
            "total_recorded": round(sum(m_data.values()), 2),
        })

    category_trends.sort(key=lambda x: x["total_recorded"], reverse=True)

    # 5. Synthesis DNA Patterns List
    dna_patterns = []
    if weekend_pct >= 40.0:
        dna_patterns.append({
            "pattern": "High Weekend Concentration",
            "category": "Temporal Rhythm",
            "frequency": f"{weekend_pct}% of total spend",
            "observation": f"{currency}{weekend_total:,.2f} spent across {len(weekend_txs)} weekend transactions.",
            "neutral_insight": "A notable proportion of discretionary outflow clusters on Saturdays and Sundays.",
        })
    elif weekend_pct <= 15.0 and len(txs) >= 5:
        dna_patterns.append({
            "pattern": "Weekday Dominant",
            "category": "Temporal Rhythm",
            "frequency": f"{weekday_pct}% of spend",
            "observation": f"{currency}{weekday_total:,.2f} recorded between Monday and Friday.",
            "neutral_insight": "Expenditure is concentrated primarily during standard weekday working hours.",
        })

    if money_leaks:
        top_leak = money_leaks[0]
        dna_patterns.append({
            "pattern": f"Frequent Small Outflows: {top_leak['merchant']}",
            "category": "Micro-Expenses",
            "frequency": f"{top_leak['transaction_count']} transactions",
            "observation": f"{currency}{top_leak['total_amount']:,.2f} cumulative ({currency}{top_leak['monthly_total']:,.2f}/month est.).",
            "neutral_insight": f"Small repeated transactions under {currency}{small_threshold:,.0f} aggregate over time.",
        })

    if merchant_patterns:
        top_m = merchant_patterns[0]
        dna_patterns.append({
            "pattern": f"Primary Outflow Anchor: {top_m['merchant']}",
            "category": "Merchant Loyalty",
            "frequency": f"{top_m['count']} transactions",
            "observation": f"{currency}{top_m['total']:,.2f} total expenditure recorded.",
            "neutral_insight": f"Frequent recurring transactions associated with {top_m['merchant']}.",
        })

    return {
        "has_data": True,
        "currency": currency,
        "total_analyzed_transactions": len(txs),
        "dna_patterns": dna_patterns,
        "money_leaks": money_leaks,
        "weekday_weekend": weekday_weekend,
        "merchant_patterns": merchant_patterns,
        "category_trends": category_trends,
    }
