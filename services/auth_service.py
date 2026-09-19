import io
import csv
import json
import zipfile
import secrets
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from config import Config
from models import (
    db, User, UserSession, Category, Transaction, Budget, Goal,
    RecurringPayment, Bill, Asset, Liability, Scenario, Notification,
    AIConversation, Receipt, UserSettings, now_utc
)

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def parse_client_device(user_agent_str: str) -> tuple[str, str]:
    """Extract human-readable device and browser names from User-Agent string."""
    if not user_agent_str:
        return ("Desktop Device", "Web Browser")

    ua = user_agent_str.lower()
    
    # Device / OS
    if "iphone" in ua:
        device = "iPhone"
    elif "ipad" in ua:
        device = "iPad"
    elif "android" in ua:
        device = "Android Device"
    elif "windows" in ua:
        device = "Windows PC"
    elif "macintosh" in ua or "mac os" in ua:
        device = "Mac"
    elif "linux" in ua:
        device = "Linux Machine"
    else:
        device = "Desktop Device"

    # Browser
    if "edg" in ua:
        browser = "Microsoft Edge"
    elif "chrome" in ua and "safari" in ua:
        browser = "Google Chrome"
    elif "safari" in ua and "chrome" not in ua:
        browser = "Apple Safari"
    elif "firefox" in ua:
        browser = "Mozilla Firefox"
    elif "opera" in ua or "opr" in ua:
        browser = "Opera"
    else:
        browser = "Web Browser"

    return (device, browser)

def is_session_expired(expires_at: datetime) -> bool:
    if not expires_at:
        return False
    now = datetime.now(timezone.utc)
    exp = expires_at if expires_at.tzinfo else expires_at.replace(tzinfo=timezone.utc)
    return exp < now

def create_user_session(user_id: int, user_agent_str: str = "", ip_address: str = "") -> tuple[str, UserSession]:
    """Creates a persistent 30-day database session record and corresponding JWT token."""
    device_name, browser_name = parse_client_device(user_agent_str)
    session_token = secrets.token_urlsafe(36)
    expires_at = datetime.now(timezone.utc) + timedelta(days=30)

    session_record = UserSession(
        user_id=user_id,
        session_token=session_token,
        device_name=device_name,
        browser_name=browser_name,
        ip_address=ip_address or "127.0.0.1",
        created_at=datetime.now(timezone.utc),
        last_active=datetime.now(timezone.utc),
        expires_at=expires_at,
        is_active=True,
    )
    db.session.add(session_record)
    db.session.commit()

    jwt_token = generate_jwt(user_id, session_record.id)
    return (jwt_token, session_record)

def generate_jwt(user_id: int, session_id: int | None = None) -> str:
    """Generates a secure 30-day JWT token with user_id and session_id claims."""
    payload = {
        "sub": str(user_id),
        "sid": session_id,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
    }
    return jwt.encode(payload, Config.SECRET_KEY, algorithm="HS256")

def extract_token_from_request(req) -> str | None:
    """Extract auth token from Authorization (Bearer), WSGI environ, X-Auth-Token, or X-Session-Token."""
    auth_header = (
        req.headers.get("Authorization")
        or req.environ.get("HTTP_AUTHORIZATION")
        or req.headers.get("X-Authorization")
        or req.headers.get("X-Auth-Token")
        or req.headers.get("X-Session-Token")
    )
    if not auth_header:
        return None
    auth_str = str(auth_header).strip()
    if auth_str.lower().startswith("bearer "):
        return auth_str[7:].strip()
    return auth_str

def verify_jwt(token: str) -> tuple[int, int | None] | None:
    """Verifies JWT signature and returns (user_id, session_id)."""
    try:
        payload = jwt.decode(token, Config.SECRET_KEY, algorithms=["HS256"])
        sub = payload.get("sub")
        session_id = payload.get("sid")
        if not sub:
            return None
        return (int(sub), session_id)
    except Exception:
        return None

def validate_user_session(user_id: int, session_id: int | None = None) -> UserSession | None:
    """Validates session record in database, ensuring it is active and not expired."""
    now = datetime.now(timezone.utc)
    if session_id:
        sess = UserSession.query.filter_by(id=session_id, user_id=user_id, is_active=True).first()
        if sess:
            if is_session_expired(sess.expires_at):
                sess.is_active = False
                db.session.commit()
                return None
            sess.last_active = now
            db.session.commit()
            return sess
        return None
    
    # If token has no sid (legacy or session cookie), check/create session
    latest = UserSession.query.filter_by(user_id=user_id, is_active=True).order_by(UserSession.last_active.desc()).first()
    if latest and not is_session_expired(latest.expires_at):
        latest.last_active = now
        db.session.commit()
        return latest
    return None

def get_active_sessions(user_id: int, current_session_id: int | None = None) -> list[dict]:
    """Returns list of active sessions for user, indicating which is current."""
    sessions = UserSession.query.filter_by(user_id=user_id, is_active=True).order_by(UserSession.last_active.desc()).all()
    result = []
    for s in sessions:
        if is_session_expired(s.expires_at):
            s.is_active = False
            continue
        is_curr = (current_session_id is not None and s.id == current_session_id)
        result.append(s.to_dict(is_current=is_curr))
    db.session.commit()
    return result

def invalidate_session(session_id: int, user_id: int) -> bool:
    """Deactivates a specific device session."""
    sess = UserSession.query.filter_by(id=session_id, user_id=user_id).first()
    if sess:
        sess.is_active = False
        db.session.commit()
        return True
    return False

def invalidate_all_other_sessions(user_id: int, current_session_id: int | None = None) -> int:
    """Deactivates all active sessions except the specified current one."""
    query = UserSession.query.filter_by(user_id=user_id, is_active=True)
    if current_session_id:
        query = query.filter(UserSession.id != current_session_id)
    revoked = query.all()
    count = len(revoked)
    for s in revoked:
        s.is_active = False
    db.session.commit()
    return count

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
