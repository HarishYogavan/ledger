import io
import csv
import json
import zipfile
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from config import Config
from models import db, User, Category, Transaction, Budget, Goal, RecurringPayment, Bill, Asset, Liability, Scenario, Notification, AIConversation, Receipt, UserSettings

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def generate_jwt(user_id: int) -> str:
    payload = {
        "sub": user_id,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
    }
    return jwt.encode(payload, Config.SECRET_KEY, algorithm="HS256")

def verify_jwt(token: str) -> int | None:
    try:
        payload = jwt.decode(token, Config.SECRET_KEY, algorithms=["HS256"])
        return payload.get("sub")
    except Exception:
        return None

def seed_default_categories(user_id: int):
    """Seed initial standard financial categories for a newly created user."""
    default_cats = [
        # Expense categories
        ("Food & Dining", "expense", "utensils", "#FF70A6"),
        ("Groceries", "expense", "shopping-bag", "#06D6A0"),
        ("Housing & Rent", "expense", "home", "#118AB2"),
        ("Utilities & Bills", "expense", "zap", "#FFD166"),
        ("Transportation", "expense", "car", "#073B4C"),
        ("Entertainment", "expense", "film", "#8338EC"),
        ("Healthcare", "expense", "heart-pulse", "#EF476F"),
        ("Shopping", "expense", "shopping-cart", "#3A86FF"),
        ("Education", "expense", "book-open", "#48CAE4"),
        ("Travel", "expense", "plane", "#FB5607"),
        ("Personal Care", "expense", "sparkles", "#70E000"),
        ("Other Expenses", "expense", "more-horizontal", "#64748B"),
        # Income categories
        ("Salary", "income", "briefcase", "#06D6A0"),
        ("Freelance & Side Hustle", "income", "laptop", "#00F5D4"),
        ("Investments & Dividends", "income", "trending-up", "#00BBF9"),
        ("Gifts & Grants", "income", "gift", "#F15BB5"),
        ("Other Income", "income", "plus-circle", "#9B5DE5"),
    ]

    for name, ctype, icon, color in default_cats:
        cat = Category(
            user_id=user_id,
            name=name,
            type=ctype,
            icon=icon,
            color=color,
            is_default=True,
        )
        db.session.add(cat)
    db.session.commit()

def export_all_user_data_zip(user_id: int) -> io.BytesIO:
    """Creates a downloadable ZIP buffer containing full JSON export + CSV sheets for transactions, goals, assets."""
    user = db.session.get(User, user_id)
    if not user:
        raise ValueError("User not found")

    # Fetch data
    txs = Transaction.query.filter_by(user_id=user_id).order_by(Transaction.date.desc()).all()
    cats = Category.query.filter_by(user_id=user_id).all()
    budgets = Budget.query.filter_by(user_id=user_id).all()
    goals = Goal.query.filter_by(user_id=user_id).all()
    recurrings = RecurringPayment.query.filter_by(user_id=user_id).all()
    bills = Bill.query.filter_by(user_id=user_id).all()
    assets = Asset.query.filter_by(user_id=user_id).all()
    liabilities = Liability.query.filter_by(user_id=user_id).all()
    scenarios = Scenario.query.filter_by(user_id=user_id).all()

    export_json = {
        "user": user.to_dict(),
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "categories": [c.to_dict() for c in cats],
        "transactions": [t.to_dict() for t in txs],
        "budgets": [b.to_dict() for b in budgets],
        "goals": [g.to_dict() for g in goals],
        "recurring_payments": [r.to_dict() for r in recurrings],
        "bills": [b.to_dict() for b in bills],
        "assets": [a.to_dict() for a in assets],
        "liabilities": [l.to_dict() for l in liabilities],
        "scenarios": [s.to_dict() for s in scenarios],
    }

    # Transactions CSV
    tx_csv_buf = io.StringIO()
    tx_writer = csv.writer(tx_csv_buf)
    tx_writer.writerow(["ID", "Date", "Type", "Amount", "Currency", "Merchant", "Category", "Payment Method", "Notes", "Tags", "Recurring"])
    for t in txs:
        tx_writer.writerow([
            t.id, t.date, t.type, t.amount, t.currency, t.merchant,
            t.category.name if t.category else "Uncategorized",
            t.payment_method, t.notes, t.tags, t.is_recurring
        ])

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        zip_file.writestr("ledger_export.json", json.dumps(export_json, indent=2))
        zip_file.writestr("transactions.csv", tx_csv_buf.getvalue())

    zip_buffer.seek(0)
    return zip_buffer
