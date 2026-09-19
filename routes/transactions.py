import json
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from models import db, Transaction, Category, Receipt
from services.ai_service import parse_natural_language_transaction
from routes import login_required

transactions_bp = Blueprint("transactions", __name__, url_prefix="/api/transactions")

@transactions_bp.route("", methods=["GET"])
@login_required
def get_transactions():
    user = request.current_user
    user_id = user.id

    query = Transaction.query.filter_by(user_id=user_id)

    # Search
    search = request.args.get("search", "").strip()
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (Transaction.merchant.ilike(search_pattern)) |
            (Transaction.notes.ilike(search_pattern)) |
            (Transaction.payment_method.ilike(search_pattern)) |
            (Transaction.tags.ilike(search_pattern))
        )

    # Filter by type (income / expense)
    tx_type = request.args.get("type")
    if tx_type in ["income", "expense"]:
        query = query.filter(Transaction.type == tx_type)

    # Filter by category
    cat_id = request.args.get("category_id")
    if cat_id:
        try:
            query = query.filter(Transaction.category_id == int(cat_id))
        except Exception:
            pass

    # Filter by payment method
    pm = request.args.get("payment_method")
    if pm:
        query = query.filter(Transaction.payment_method == pm)

    # Date range
    start_date = request.args.get("start_date")
    if start_date:
        query = query.filter(Transaction.date >= start_date)

    end_date = request.args.get("end_date")
    if end_date:
        query = query.filter(Transaction.date <= end_date)

    # Sort
    sort_by = request.args.get("sort_by", "date")
    sort_dir = request.args.get("sort_dir", "desc")

    if sort_by == "amount":
        query = query.order_by(Transaction.amount.desc() if sort_dir == "desc" else Transaction.amount.asc())
    elif sort_by == "merchant":
        query = query.order_by(Transaction.merchant.desc() if sort_dir == "desc" else Transaction.merchant.asc())
    else:
        query = query.order_by(Transaction.date.desc() if sort_dir == "desc" else Transaction.date.asc(), Transaction.id.desc())

    total_count = query.count()

    # Pagination
    limit = int(request.args.get("limit", 50))
    offset = int(request.args.get("offset", 0))
    txs = query.offset(offset).limit(limit).all()

    return jsonify({
        "transactions": [t.to_dict() for t in txs],
        "total_count": total_count,
        "limit": limit,
        "offset": offset,
    }), 200

@transactions_bp.route("", methods=["POST"])
@login_required
def create_transaction():
    user = request.current_user
    data = request.get_json() or {}

    try:
        amount = float(data.get("amount", 0))
    except (ValueError, TypeError):
        return jsonify({"error": "Valid amount is required"}), 400

    if amount <= 0:
        return jsonify({"error": "Amount must be greater than zero"}), 400

    tx_type = data.get("type", "expense")
    if tx_type not in ["income", "expense"]:
        return jsonify({"error": "Type must be either 'income' or 'expense'"}), 400

    tx_date = data.get("date") or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    merchant = (data.get("merchant") or "").strip()
    category_id = data.get("category_id")
    payment_method = data.get("payment_method") or "Card"
    notes = data.get("notes") or ""
    tags = data.get("tags") or []
    is_recurring = bool(data.get("is_recurring", False))
    receipt_id = data.get("receipt_id")
    currency = data.get("currency") or user.currency

    # Verify category ownership if specified
    if category_id:
        cat = Category.query.filter(
            Category.id == category_id,
            (Category.user_id == user.id) | (Category.user_id == None)
        ).first()
        if not cat:
            category_id = None

    tags_str = json.dumps(tags if isinstance(tags, list) else [])

    location_name = (data.get("location_name") or "").strip()
    latitude = data.get("latitude")
    longitude = data.get("longitude")
    try:
        lat_val = float(latitude) if latitude is not None else None
        lng_val = float(longitude) if longitude is not None else None
    except Exception:
        lat_val, lng_val = None, None

    tx = Transaction(
        user_id=user.id,
        category_id=category_id,
        receipt_id=receipt_id,
        type=tx_type,
        amount=amount,
        currency=currency,
        date=tx_date,
        merchant=merchant,
        payment_method=payment_method,
        notes=notes,
        tags=tags_str,
        is_recurring=is_recurring,
        location_name=location_name,
        latitude=lat_val,
        longitude=lng_val,
    )
    db.session.add(tx)
    db.session.commit()

    return jsonify({
        "message": "Transaction created successfully",
        "transaction": tx.to_dict()
    }), 201

@transactions_bp.route("/<int:tx_id>", methods=["GET"])
@login_required
def get_transaction(tx_id):
    user = request.current_user
    tx = Transaction.query.filter_by(id=tx_id, user_id=user.id).first()
    if not tx:
        return jsonify({"error": "Transaction not found"}), 404
    return jsonify({"transaction": tx.to_dict()}), 200

@transactions_bp.route("/<int:tx_id>", methods=["PUT"])
@login_required
def update_transaction(tx_id):
    user = request.current_user
    tx = Transaction.query.filter_by(id=tx_id, user_id=user.id).first()
    if not tx:
        return jsonify({"error": "Transaction not found"}), 404

    data = request.get_json() or {}

    if "amount" in data:
        try:
            amt = float(data["amount"])
            if amt > 0:
                tx.amount = amt
        except Exception:
            return jsonify({"error": "Invalid amount"}), 400

    if "type" in data and data["type"] in ["income", "expense"]:
        tx.type = data["type"]

    if "date" in data:
        tx.date = data["date"]

    if "merchant" in data:
        tx.merchant = (data["merchant"] or "").strip()

    if "category_id" in data:
        tx.category_id = data["category_id"]

    if "payment_method" in data:
        tx.payment_method = data["payment_method"]

    if "notes" in data:
        tx.notes = data["notes"]

    if "tags" in data:
        tx.tags = json.dumps(data["tags"] if isinstance(data["tags"], list) else [])

    if "is_recurring" in data:
        tx.is_recurring = bool(data["is_recurring"])

    if "currency" in data:
        tx.currency = data["currency"]

    db.session.commit()

    return jsonify({
        "message": "Transaction updated successfully",
        "transaction": tx.to_dict()
    }), 200

@transactions_bp.route("/<int:tx_id>", methods=["DELETE"])
@login_required
def delete_transaction(tx_id):
    user = request.current_user
    tx = Transaction.query.filter_by(id=tx_id, user_id=user.id).first()
    if not tx:
        return jsonify({"error": "Transaction not found"}), 404

    db.session.delete(tx)
    db.session.commit()

    return jsonify({"message": f"Transaction #{tx_id} deleted successfully"}), 200

@transactions_bp.route("/quick-add/nlp", methods=["POST"])
@login_required
def quick_add_nlp_parse():
    """
    Parses conversational string (e.g. 'Spent ₹450 at Cafe Coffee Day today')
    and returns structured proposed transaction for user confirmation.
    """
    data = request.get_json() or {}
    text = data.get("text", "").strip()

    if not text:
        return jsonify({"error": "Text is required"}), 400

    parsed = parse_natural_language_transaction(text, request.current_user.id)
    return jsonify({
        "parsed": parsed,
        "needs_confirmation": True
    }), 200
