from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from models import db, Budget, Category, Transaction
from routes import login_required

budgets_bp = Blueprint("budgets", __name__, url_prefix="/api/budgets")

@budgets_bp.route("", methods=["GET"])
@login_required
def get_budgets():
    user = request.current_user
    now = datetime.now(timezone.utc)
    curr_month_str = now.strftime("%Y-%m")

    budgets = Budget.query.filter_by(user_id=user.id).all()
    results = []

    for b in budgets:
        # Calculate used amount in current period
        used = db.session.query(db.func.sum(Transaction.amount)).filter(
            Transaction.user_id == user.id,
            Transaction.category_id == b.category_id,
            Transaction.type == "expense",
            Transaction.date.startswith(curr_month_str)
        ).scalar() or 0.0

        remaining = b.amount - used
        pct = round((used / b.amount * 100.0), 1) if b.amount > 0 else 0.0

        item = b.to_dict()
        item["used"] = round(used, 2)
        item["remaining"] = round(remaining, 2)
        item["progress_percent"] = pct
        item["is_exceeded"] = remaining < 0
        results.append(item)

    return jsonify({"budgets": results}), 200

@budgets_bp.route("", methods=["POST"])
@login_required
def set_budget():
    user = request.current_user
    data = request.get_json() or {}

    category_id = data.get("category_id")
    try:
        amount = float(data.get("amount", 0))
    except (ValueError, TypeError):
        return jsonify({"error": "Valid amount is required"}), 400

    if not category_id or amount <= 0:
        return jsonify({"error": "Category and positive budget amount are required"}), 400

    existing = Budget.query.filter_by(user_id=user.id, category_id=category_id).first()
    if existing:
        existing.amount = amount
        existing.period = data.get("period", "monthly")
        db.session.commit()
        return jsonify({"message": "Budget updated successfully", "budget": existing.to_dict()}), 200

    b = Budget(
        user_id=user.id,
        category_id=category_id,
        amount=amount,
        period=data.get("period", "monthly"),
    )
    db.session.add(b)
    db.session.commit()

    return jsonify({"message": "Budget created successfully", "budget": b.to_dict()}), 201

@budgets_bp.route("/<int:budget_id>", methods=["DELETE"])
@login_required
def delete_budget(budget_id):
    user = request.current_user
    b = Budget.query.filter_by(id=budget_id, user_id=user.id).first()
    if not b:
        return jsonify({"error": "Budget not found"}), 404

    db.session.delete(b)
    db.session.commit()
    return jsonify({"message": "Budget deleted successfully"}), 200
