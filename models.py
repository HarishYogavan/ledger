import json
from datetime import datetime, timezone
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import event, Index
from sqlalchemy.engine import Engine

db = SQLAlchemy()

# Enforce foreign key constraints in SQLite
@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    try:
        cursor.execute("PRAGMA foreign_keys=ON")
    except Exception:
        pass
    finally:
        cursor.close()

def now_utc():
    return datetime.now(timezone.utc)

class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(120), nullable=False)
    currency = db.Column(db.String(10), default="₹")
    theme = db.Column(db.String(20), default="dark")  # 'dark' | 'light' | 'system'
    privacy_mode = db.Column(db.Boolean, default=False)
    onboarding_completed = db.Column(db.Boolean, default=False)
    monthly_income = db.Column(db.Float, default=0.0)
    savings_target = db.Column(db.Float, default=0.0)
    created_at = db.Column(db.DateTime, default=now_utc)
    updated_at = db.Column(db.DateTime, default=now_utc, onupdate=now_utc)

    # Relationships
    transactions = db.relationship("Transaction", backref="user", cascade="all, delete-orphan", lazy="dynamic")
    categories = db.relationship("Category", backref="user", cascade="all, delete-orphan", lazy="dynamic")
    budgets = db.relationship("Budget", backref="user", cascade="all, delete-orphan", lazy="dynamic")
    goals = db.relationship("Goal", backref="user", cascade="all, delete-orphan", lazy="dynamic")
    recurring_payments = db.relationship("RecurringPayment", backref="user", cascade="all, delete-orphan", lazy="dynamic")
    bills = db.relationship("Bill", backref="user", cascade="all, delete-orphan", lazy="dynamic")
    assets = db.relationship("Asset", backref="user", cascade="all, delete-orphan", lazy="dynamic")
    liabilities = db.relationship("Liability", backref="user", cascade="all, delete-orphan", lazy="dynamic")
    scenarios = db.relationship("Scenario", backref="user", cascade="all, delete-orphan", lazy="dynamic")
    notifications = db.relationship("Notification", backref="user", cascade="all, delete-orphan", lazy="dynamic")
    ai_chats = db.relationship("AIConversation", backref="user", cascade="all, delete-orphan", lazy="dynamic")
    receipts = db.relationship("Receipt", backref="user", cascade="all, delete-orphan", lazy="dynamic")
    settings = db.relationship("UserSettings", backref="user", uselist=False, cascade="all, delete-orphan")
    purchases = db.relationship("Purchase", backref="user", cascade="all, delete-orphan", lazy="dynamic")
    documents = db.relationship("Document", backref="user", cascade="all, delete-orphan", lazy="dynamic")
    memories = db.relationship("FinancialMemory", backref="user", cascade="all, delete-orphan", lazy="dynamic")
    life_events = db.relationship("LifeEvent", backref="user", cascade="all, delete-orphan", lazy="dynamic")
    workspaces = db.relationship("SharedWorkspace", backref="owner", cascade="all, delete-orphan", lazy="dynamic")
    sessions = db.relationship("UserSession", backref="user", cascade="all, delete-orphan", lazy="dynamic")

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "full_name": self.full_name,
            "currency": self.currency,
            "theme": self.theme,
            "privacy_mode": self.privacy_mode,
            "onboarding_completed": self.onboarding_completed,
            "monthly_income": self.monthly_income,
            "savings_target": self.savings_target,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

class Category(db.Model):
    __tablename__ = "categories"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    name = db.Column(db.String(80), nullable=False)
    type = db.Column(db.String(20), nullable=False, default="expense")  # 'expense' | 'income'
    icon = db.Column(db.String(50), default="tag")
    color = db.Column(db.String(30), default="#06D6A0")
    budget_limit = db.Column(db.Float, default=0.0)
    is_default = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=now_utc)

    transactions = db.relationship("Transaction", backref="category", lazy="dynamic")
    budgets = db.relationship("Budget", backref="category", lazy="dynamic")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "type": self.type,
            "icon": self.icon,
            "color": self.color,
            "budget_limit": self.budget_limit,
            "is_default": self.is_default,
        }

class Transaction(db.Model):
    __tablename__ = "transactions"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True)
    receipt_id = db.Column(db.Integer, db.ForeignKey("receipts.id", ondelete="SET NULL"), nullable=True)
    type = db.Column(db.String(20), nullable=False)  # 'income' | 'expense'
    amount = db.Column(db.Float, nullable=False)
    currency = db.Column(db.String(10), default="₹")
    date = db.Column(db.String(10), nullable=False)  # YYYY-MM-DD
    merchant = db.Column(db.String(120), default="")
    payment_method = db.Column(db.String(50), default="Card")  # 'Card', 'UPI', 'Cash', 'Bank Transfer', etc.
    notes = db.Column(db.Text, default="")
    tags = db.Column(db.Text, default="[]")  # JSON string of tag list
    is_recurring = db.Column(db.Boolean, default=False)
    location_name = db.Column(db.String(255), default="")
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    created_at = db.Column(db.DateTime, default=now_utc)
    updated_at = db.Column(db.DateTime, default=now_utc, onupdate=now_utc)

    __table_args__ = (
        Index("idx_tx_user_date", "user_id", "date"),
    )

    def to_dict(self):
        tags_list = []
        try:
            tags_list = json.loads(self.tags) if self.tags else []
        except Exception:
            tags_list = []

        return {
            "id": self.id,
            "user_id": self.user_id,
            "category_id": self.category_id,
            "category_name": self.category.name if self.category else "Uncategorized",
            "category_icon": self.category.icon if self.category else "tag",
            "category_color": self.category.color if self.category else "#64748B",
            "type": self.type,
            "amount": self.amount,
            "currency": self.currency,
            "date": self.date,
            "merchant": self.merchant,
            "payment_method": self.payment_method,
            "notes": self.notes,
            "tags": tags_list,
            "is_recurring": self.is_recurring,
            "receipt_id": self.receipt_id,
            "location_name": self.location_name or "",
            "latitude": self.latitude,
            "longitude": self.longitude,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

class Budget(db.Model):
    __tablename__ = "budgets"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id", ondelete="CASCADE"), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    period = db.Column(db.String(20), default="monthly")  # 'monthly' | 'weekly' | 'custom'
    start_date = db.Column(db.String(10), nullable=True)
    end_date = db.Column(db.String(10), nullable=True)
    created_at = db.Column(db.DateTime, default=now_utc)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "category_id": self.category_id,
            "category_name": self.category.name if self.category else "Unknown",
            "category_color": self.category.color if self.category else "#06D6A0",
            "amount": self.amount,
            "period": self.period,
            "start_date": self.start_date,
            "end_date": self.end_date,
        }

class Goal(db.Model):
    __tablename__ = "goals"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    target_amount = db.Column(db.Float, nullable=False)
    current_amount = db.Column(db.Float, default=0.0)
    target_date = db.Column(db.String(10), nullable=False)  # YYYY-MM-DD
    monthly_contribution = db.Column(db.Float, default=0.0)
    status = db.Column(db.String(20), default="active")  # 'active' | 'paused' | 'completed'
    category_tag = db.Column(db.String(50), default="General")
    created_at = db.Column(db.DateTime, default=now_utc)
    updated_at = db.Column(db.DateTime, default=now_utc, onupdate=now_utc)

    def to_dict(self):
        progress_pct = round((self.current_amount / self.target_amount * 100), 1) if self.target_amount > 0 else 0
        remaining = max(0.0, self.target_amount - self.current_amount)
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "target_amount": self.target_amount,
            "current_amount": self.current_amount,
            "target_date": self.target_date,
            "monthly_contribution": self.monthly_contribution,
            "status": self.status,
            "category_tag": self.category_tag,
            "progress_percent": min(100.0, progress_pct),
            "remaining_amount": remaining,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

class RecurringPayment(db.Model):
    __tablename__ = "recurring_payments"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    name = db.Column(db.String(120), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    frequency = db.Column(db.String(20), default="monthly")  # 'daily' | 'weekly' | 'monthly' | 'yearly'
    last_payment_date = db.Column(db.String(10), nullable=True)
    next_due_date = db.Column(db.String(10), nullable=True)
    is_auto_detected = db.Column(db.Boolean, default=False)
    status = db.Column(db.String(20), default="active")  # 'active' | 'paused' | 'cancelled'
    created_at = db.Column(db.DateTime, default=now_utc)

    category = db.relationship("Category")
    bills = db.relationship("Bill", backref="recurring_ref", lazy="dynamic")

    def to_dict(self):
        # Annualized estimate
        mult = 12 if self.frequency == "monthly" else 52 if self.frequency == "weekly" else 365 if self.frequency == "daily" else 1
        annual_cost = self.amount * mult
        return {
            "id": self.id,
            "user_id": self.user_id,
            "category_id": self.category_id,
            "category_name": self.category.name if self.category else "General",
            "name": self.name,
            "amount": self.amount,
            "frequency": self.frequency,
            "last_payment_date": self.last_payment_date,
            "next_due_date": self.next_due_date,
            "is_auto_detected": self.is_auto_detected,
            "status": self.status,
            "estimated_annual_cost": annual_cost,
        }

class Bill(db.Model):
    __tablename__ = "bills"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    recurring_id = db.Column(db.Integer, db.ForeignKey("recurring_payments.id", ondelete="SET NULL"), nullable=True)
    title = db.Column(db.String(120), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    due_date = db.Column(db.String(10), nullable=False)  # YYYY-MM-DD
    is_paid = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=now_utc)

    category = db.relationship("Category")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "title": self.title,
            "amount": self.amount,
            "due_date": self.due_date,
            "is_paid": self.is_paid,
            "category_name": self.category.name if self.category else "Bills",
            "category_color": self.category.color if self.category else "#EF476F",
            "recurring_id": self.recurring_id,
        }

class Asset(db.Model):
    __tablename__ = "assets"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    category = db.Column(db.String(50), default="savings")  # 'cash', 'savings', 'investments', 'property', 'vehicles', 'other'
    value = db.Column(db.Float, nullable=False)
    valuation_date = db.Column(db.String(10), nullable=False)
    notes = db.Column(db.Text, default="")
    created_at = db.Column(db.DateTime, default=now_utc)
    updated_at = db.Column(db.DateTime, default=now_utc, onupdate=now_utc)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "category": self.category,
            "value": self.value,
            "valuation_date": self.valuation_date,
            "notes": self.notes,
        }

class Liability(db.Model):
    __tablename__ = "liabilities"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    category = db.Column(db.String(50), default="loans")  # 'loans', 'credit_cards', 'mortgage', 'other'
    amount = db.Column(db.Float, nullable=False)
    interest_rate = db.Column(db.Float, default=0.0)
    due_date = db.Column(db.String(10), nullable=True)
    created_at = db.Column(db.DateTime, default=now_utc)
    updated_at = db.Column(db.DateTime, default=now_utc, onupdate=now_utc)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "category": self.category,
            "amount": self.amount,
            "interest_rate": self.interest_rate,
            "due_date": self.due_date,
        }

class Scenario(db.Model):
    """Financial Twin Scenario - Never modifies real records"""
    __tablename__ = "scenarios"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text, default="")
    created_at = db.Column(db.DateTime, default=now_utc)
    updated_at = db.Column(db.DateTime, default=now_utc, onupdate=now_utc)

    changes = db.relationship("ScenarioChange", backref="scenario", cascade="all, delete-orphan", lazy="joined")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "description": self.description,
            "changes": [c.to_dict() for c in self.changes],
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

class ScenarioChange(db.Model):
    __tablename__ = "scenario_changes"

    id = db.Column(db.Integer, primary_key=True)
    scenario_id = db.Column(db.Integer, db.ForeignKey("scenarios.id", ondelete="CASCADE"), nullable=False, index=True)
    change_type = db.Column(db.String(50), nullable=False)  # 'one_off_expense', 'income_change', 'recurring_expense', 'savings_boost'
    title = db.Column(db.String(120), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    frequency = db.Column(db.String(20), default="once")  # 'once' | 'monthly' | 'yearly'
    start_month_offset = db.Column(db.Integer, default=0)  # month index 0..11

    def to_dict(self):
        return {
            "id": self.id,
            "scenario_id": self.scenario_id,
            "change_type": self.change_type,
            "title": self.title,
            "amount": self.amount,
            "frequency": self.frequency,
            "start_month_offset": self.start_month_offset,
        }

class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = db.Column(db.String(50), nullable=False)  # 'unusual_spending', 'large_transaction', 'recurring_increase', etc.
    title = db.Column(db.String(120), nullable=False)
    message = db.Column(db.Text, nullable=False)
    severity = db.Column(db.String(20), default="info")  # 'info' | 'warning' | 'critical'
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=now_utc)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "type": self.type,
            "title": self.title,
            "message": self.message,
            "severity": self.severity,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

class AIConversation(db.Model):
    __tablename__ = "ai_conversations"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = db.Column(db.String(20), nullable=False)  # 'user' | 'assistant'
    message = db.Column(db.Text, nullable=False)
    context_summary = db.Column(db.Text, default="")
    created_at = db.Column(db.DateTime, default=now_utc)

    def to_dict(self):
        return {
            "id": self.id,
            "role": self.role,
            "message": self.message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

class Receipt(db.Model):
    __tablename__ = "receipts"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(500), nullable=False)
    ocr_raw_text = db.Column(db.Text, default="")
    parsed_data = db.Column(db.Text, default="{}")  # JSON string
    status = db.Column(db.String(20), default="pending")  # 'pending', 'confirmed', 'rejected'
    created_at = db.Column(db.DateTime, default=now_utc)

    def to_dict(self):
        parsed = {}
        try:
            parsed = json.loads(self.parsed_data) if self.parsed_data else {}
        except Exception:
            parsed = {}
        return {
            "id": self.id,
            "user_id": self.user_id,
            "filename": self.filename,
            "ocr_raw_text": self.ocr_raw_text,
            "parsed_data": parsed,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

class UserSettings(db.Model):
    __tablename__ = "user_settings"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    notification_prefs = db.Column(db.Text, default='{"email":false,"bills":true,"spending_spikes":true,"large_transactions":true,"warranty":true}')
    ai_prefs = db.Column(db.Text, default='{"enable_insights":true,"conservative_estimates":true}')
    dashboard_layout = db.Column(db.Text, default='{"cards":["overview","cashflow","spending","goals","upcoming","ai_summary"]}')
    location_tracking_enabled = db.Column(db.Boolean, default=False)
    ai_memory_enabled = db.Column(db.Boolean, default=True)
    updated_at = db.Column(db.DateTime, default=now_utc, onupdate=now_utc)

    def to_dict(self):
        return {
            "user_id": self.user_id,
            "notification_prefs": json.loads(self.notification_prefs or "{}"),
            "ai_prefs": json.loads(self.ai_prefs or "{}"),
            "dashboard_layout": json.loads(self.dashboard_layout or "{}"),
            "location_tracking_enabled": bool(self.location_tracking_enabled),
            "ai_memory_enabled": bool(self.ai_memory_enabled),
        }

class Purchase(db.Model):
    """Purchase & Warranty Vault"""
    __tablename__ = "purchases"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    product_name = db.Column(db.String(150), nullable=False)
    merchant = db.Column(db.String(120), default="")
    purchase_date = db.Column(db.String(10), nullable=False)  # YYYY-MM-DD
    price = db.Column(db.Float, nullable=False)
    currency = db.Column(db.String(10), default="₹")
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    warranty_months = db.Column(db.Integer, default=0)
    warranty_expiry = db.Column(db.String(10), nullable=True)  # YYYY-MM-DD
    receipt_id = db.Column(db.Integer, db.ForeignKey("receipts.id", ondelete="SET NULL"), nullable=True)
    document_id = db.Column(db.Integer, nullable=True)
    notes = db.Column(db.Text, default="")
    status = db.Column(db.String(20), default="active")  # 'active', 'archived'
    created_at = db.Column(db.DateTime, default=now_utc)

    category = db.relationship("Category")
    events = db.relationship("PurchaseEvent", backref="purchase", cascade="all, delete-orphan", lazy="dynamic")

    def to_dict(self):
        now_date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        is_warranty_active = False
        days_left = None
        if self.warranty_expiry:
            try:
                exp_dt = datetime.strptime(self.warranty_expiry, "%Y-%m-%d")
                now_dt = datetime.strptime(now_date_str, "%Y-%m-%d")
                delta_days = (exp_dt - now_dt).days
                days_left = delta_days
                is_warranty_active = delta_days >= 0
            except Exception:
                pass

        return {
            "id": self.id,
            "user_id": self.user_id,
            "product_name": self.product_name,
            "merchant": self.merchant,
            "purchase_date": self.purchase_date,
            "price": self.price,
            "currency": self.currency,
            "category_id": self.category_id,
            "category_name": self.category.name if self.category else "Electronics/Appliances",
            "category_color": self.category.color if self.category else "#3A86FF",
            "warranty_months": self.warranty_months,
            "warranty_expiry": self.warranty_expiry,
            "is_warranty_active": is_warranty_active,
            "days_until_warranty_expiry": days_left,
            "receipt_id": self.receipt_id,
            "document_id": self.document_id,
            "notes": self.notes,
            "status": self.status,
            "events_count": self.events.count(),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

class PurchaseEvent(db.Model):
    """Purchase Lifecycle Event: Purchased -> Warranty -> Maintenance -> Repair -> Replacement"""
    __tablename__ = "purchase_events"

    id = db.Column(db.Integer, primary_key=True)
    purchase_id = db.Column(db.Integer, db.ForeignKey("purchases.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = db.Column(db.String(30), nullable=False)  # 'purchase', 'warranty_claim', 'maintenance', 'repair', 'replacement'
    event_date = db.Column(db.String(10), nullable=False)
    cost = db.Column(db.Float, default=0.0)
    description = db.Column(db.String(255), default="")
    service_provider = db.Column(db.String(120), default="")
    created_at = db.Column(db.DateTime, default=now_utc)

    def to_dict(self):
        return {
            "id": self.id,
            "purchase_id": self.purchase_id,
            "event_type": self.event_type,
            "event_date": self.event_date,
            "cost": self.cost,
            "description": self.description,
            "service_provider": self.service_provider,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

class Document(db.Model):
    """Financial Document Vault"""
    __tablename__ = "documents"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = db.Column(db.String(255), nullable=False)
    original_name = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(500), nullable=False)
    file_size = db.Column(db.Integer, default=0)
    mime_type = db.Column(db.String(100), default="application/octet-stream")
    category = db.Column(db.String(50), default="other")  # 'receipt', 'bill', 'statement', 'warranty', 'report', 'other'
    notes = db.Column(db.Text, default="")
    transaction_id = db.Column(db.Integer, db.ForeignKey("transactions.id", ondelete="SET NULL"), nullable=True)
    purchase_id = db.Column(db.Integer, db.ForeignKey("purchases.id", ondelete="SET NULL"), nullable=True)
    created_at = db.Column(db.DateTime, default=now_utc)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "filename": self.filename,
            "original_name": self.original_name,
            "file_size": self.file_size,
            "mime_type": self.mime_type,
            "category": self.category,
            "notes": self.notes,
            "transaction_id": self.transaction_id,
            "purchase_id": self.purchase_id,
            "download_url": f"/api/documents/{self.id}/download",
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

class SharedWorkspace(db.Model):
    """Shared Expenses Workspace (family, roommates, trips, groups)"""
    __tablename__ = "shared_workspaces"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text, default="")
    currency = db.Column(db.String(10), default="₹")
    created_by_user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    invite_code = db.Column(db.String(20), unique=True, index=True, nullable=False)
    created_at = db.Column(db.DateTime, default=now_utc)

    members = db.relationship("WorkspaceMember", backref="workspace", cascade="all, delete-orphan", lazy="joined")
    expenses = db.relationship("SharedExpense", backref="workspace", cascade="all, delete-orphan", lazy="dynamic")
    settlements = db.relationship("Settlement", backref="workspace", cascade="all, delete-orphan", lazy="dynamic")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "currency": self.currency,
            "created_by_user_id": self.created_by_user_id,
            "invite_code": self.invite_code,
            "members": [m.to_dict() for m in self.members],
            "total_expenses_count": self.expenses.count(),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

class WorkspaceMember(db.Model):
    __tablename__ = "workspace_members"

    id = db.Column(db.Integer, primary_key=True)
    workspace_id = db.Column(db.Integer, db.ForeignKey("shared_workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    email = db.Column(db.String(255), nullable=False)
    display_name = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(20), default="member")  # 'owner', 'member'
    joined_at = db.Column(db.DateTime, default=now_utc)

    def to_dict(self):
        return {
            "id": self.id,
            "workspace_id": self.workspace_id,
            "user_id": self.user_id,
            "email": self.email,
            "display_name": self.display_name,
            "role": self.role,
            "joined_at": self.joined_at.isoformat() if self.joined_at else None,
        }

class SharedExpense(db.Model):
    __tablename__ = "shared_expenses"

    id = db.Column(db.Integer, primary_key=True)
    workspace_id = db.Column(db.Integer, db.ForeignKey("shared_workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    paid_by_member_id = db.Column(db.Integer, db.ForeignKey("workspace_members.id", ondelete="CASCADE"), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    description = db.Column(db.String(255), nullable=False)
    date = db.Column(db.String(10), nullable=False)
    category = db.Column(db.String(50), default="General")
    split_method = db.Column(db.String(20), default="equal")  # 'equal', 'exact', 'percentage'
    receipt_path = db.Column(db.String(500), default="")
    created_at = db.Column(db.DateTime, default=now_utc)

    paid_by_member = db.relationship("WorkspaceMember", foreign_keys=[paid_by_member_id])
    splits = db.relationship("SharedExpenseSplit", backref="shared_expense", cascade="all, delete-orphan", lazy="joined")

    def to_dict(self):
        return {
            "id": self.id,
            "workspace_id": self.workspace_id,
            "paid_by_member_id": self.paid_by_member_id,
            "paid_by_name": self.paid_by_member.display_name if self.paid_by_member else "Unknown",
            "amount": self.amount,
            "description": self.description,
            "date": self.date,
            "category": self.category,
            "split_method": self.split_method,
            "splits": [s.to_dict() for s in self.splits],
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

class SharedExpenseSplit(db.Model):
    __tablename__ = "shared_expense_splits"

    id = db.Column(db.Integer, primary_key=True)
    shared_expense_id = db.Column(db.Integer, db.ForeignKey("shared_expenses.id", ondelete="CASCADE"), nullable=False, index=True)
    member_id = db.Column(db.Integer, db.ForeignKey("workspace_members.id", ondelete="CASCADE"), nullable=False)
    split_amount = db.Column(db.Float, nullable=False)
    is_settled = db.Column(db.Boolean, default=False)
    settled_at = db.Column(db.DateTime, nullable=True)

    member = db.relationship("WorkspaceMember", foreign_keys=[member_id])

    def to_dict(self):
        return {
            "id": self.id,
            "shared_expense_id": self.shared_expense_id,
            "member_id": self.member_id,
            "member_name": self.member.display_name if self.member else "Unknown",
            "split_amount": self.split_amount,
            "is_settled": self.is_settled,
        }

class Settlement(db.Model):
    __tablename__ = "settlements"

    id = db.Column(db.Integer, primary_key=True)
    workspace_id = db.Column(db.Integer, db.ForeignKey("shared_workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    from_member_id = db.Column(db.Integer, db.ForeignKey("workspace_members.id", ondelete="CASCADE"), nullable=False)
    to_member_id = db.Column(db.Integer, db.ForeignKey("workspace_members.id", ondelete="CASCADE"), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    date = db.Column(db.String(10), nullable=False)
    notes = db.Column(db.Text, default="")
    status = db.Column(db.String(20), default="completed")  # 'pending', 'completed'
    created_at = db.Column(db.DateTime, default=now_utc)

    from_member = db.relationship("WorkspaceMember", foreign_keys=[from_member_id])
    to_member = db.relationship("WorkspaceMember", foreign_keys=[to_member_id])

    def to_dict(self):
        return {
            "id": self.id,
            "workspace_id": self.workspace_id,
            "from_member_id": self.from_member_id,
            "from_member_name": self.from_member.display_name if self.from_member else "Unknown",
            "to_member_id": self.to_member_id,
            "to_member_name": self.to_member.display_name if self.to_member else "Unknown",
            "amount": self.amount,
            "date": self.date,
            "notes": self.notes,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

class FinancialMemory(db.Model):
    """User-created AI Financial Memory notes"""
    __tablename__ = "financial_memories"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = db.Column(db.String(150), nullable=False)
    content = db.Column(db.Text, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=now_utc)
    updated_at = db.Column(db.DateTime, default=now_utc, onupdate=now_utc)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "title": self.title,
            "content": self.content,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

class LifeEvent(db.Model):
    """Life Event Simulator scenarios"""
    __tablename__ = "life_events"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    event_type = db.Column(db.String(50), default="custom")  # 'college', 'education', 'travel', 'moving', 'vehicle', 'relocation', 'new_job', 'large_purchase', 'custom'
    cost = db.Column(db.Float, default=0.0)
    target_date = db.Column(db.String(10), nullable=False)  # YYYY-MM-DD
    recurring_cost_delta = db.Column(db.Float, default=0.0)  # e.g., rent increase or monthly maintenance
    income_delta = db.Column(db.Float, default=0.0)  # e.g., salary bump or internship stipend
    notes = db.Column(db.Text, default="")
    created_at = db.Column(db.DateTime, default=now_utc)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "event_type": self.event_type,
            "cost": self.cost,
            "target_date": self.target_date,
            "recurring_cost_delta": self.recurring_cost_delta,
            "income_delta": self.income_delta,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

class UserSession(db.Model):
    """Secure multi-device persistent session records"""
    __tablename__ = "user_sessions"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    session_token = db.Column(db.String(255), unique=True, nullable=False, index=True)
    device_name = db.Column(db.String(100), default="Unknown Device")
    browser_name = db.Column(db.String(100), default="Unknown Browser")
    ip_address = db.Column(db.String(64), nullable=True)
    created_at = db.Column(db.DateTime, default=now_utc)
    last_active = db.Column(db.DateTime, default=now_utc)
    expires_at = db.Column(db.DateTime, nullable=False)
    is_active = db.Column(db.Boolean, default=True)

    def to_dict(self, is_current=False):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "device_name": self.device_name,
            "browser_name": self.browser_name,
            "ip_address": self.ip_address,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_active": self.last_active.isoformat() if self.last_active else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "is_active": self.is_active,
            "is_current": is_current,
        }
