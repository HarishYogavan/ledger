from flask import Blueprint, request, jsonify
from models import db, RecurringPayment
from services.recurring_service import detect_recurring_patterns, sync_detected_recurring
from routes import login_required

recurring_bp = Blueprint("recurring", __name__, url_prefix="/api/recurring")

@recurring_bp.route("", methods=["GET"])
@login_required
def get_recurring():
    user = request.current_user
    # Active items from database
    items = RecurringPayment.query.filter_by(user_id=user.id).order_by(RecurringPayment.created_at.desc()).all()

    # Also detect any unrecorded patterns from actual transaction history
    detected_patterns = detect_recurring_patterns(user.id)

    return jsonify({
        "recurring_payments": [r.to_dict() for r in items],
        "detected_patterns": detected_patterns,
    }), 200

@recurring_bp.route("/detect", methods=["POST"])
@login_required
def run_detection():
    user = request.current_user
    synced = sync_detected_recurring(user.id)
    items = RecurringPayment.query.filter_by(user_id=user.id).all()
    return jsonify({
        "message": f"Detected {len(synced)} recurring payment pattern(s)",
        "recurring_payments": [r.to_dict() for r in items],
        "detected_patterns": synced,
    }), 200

@recurring_bp.route("", methods=["POST"])
@login_required
def create_recurring():
    user = request.current_user
    data = request.get_json() or {}

    name = (data.get("name") or "").strip()
    try:
        amount = float(data.get("amount", 0))
    except (ValueError, TypeError):
        return jsonify({"error": "Amount must be a valid number"}), 400

    if not name or amount <= 0:
        return jsonify({"error": "Name and positive amount are required"}), 400

    frequency = data.get("frequency", "monthly")
    category_id = data.get("category_id")
    next_due_date = data.get("next_due_date")
    last_payment_date = data.get("last_payment_date")

    item = RecurringPayment(
        user_id=user.id,
        category_id=category_id,
        name=name,
        amount=amount,
        frequency=frequency,
        next_due_date=next_due_date,
        last_payment_date=last_payment_date,
        is_auto_detected=False,
        status="active"
    )
    db.session.add(item)
    db.session.commit()

    return jsonify({"message": "Recurring payment scheduled", "recurring": item.to_dict()}), 201

@recurring_bp.route("/<int:item_id>", methods=["PUT"])
@login_required
def update_recurring(item_id):
    user = request.current_user
    item = RecurringPayment.query.filter_by(id=item_id, user_id=user.id).first()
    if not item:
        return jsonify({"error": "Recurring payment not found"}), 404

    data = request.get_json() or {}
    if "name" in data and data["name"].strip():
        item.name = data["name"].strip()
    if "amount" in data:
        item.amount = float(data["amount"])
    if "frequency" in data and data["frequency"] in ["daily", "weekly", "monthly", "yearly"]:
        item.frequency = data["frequency"]
    if "next_due_date" in data:
        item.next_due_date = data["next_due_date"]
    if "status" in data and data["status"] in ["active", "paused", "cancelled"]:
        item.status = data["status"]

    db.session.commit()
    return jsonify({"message": "Recurring payment updated", "recurring": item.to_dict()}), 200

@recurring_bp.route("/<int:item_id>", methods=["DELETE"])
@login_required
def delete_recurring(item_id):
    user = request.current_user
    item = RecurringPayment.query.filter_by(id=item_id, user_id=user.id).first()
    if not item:
        return jsonify({"error": "Recurring payment not found"}), 404

    db.session.delete(item)
    db.session.commit()
    return jsonify({"message": "Recurring payment deleted successfully"}), 200
