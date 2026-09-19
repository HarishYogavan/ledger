from flask import Blueprint, request, jsonify
from models import db, Category, Transaction, Budget
from routes import login_required

categories_bp = Blueprint("categories", __name__, url_prefix="/api/categories")

@categories_bp.route("", methods=["GET"])
@login_required
def get_categories():
    user = request.current_user
    cats = Category.query.filter(
        (Category.user_id == user.id) | (Category.user_id == None)
    ).order_by(Category.name.asc()).all()

    return jsonify({"categories": [c.to_dict() for c in cats]}), 200

@categories_bp.route("", methods=["POST"])
@login_required
def create_category():
    user = request.current_user
    data = request.get_json() or {}

    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Category name is required"}), 400

    ctype = data.get("type", "expense")
    if ctype not in ["expense", "income"]:
        ctype = "expense"

    icon = data.get("icon") or "tag"
    color = data.get("color") or "#06D6A0"
    budget_limit = float(data.get("budget_limit") or 0.0)

    cat = Category(
        user_id=user.id,
        name=name,
        type=ctype,
        icon=icon,
        color=color,
        budget_limit=budget_limit,
        is_default=False,
    )
    db.session.add(cat)
    db.session.commit()

    return jsonify({
        "message": "Category created successfully",
        "category": cat.to_dict()
    }), 201

@categories_bp.route("/<int:cat_id>", methods=["PUT"])
@login_required
def update_category(cat_id):
    user = request.current_user
    cat = Category.query.filter_by(id=cat_id, user_id=user.id).first()
    if not cat:
        return jsonify({"error": "Custom category not found or default categories cannot be altered"}), 404

    data = request.get_json() or {}
    if "name" in data and data["name"].strip():
        cat.name = data["name"].strip()
    if "icon" in data:
        cat.icon = data["icon"]
    if "color" in data:
        cat.color = data["color"]
    if "budget_limit" in data:
        cat.budget_limit = float(data["budget_limit"])

    db.session.commit()
    return jsonify({"message": "Category updated", "category": cat.to_dict()}), 200

@categories_bp.route("/<int:cat_id>", methods=["DELETE"])
@login_required
def delete_category(cat_id):
    user = request.current_user
    cat = Category.query.filter_by(id=cat_id, user_id=user.id).first()
    if not cat:
        return jsonify({"error": "Custom category not found"}), 404

    # Check for dependent transactions
    tx_count = Transaction.query.filter_by(user_id=user.id, category_id=cat_id).count()
    reassign_to = request.args.get("reassign_to")

    if tx_count > 0:
        if not reassign_to:
            return jsonify({
                "error": f"Cannot delete category '{cat.name}' because {tx_count} transaction(s) depend on it. Please specify reassign_to category ID.",
                "dependent_transactions": tx_count
            }), 409

        # Reassign transactions
        new_cat = Category.query.filter(
            Category.id == int(reassign_to),
            (Category.user_id == user.id) | (Category.user_id == None)
        ).first()
        if not new_cat:
            return jsonify({"error": "Reassignment target category not found"}), 400

        Transaction.query.filter_by(user_id=user.id, category_id=cat_id).update({"category_id": new_cat.id})

    db.session.delete(cat)
    db.session.commit()

    return jsonify({"message": f"Category '{cat.name}' deleted successfully"}), 200
