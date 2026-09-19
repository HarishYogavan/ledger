from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from models import db, Bill
from routes import login_required

bills_bp = Blueprint("bills", __name__, url_prefix="/api/bills")

@bills_bp.route("", methods=["GET"])
@login_required
def get_bills():
    user = request.current_user
    bills = Bill.query.filter_by(user_id=user.id).order_by(Bill.due_date.asc()).all()
    return jsonify({"bills": [b.to_dict() for b in bills]}), 200

@bills_bp.route("", methods=["POST"])
@login_required
def create_bill():
    user = request.current_user
    data = request.get_json() or {}

    title = (data.get("title") or "").strip()
    try:
        amount = float(data.get("amount", 0))
    except (ValueError, TypeError):
        return jsonify({"error": "Amount must be a valid number"}), 400

    due_date = data.get("due_date")
    if not title or amount <= 0 or not due_date:
        return jsonify({"error": "Title, positive amount, and due date are required"}), 400

    category_id = data.get("category_id")

    bill = Bill(
        user_id=user.id,
        category_id=category_id,
        title=title,
        amount=amount,
        due_date=due_date,
        is_paid=bool(data.get("is_paid", False)),
    )
    db.session.add(bill)
    db.session.commit()

    return jsonify({"message": "Bill added successfully", "bill": bill.to_dict()}), 201

@bills_bp.route("/<int:bill_id>/toggle-paid", methods=["POST"])
@login_required
def toggle_bill_paid(bill_id):
    user = request.current_user
    bill = Bill.query.filter_by(id=bill_id, user_id=user.id).first()
    if not bill:
        return jsonify({"error": "Bill not found"}), 404

    bill.is_paid = not bill.is_paid
    db.session.commit()
    return jsonify({"message": f"Bill status updated to {'Paid' if bill.is_paid else 'Unpaid'}", "bill": bill.to_dict()}), 200

@bills_bp.route("/<int:bill_id>", methods=["DELETE"])
@login_required
def delete_bill(bill_id):
    user = request.current_user
    bill = Bill.query.filter_by(id=bill_id, user_id=user.id).first()
    if not bill:
        return jsonify({"error": "Bill not found"}), 404

    db.session.delete(bill)
    db.session.commit()
    return jsonify({"message": "Bill removed successfully"}), 200
