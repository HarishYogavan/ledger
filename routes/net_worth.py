from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from models import db, Asset, Liability, Transaction
from routes import login_required

net_worth_bp = Blueprint("net_worth", __name__, url_prefix="/api/net-worth")

@net_worth_bp.route("", methods=["GET"])
@login_required
def get_net_worth():
    user = request.current_user
    user_id = user.id

    assets = Asset.query.filter_by(user_id=user_id).order_by(Asset.value.desc()).all()
    liabilities = Liability.query.filter_by(user_id=user_id).order_by(Liability.amount.desc()).all()

    # Liquid ledger balance from transactions
    tx_inc = db.session.query(db.func.sum(Transaction.amount)).filter_by(user_id=user_id, type="income").scalar() or 0.0
    tx_exp = db.session.query(db.func.sum(Transaction.amount)).filter_by(user_id=user_id, type="expense").scalar() or 0.0
    ledger_balance = tx_inc - tx_exp

    total_assets = sum(a.value for a in assets) + max(0.0, ledger_balance)
    total_liabilities = sum(l.amount for l in liabilities)
    net_worth = total_assets - total_liabilities

    # Group assets by category
    asset_cats = {}
    for a in assets:
        asset_cats[a.category] = asset_cats.get(a.category, 0.0) + a.value
    if ledger_balance > 0:
        asset_cats["cash"] = asset_cats.get("cash", 0.0) + ledger_balance

    # Group liabilities by category
    liab_cats = {}
    for l in liabilities:
        liab_cats[l.category] = liab_cats.get(l.category, 0.0) + l.amount

    return jsonify({
        "currency": user.currency,
        "net_worth": round(net_worth, 2),
        "total_assets": round(total_assets, 2),
        "total_liabilities": round(total_liabilities, 2),
        "ledger_cash_balance": round(ledger_balance, 2),
        "assets": [a.to_dict() for a in assets],
        "liabilities": [l.to_dict() for l in liabilities],
        "asset_distribution": [{"category": k.title(), "amount": round(v, 2)} for k, v in asset_cats.items()],
        "liability_distribution": [{"category": k.title(), "amount": round(v, 2)} for k, v in liab_cats.items()],
    }), 200

# Asset CRUD
@net_worth_bp.route("/assets", methods=["POST"])
@login_required
def add_asset():
    user = request.current_user
    data = request.get_json() or {}

    name = (data.get("name") or "").strip()
    try:
        value = float(data.get("value", 0))
    except (ValueError, TypeError):
        return jsonify({"error": "Value must be a valid number"}), 400

    if not name or value < 0:
        return jsonify({"error": "Name and non-negative value are required"}), 400

    category = data.get("category", "savings")
    vdate = data.get("valuation_date") or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    notes = data.get("notes", "")

    asset = Asset(
        user_id=user.id,
        name=name,
        category=category,
        value=value,
        valuation_date=vdate,
        notes=notes,
    )
    db.session.add(asset)
    db.session.commit()

    return jsonify({"message": "Asset recorded successfully", "asset": asset.to_dict()}), 201

@net_worth_bp.route("/assets/<int:asset_id>", methods=["DELETE"])
@login_required
def delete_asset(asset_id):
    user = request.current_user
    asset = Asset.query.filter_by(id=asset_id, user_id=user.id).first()
    if not asset:
        return jsonify({"error": "Asset not found"}), 404

    db.session.delete(asset)
    db.session.commit()
    return jsonify({"message": "Asset deleted"}), 200

# Liability CRUD
@net_worth_bp.route("/liabilities", methods=["POST"])
@login_required
def add_liability():
    user = request.current_user
    data = request.get_json() or {}

    name = (data.get("name") or "").strip()
    try:
        amount = float(data.get("amount", 0))
    except (ValueError, TypeError):
        return jsonify({"error": "Amount must be a valid number"}), 400

    if not name or amount <= 0:
        return jsonify({"error": "Name and positive amount are required"}), 400

    category = data.get("category", "loans")
    interest_rate = float(data.get("interest_rate") or 0.0)
    due_date = data.get("due_date")

    liab = Liability(
        user_id=user.id,
        name=name,
        category=category,
        amount=amount,
        interest_rate=interest_rate,
        due_date=due_date,
    )
    db.session.add(liab)
    db.session.commit()

    return jsonify({"message": "Liability recorded successfully", "liability": liab.to_dict()}), 201

@net_worth_bp.route("/liabilities/<int:liab_id>", methods=["DELETE"])
@login_required
def delete_liability(liab_id):
    user = request.current_user
    liab = Liability.query.filter_by(id=liab_id, user_id=user.id).first()
    if not liab:
        return jsonify({"error": "Liability not found"}), 404

    db.session.delete(liab)
    db.session.commit()
    return jsonify({"message": "Liability removed"}), 200
