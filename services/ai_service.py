import re
import json
from datetime import datetime, timedelta, timezone
import requests
from config import Config
from models import db, User, Transaction, Category, Goal, RecurringPayment, Bill, Asset, Liability, Purchase, FinancialMemory

def call_gemini_api(prompt: str, system_instruction: str = "") -> str | None:
    """Calls the Gemini API if GEMINI_API_KEY is configured in .env."""
    api_key = Config.GEMINI_API_KEY
    if not api_key:
        return None

    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}]
        }
        if system_instruction:
            payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}

        resp = requests.post(url, json=payload, timeout=12)
        if resp.status_code == 200:
            data = resp.json()
            candidates = data.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                if parts:
                    return parts[0].get("text", "").strip()
    except Exception:
        pass
    return None

def parse_natural_language_transaction(text: str, user_id: int):
    """
    Parses conversational phrases like:
    - 'Spent ₹450 at Starbucks today'
    - 'Received salary ₹45,000 today'
    - 'Paid electricity bill ₹1,200 yesterday'
    Returns candidate structured fields for user confirmation.
    """
    cleaned = text.strip()
    user = db.session.get(User, user_id)
    currency_symbol = user.currency if user else "₹"

    # 1. Type detection
    income_keywords = ["received", "got", "salary", "credited", "earned", "dividend", "income", "freelance", "refund"]
    expense_keywords = ["spent", "paid", "bought", "purchased", "ordered", "debited", "charged", "dinner", "lunch"]

    tx_type = "expense"
    lower = cleaned.lower()
    if any(k in lower for k in income_keywords) and not any(k in lower for k in ["spent", "paid"]):
        tx_type = "income"

    # 2. Amount extraction
    amount = 0.0
    amt_match = re.search(r'(?:[\$₹€£]|rs\.?|inr)?\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)', cleaned, re.IGNORECASE)
    if amt_match:
        try:
            amt_str = amt_match.group(1).replace(",", "")
            amount = float(amt_str)
        except Exception:
            amount = 0.0

    # 3. Date detection
    tx_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if "yesterday" in lower:
        tx_date = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")

    # 4. Merchant / Description detection
    merchant = ""
    # Look for "at <Merchant>", "from <Merchant>", "to <Merchant>", "on <Item>"
    at_match = re.search(r'(?:at|from|to|for)\s+([A-Za-z0-9\s&\'\.\-]+?)(?:\s+(?:today|yesterday|on|for|using|via|\$|₹|rs|$))', cleaned, re.IGNORECASE)
    if at_match:
        merchant = at_match.group(1).strip()
    else:
        # Fallback merchant
        words = [w for w in cleaned.split() if not any(c.isdigit() for c in w) and w.lower() not in ["spent", "paid", "received", "today", "yesterday", "at", "for", "on", "rs", "inr"]]
        if words:
            merchant = " ".join(words[:3])

    # 5. Category detection
    user_cats = Category.query.filter_by(user_id=user_id, type=tx_type).all()
    selected_cat_id = None
    selected_cat_name = "Other Expenses" if tx_type == "expense" else "Other Income"

    cat_map = {
        "food": ["restaurant", "cafe", "coffee", "starbucks", "dinner", "lunch", "breakfast", "swiggy", "zomato", "mcdonalds", "burger", "pizza"],
        "groceries": ["grocery", "supermarket", "blinkit", "zepto", "instamart", "milk", "vegetables", "fruits", "mart"],
        "transportation": ["uber", "ola", "cab", "taxi", "petrol", "diesel", "fuel", "metro", "bus", "train"],
        "utilities & bills": ["electricity", "power", "water", "wifi", "internet", "broadband", "mobile", "recharge", "gas", "bill"],
        "entertainment": ["netflix", "spotify", "prime", "movie", "cinema", "theatre", "game", "steam"],
        "shopping": ["amazon", "flipkart", "clothes", "shoes", "mall", "electronics", "store"],
        "healthcare": ["doctor", "hospital", "pharmacy", "medicine", "chemist", "clinic", "dental"],
        "salary": ["salary", "payroll", "company", "bonus"],
        "investments & dividends": ["dividend", "interest", "stock", "mutual fund", "crypto", "return"],
    }

    matched_cat_key = None
    for cat_key, kws in cat_map.items():
        if any(kw in lower for kw in kws):
            matched_cat_key = cat_key
            break

    if matched_cat_key:
        for c in user_cats:
            if matched_cat_key in c.name.lower():
                selected_cat_id = c.id
                selected_cat_name = c.name
                break

    if not selected_cat_id and user_cats:
        selected_cat_id = user_cats[0].id
        selected_cat_name = user_cats[0].name

    # Determine confidence
    confidence = "high" if amount > 0 and merchant else "medium" if amount > 0 else "low"

    return {
        "raw_query": cleaned,
        "type": tx_type,
        "amount": amount,
        "currency": currency_symbol,
        "merchant": merchant.title() if merchant else ("Income Source" if tx_type == "income" else "Expense"),
        "category_id": selected_cat_id,
        "category_name": selected_cat_name,
        "date": tx_date,
        "payment_method": "UPI" if currency_symbol == "₹" else "Card",
        "notes": f"Added via Quick Add: '{cleaned}'",
        "confidence": confidence,
    }

def generate_spending_summary(user_id: int) -> str:
    """
    Generates a personalized, strictly data-grounded spending explanation for the Dashboard.
    Does not invent facts or make guaranteed financial claims.
    """
    user = db.session.get(User, user_id)
    if not user:
        return ""

    currency = user.currency
    now = datetime.now(timezone.utc)
    curr_month = now.strftime("%Y-%m")
    last_month_dt = (now.replace(day=1) - timedelta(days=1))
    last_month = last_month_dt.strftime("%Y-%m")

    # Current month expenses by category
    curr_txs = Transaction.query.filter(
        Transaction.user_id == user_id,
        Transaction.type == "expense",
        Transaction.date.startswith(curr_month)
    ).all()

    if not curr_txs:
        return "You have no recorded expenses this month. Add your first transaction to begin tracking spending patterns."

    curr_total = sum(t.amount for t in curr_txs)

    # Group by category
    cat_spending = {}
    for t in curr_txs:
        cat_name = t.category.name if t.category else "Uncategorized"
        cat_spending[cat_name] = cat_spending.get(cat_name, 0.0) + t.amount

    sorted_cats = sorted(cat_spending.items(), key=lambda x: x[1], reverse=True)
    top_cat, top_amt = sorted_cats[0]
    top_pct = round((top_amt / curr_total * 100.0), 1)

    # Last month total
    last_txs = Transaction.query.filter(
        Transaction.user_id == user_id,
        Transaction.type == "expense",
        Transaction.date.startswith(last_month)
    ).all()
    last_total = sum(t.amount for t in last_txs)

    if last_total > 0:
        diff_pct = ((curr_total - last_total) / last_total) * 100.0
        if diff_pct > 10.0:
            comparison = f"higher by {diff_pct:.1f}% compared to {last_month_dt.strftime('%B')}"
        elif diff_pct < -10.0:
            comparison = f"lower by {abs(diff_pct):.1f}% compared to {last_month_dt.strftime('%B')}"
        else:
            comparison = f"tracking closely with {last_month_dt.strftime('%B')} (within {abs(diff_pct):.1f}%)"
    else:
        comparison = "forming your primary baseline for this period"

    second_cat_str = f" and {sorted_cats[1][0]}" if len(sorted_cats) > 1 else ""

    summary = (
        f"Your spending this month is {currency}{curr_total:,.2f}, which is {comparison}. "
        f"The primary driver is {top_cat} ({currency}{top_amt:,.2f}, {top_pct}% of total){second_cat_str}."
    )
    return summary

def ask_ledger_assistant(query: str, user_id: int) -> dict:
    """
    Answers natural-language user queries strictly using the user's recorded database.
    Honest, data-grounded, and informs the user if data is missing or insufficient.
    """
    user = db.session.get(User, user_id)
    if not user:
        return {"response": "User account could not be found."}

    currency = user.currency
    now = datetime.now(timezone.utc)
    curr_month = now.strftime("%Y-%m")
    last_month_dt = (now.replace(day=1) - timedelta(days=1))
    last_month = last_month_dt.strftime("%Y-%m")

    # Fetch context data
    all_txs = Transaction.query.filter_by(user_id=user_id).order_by(Transaction.date.desc()).all()
    categories = Category.query.filter_by(user_id=user_id).all()
    goals = Goal.query.filter_by(user_id=user_id).all()
    recurring = RecurringPayment.query.filter_by(user_id=user_id, status="active").all()
    bills = Bill.query.filter_by(user_id=user_id, is_paid=False).all()
    assets = Asset.query.filter_by(user_id=user_id).all()
    liabilities = Liability.query.filter_by(user_id=user_id).all()
    purchases = Purchase.query.filter_by(user_id=user_id, status="active").all()

    # Check user settings for AI Memory
    memories = []
    if not user.settings or user.settings.ai_memory_enabled:
        memories = FinancialMemory.query.filter_by(user_id=user_id, is_active=True).all()

    if not all_txs and not goals and not recurring and not assets and not memories:
        return {
            "response": "You don't have any financial transactions or accounts recorded in Ledger yet. "
                        "Add your first transaction, setup your goals, or complete onboarding so I can provide personalized answers."
        }

    # Prepare data context
    total_income_all = sum(t.amount for t in all_txs if t.type == "income")
    total_expense_all = sum(t.amount for t in all_txs if t.type == "expense")
    curr_month_exp = sum(t.amount for t in all_txs if t.type == "expense" and t.date.startswith(curr_month))
    curr_month_inc = sum(t.amount for t in all_txs if t.type == "income" and t.date.startswith(curr_month))
    last_month_exp = sum(t.amount for t in all_txs if t.type == "expense" and t.date.startswith(last_month))

    # Top expenses
    expenses = [t for t in all_txs if t.type == "expense"]
    biggest_expenses = sorted(expenses, key=lambda x: x.amount, reverse=True)[:5]

    # Category breakdown for current month
    cat_totals = {}
    for t in all_txs:
        c_name = t.category.name if t.category else "Uncategorized"
        cat_totals[c_name] = cat_totals.get(c_name, 0.0) + t.amount

    # Net worth
    total_assets = sum(a.value for a in assets)
    total_liabilities = sum(l.amount for l in liabilities)
    net_worth = total_assets - total_liabilities

    memories_str = "\n".join([f"- [User Note]: {m.title}: {m.content}" for m in memories]) if memories else "None"
    purchases_str = "\n".join([f"- {p.product_name} ({currency}{p.price:,.2f}, Warranty: {p.warranty_expiry or 'N/A'})" for p in purchases[:5]]) if purchases else "None"

    context_summary = f"""
Ledger User Financial Snapshot:
- Currency: {currency}
- Total Lifetime Income: {currency}{total_income_all:,.2f}
- Total Lifetime Expenses: {currency}{total_expense_all:,.2f}
- Current Month ({now.strftime('%B %Y')}): Income = {currency}{curr_month_inc:,.2f}, Expenses = {currency}{curr_month_exp:,.2f}
- Last Month ({last_month_dt.strftime('%B %Y')}): Expenses = {currency}{last_month_exp:,.2f}
- Active Goals: {len(goals)} goals (Total target: {currency}{sum(g.target_amount for g in goals):,.2f}, Saved: {currency}{sum(g.current_amount for g in goals):,.2f})
- Active Recurring Payments: {len(recurring)} items (Annualized: {currency}{sum(r.amount * (12 if r.frequency=='monthly' else 52 if r.frequency=='weekly' else 1) for r in recurring):,.2f})
- Unpaid Bills: {len(bills)} bills pending ({currency}{sum(b.amount for b in bills):,.2f})
- Total Assets: {currency}{total_assets:,.2f} | Total Liabilities: {currency}{total_liabilities:,.2f} | Net Worth: {currency}{net_worth:,.2f}
- Biggest Expenses: {', '.join([f'{t.merchant or t.category_name} ({currency}{t.amount:,.2f})' for t in biggest_expenses])}
- User Financial Memories / Stated Intentions:
{memories_str}
- Tracked Purchases & Warranties:
{purchases_str}
"""

    # If Gemini API Key exists, use it with strict system instruction
    if Config.GEMINI_API_KEY:
        sys_instruction = (
            "You are Ask Ledger AI, a professional, concise personal finance assistant. "
            "Answer the user's question using ONLY the factual financial snapshot provided below. "
            "Never invent transactions, dates, or estimates. "
            "If the requested data is not present in the records, state clearly that no such records exist. "
            "Provide informational insights without presenting uncertain forecasts as guarantees."
        )
        ai_resp = call_gemini_api(f"{context_summary}\n\nUser Question: {query}", sys_instruction)
        if ai_resp:
            return {"response": ai_resp, "source": "gemini"}

    # Fallback to local deterministic grounded query engine
    q_lower = query.lower()

    if any(k in q_lower for k in ["memory", "memories", "financial memory", "financial memories", "note", "notes", "intention", "goal note"]):
        if memories:
            m_list = [f"• {m.title}: {m.content}" for m in memories]
            return {
                "response": "Here are your saved Financial Memories:\n" + "\n".join(m_list),
                "source": "ledger_engine"
            }
        return {"response": "You currently have no saved Financial Memories. You can add notes in the AI tab.", "source": "ledger_engine"}

    if any(k in q_lower for k in ["warranty", "warranties", "expire", "expiration"]):
        if purchases:
            p_list = []
            for p in purchases:
                w_status = f"Expires on {p.warranty_expiry}" if p.warranty_expiry else "No warranty recorded"
                p_list.append(f"• {p.product_name} ({p.merchant}): {w_status}")
            return {
                "response": f"You have {len(purchases)} tracked purchases in your Vault:\n" + "\n".join(p_list),
                "source": "ledger_engine"
            }
        return {"response": "No tracked purchases or warranties found in your Purchase Vault.", "source": "ledger_engine"}

    if any(k in q_lower for k in ["food", "dining", "groceries", "restaurant"]):
        food_exp = sum(t.amount for t in all_txs if t.type == "expense" and t.category and any(w in t.category.name.lower() for w in ["food", "dining", "groceries"]))
        food_curr = sum(t.amount for t in all_txs if t.type == "expense" and t.date.startswith(curr_month) and t.category and any(w in t.category.name.lower() for w in ["food", "dining", "groceries"]))
        return {
            "response": f"Based on your recorded transactions, you have spent {currency}{food_curr:,.2f} on Food & Dining this month ({now.strftime('%B')}), and {currency}{food_exp:,.2f} overall across all recorded periods.",
            "source": "ledger_engine"
        }

    if any(k in q_lower for k in ["biggest expense", "largest expense", "highest expense", "top expense"]):
        if biggest_expenses:
            top_list = [f"• {t.merchant or t.category_name}: {currency}{t.amount:,.2f} on {t.date}" for t in biggest_expenses[:3]]
            return {
                "response": "Your largest recorded expenses are:\n" + "\n".join(top_list),
                "source": "ledger_engine"
            }
        return {"response": "No expenses recorded yet to determine biggest expenses.", "source": "ledger_engine"}

    if any(k in q_lower for k in ["recurring", "subscription", "bills"]):
        if recurring:
            rec_list = [f"• {r.name}: {currency}{r.amount:,.2f} ({r.frequency})" for r in recurring]
            return {
                "response": f"You have {len(recurring)} active recurring commitments:\n" + "\n".join(rec_list),
                "source": "ledger_engine"
            }
        return {"response": "You do not have any active recurring payments recorded in Ledger.", "source": "ledger_engine"}

    if any(k in q_lower for k in ["net worth", "assets", "liabilities", "worth"]):
        return {
            "response": f"Your recorded Net Worth is {currency}{net_worth:,.2f} (Total Assets: {currency}{total_assets:,.2f} minus Total Liabilities: {currency}{total_liabilities:,.2f}).",
            "source": "ledger_engine"
        }

    if any(k in q_lower for k in ["save", "savings", "saved"]):
        net_saved = total_income_all - total_expense_all
        return {
            "response": f"According to your recorded transactions, your lifetime net savings are {currency}{net_saved:,.2f}. This month ({now.strftime('%B')}), your net surplus is {currency}{(curr_month_inc - curr_month_exp):,.2f}.",
            "source": "ledger_engine"
        }

    if any(k in q_lower for k in ["goal", "goals", "milestone"]):
        if goals:
            g_list = [f"• {g.name}: {currency}{g.current_amount:,.2f} / {currency}{g.target_amount:,.2f} ({g.to_dict()['progress_percent']}%) by {g.target_date}" for g in goals]
            return {
                "response": f"Here is the status of your {len(goals)} financial goals:\n" + "\n".join(g_list),
                "source": "ledger_engine"
            }
        return {"response": "You currently have no financial goals configured. You can set goals in the Goals tab.", "source": "ledger_engine"}

    if any(k in q_lower for k in ["dna", "pattern", "leak", "money leak"]):
        return {
            "response": f"You can explore your complete behavioral breakdown and small-expense analysis in the Analytics → Expense DNA and Money Leak Map tabs.",
            "source": "ledger_engine"
        }

    # General overview response
    return {
        "response": (
            f"Here is your current Ledger financial status: "
            f"This month you have recorded {currency}{curr_month_inc:,.2f} in income and {currency}{curr_month_exp:,.2f} in expenses. "
            f"Your recorded net balance is {currency}{(total_income_all - total_expense_all):,.2f} with {len(goals)} active goals and {len(recurring)} recurring commitments."
        ),
        "source": "ledger_engine"
    }

def generate_monthly_financial_story(user_id: int, month_str: str = None) -> dict:
    """
    Monthly Financial Story:
    Creates a visual, narrative financial report for a chosen month (YYYY-MM).
    Covers: Income, Expenses, Savings, Net Worth, Biggest Categories, Major Transactions,
    Goal Progress, Recurring Payments, and a data-grounded AI narrative.
    """
    user = db.session.get(User, user_id)
    if not user:
        return {"error": "User not found"}

    currency = user.currency
    now = datetime.now(timezone.utc)
    if not month_str:
        month_str = now.strftime("%Y-%m")

    # Transactions for this month
    txs = Transaction.query.filter(
        Transaction.user_id == user_id,
        Transaction.date.startswith(month_str)
    ).order_by(Transaction.date.asc()).all()

    income_total = round(sum(t.amount for t in txs if t.type == "income"), 2)
    expense_total = round(sum(t.amount for t in txs if t.type == "expense"), 2)
    net_savings = round(income_total - expense_total, 2)
    savings_rate = round((net_savings / income_total * 100.0), 1) if income_total > 0 else 0.0

    # Prior month for comparison
    try:
        cur_dt = datetime.strptime(f"{month_str}-01", "%Y-%m-%d")
        prior_dt = (cur_dt - timedelta(days=1)).replace(day=1)
        prior_month_str = prior_dt.strftime("%Y-%m")
        month_name = cur_dt.strftime("%B %Y")
    except Exception:
        prior_month_str = ""
        month_name = month_str

    prior_txs = Transaction.query.filter(
        Transaction.user_id == user_id,
        Transaction.date.startswith(prior_month_str)
    ).all() if prior_month_str else []

    prior_exp = sum(t.amount for t in prior_txs if t.type == "expense")
    prior_inc = sum(t.amount for t in prior_txs if t.type == "income")

    # Categories
    cat_spending = {}
    for t in txs:
        if t.type == "expense":
            c_name = t.category.name if t.category else "Uncategorized"
            cat_spending[c_name] = cat_spending.get(c_name, 0.0) + t.amount

    sorted_cats = sorted(cat_spending.items(), key=lambda x: x[1], reverse=True)
    top_categories = [{"category": k, "amount": round(v, 2), "percent": round(v / expense_total * 100.0, 1) if expense_total > 0 else 0.0} for k, v in sorted_cats[:4]]

    # Major transactions
    expenses_list = [t for t in txs if t.type == "expense"]
    top_transactions = sorted(expenses_list, key=lambda x: x.amount, reverse=True)[:3]

    # Active goals progress
    goals = Goal.query.filter_by(user_id=user_id, status="active").all()
    goals_progress = [g.to_dict() for g in goals[:3]]

    # Recurring payments active
    recurring = RecurringPayment.query.filter_by(user_id=user_id, status="active").all()
    recurring_count = len(recurring)
    recurring_monthly_cost = sum(r.amount * (1 if r.frequency == "monthly" else 4.33 if r.frequency == "weekly" else 1/12) for r in recurring)

    # Grounded Narrative
    if not txs:
        story_headline = f"{month_name}: An Untracked Chapter"
        narrative = f"No transactions were recorded in Ledger for {month_name}. Add records to generate your complete visual story."
    else:
        if net_savings >= 0:
            story_headline = f"{month_name}: Positive Growth & Disciplined Cash Flow"
            narrative = (
                f"During {month_name}, you brought in {currency}{income_total:,.2f} and deployed {currency}{expense_total:,.2f}, "
                f"retaining a net surplus of {currency}{net_savings:,.2f} ({savings_rate}% savings rate). "
                f"Your largest category of expenditure was {top_categories[0]['category']} ({currency}{top_categories[0]['amount']:,.2f}, {top_categories[0]['percent']}% of expenses). "
                f"{'Overall spending tracked favorably compared to the previous month.' if prior_exp > 0 and expense_total <= prior_exp else ''}"
            )
        else:
            story_headline = f"{month_name}: Heavy Expenditure Period"
            narrative = (
                f"In {month_name}, recorded outflows reached {currency}{expense_total:,.2f} against income of {currency}{income_total:,.2f}, "
                f"resulting in a temporary deficit of {currency}{abs(net_savings):,.2f}. "
                f"The primary outflow driver was {top_categories[0]['category']} ({currency}{top_categories[0]['amount']:,.2f})."
            )

    return {
        "month": month_str,
        "month_name": month_name,
        "currency": currency,
        "headline": story_headline,
        "narrative": narrative,
        "has_data": len(txs) > 0,
        "metrics": {
            "income": income_total,
            "expenses": expense_total,
            "net_savings": net_savings,
            "savings_rate": savings_rate,
            "transaction_count": len(txs),
            "recurring_count": recurring_count,
            "recurring_cost": round(recurring_monthly_cost, 2),
        },
        "top_categories": top_categories,
        "top_transactions": [t.to_dict() for t in top_transactions],
        "goals_progress": goals_progress,
    }
