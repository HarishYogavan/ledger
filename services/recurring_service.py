from datetime import datetime, timedelta, timezone
from collections import defaultdict
from models import db, Transaction, RecurringPayment, Category

def detect_recurring_patterns(user_id: int):
    """
    Analyzes user's actual transaction history to discover recurring payments,
    subscriptions, bills, and salary patterns.
    """
    # Fetch all user transactions sorted by date
    txs = Transaction.query.filter_by(user_id=user_id).order_by(Transaction.date.asc()).all()
    if len(txs) < 2:
        return []

    # Group by normalized merchant or title
    grouped = defaultdict(list)
    for t in txs:
        key = (t.merchant or t.notes or "Unknown").strip().lower()
        if key and key != "unknown":
            grouped[key].append(t)

    detected = []

    for merchant_key, group in grouped.items():
        if len(group) < 2:
            continue

        dates = []
        amounts = []
        for t in group:
            try:
                dt = datetime.strptime(t.date, "%Y-%m-%d")
                dates.append(dt)
                amounts.append(t.amount)
            except Exception:
                continue

        if len(dates) < 2:
            continue

        # Calculate day intervals between consecutive occurrences
        intervals = [(dates[i] - dates[i-1]).days for i in range(1, len(dates))]
        if not intervals:
            continue

        avg_interval = sum(intervals) / len(intervals)
        avg_amount = sum(amounts) / len(amounts)

        frequency = None
        if 5 <= avg_interval <= 9:
            frequency = "weekly"
            interval_days = 7
        elif 12 <= avg_interval <= 16:
            frequency = "bi-weekly"
            interval_days = 14
        elif 25 <= avg_interval <= 35:
            frequency = "monthly"
            interval_days = 30
        elif 85 <= avg_interval <= 98:
            frequency = "quarterly"
            interval_days = 90
        elif 340 <= avg_interval <= 380:
            frequency = "yearly"
            interval_days = 365

        if frequency:
            last_date = dates[-1]
            last_amt = amounts[-1]
            next_due = (last_date + timedelta(days=interval_days)).strftime("%Y-%m-%d")

            # Annual cost calculation
            mult = 52 if frequency == "weekly" else 26 if frequency == "bi-weekly" else 12 if frequency == "monthly" else 4 if frequency == "quarterly" else 1
            annual_cost = round(avg_amount * mult, 2)

            # Anomaly check: compare last payment to previous average
            anomaly = None
            if len(amounts) >= 2:
                prior_avg = sum(amounts[:-1]) / (len(amounts) - 1)
                if prior_avg > 0:
                    pct_change = ((last_amt - prior_avg) / prior_avg) * 100.0
                    if pct_change >= 15.0:
                        anomaly = f"Latest payment is {pct_change:.1f}% higher than previous average ({group[-1].currency}{prior_avg:.2f})."
                    elif pct_change <= -15.0:
                        anomaly = f"Latest payment is {abs(pct_change):.1f}% lower than previous average ({group[-1].currency}{prior_avg:.2f})."

            detected.append({
                "merchant": group[-1].merchant or merchant_key.title(),
                "category_id": group[-1].category_id,
                "category_name": group[-1].category.name if group[-1].category else "General",
                "frequency": frequency,
                "occurrences_count": len(group),
                "average_amount": round(avg_amount, 2),
                "latest_amount": round(last_amt, 2),
                "last_payment_date": last_date.strftime("%Y-%m-%d"),
                "expected_next_payment": next_due,
                "estimated_annual_cost": annual_cost,
                "currency": group[-1].currency,
                "is_income": group[-1].type == "income",
                "anomaly_alert": anomaly,
            })

    return detected

def sync_detected_recurring(user_id: int):
    """
    Synchronizes high-confidence detected recurring patterns into the RecurringPayment table
    marked as is_auto_detected=True.
    """
    detected = detect_recurring_patterns(user_id)
    created_or_updated = 0

    for d in detected:
        existing = RecurringPayment.query.filter_by(
            user_id=user_id,
            name=d["merchant"]
        ).first()

        if not existing:
            new_rec = RecurringPayment(
                user_id=user_id,
                category_id=d["category_id"],
                name=d["merchant"],
                amount=d["average_amount"],
                frequency=d["frequency"] if d["frequency"] in ["weekly", "monthly", "yearly"] else "monthly",
                last_payment_date=d["last_payment_date"],
                next_due_date=d["expected_next_payment"],
                is_auto_detected=True,
                status="active"
            )
            db.session.add(new_rec)
            created_or_updated += 1
        else:
            # Update dates and average
            existing.last_payment_date = d["last_payment_date"]
            existing.next_due_date = d["expected_next_payment"]
            existing.amount = d["average_amount"]

    if created_or_updated > 0:
        db.session.commit()

    return detected
