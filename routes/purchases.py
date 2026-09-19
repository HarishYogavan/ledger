from datetime import datetime, timedelta, timezone
from flask import Blueprint, request, jsonify
from models import db, Purchase, PurchaseEvent, Category
from routes import login_required

purchases_bp = Blueprint("purchases", __name__, url_prefix="/api/purchases")

@purchases_bp.route("", methods=["GET"])
@login_required
def get_purchases():
    user = request.current_user
    purchases = Purchase.query.filter_by(user_id=user.id).order_by(Purchase.purchase_date.desc()).all()
    return jsonify({
        "currency": user.currency,
        "purchases": [p.to_dict() for p in purchases],
        "count": len(purchases),
    }), 200

@purchases_bp.route("", methods=["POST"])
@login_required
def create_purchase():
    user = request.current_user
    data = request.get_json() or {}

    product_name = data.get("product_name", "").strip()
    if not product_name:
        return jsonify({"error": "Product name is required"}), 400

    try:
        price = float(data.get("price", 0.0))
    except Exception:
        return jsonify({"error": "Valid price is required"}), 400

    purchase_date = data.get("purchase_date") or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    merchant = data.get("merchant", "").strip()
    category_id = data.get("category_id")
    notes = data.get("notes", "").strip()
    receipt_id = data.get("receipt_id")
    document_id = data.get("document_id")

    try:
        warranty_months = int(data.get("warranty_months", 0))
    except Exception:
        warranty_months = 0

    warranty_expiry = data.get("warranty_expiry")
    if not warranty_expiry and warranty_months > 0:
        try:
            p_dt = datetime.strptime(purchase_date, "%Y-%m-%d")
            # Approximate months as 30.4 days
            exp_dt = p_dt + timedelta(days=int(warranty_months * 30.44))
            warranty_expiry = exp_dt.strftime("%Y-%m-%d")
        except Exception:
            warranty_expiry = None

    purchase = Purchase(
        user_id=user.id,
        product_name=product_name,
        merchant=merchant,
        purchase_date=purchase_date,
        price=price,
        currency=user.currency,
        category_id=category_id,
        warranty_months=warranty_months,
        warranty_expiry=warranty_expiry,
        receipt_id=receipt_id,
        document_id=document_id,
        notes=notes,
        status="active"
    )
    db.session.add(purchase)
    db.session.flush()

    # Create initial lifecycle event: 'purchase'
    initial_event = PurchaseEvent(
        purchase_id=purchase.id,
        event_type="purchase",
        event_date=purchase_date,
        cost=price,
        description=f"Purchased from {merchant or 'retailer'}",
        service_provider=merchant
    )
    db.session.add(initial_event)
    db.session.commit()

    return jsonify({"message": "Purchase created successfully", "purchase": purchase.to_dict()}), 201

@purchases_bp.route("/<int:purchase_id>", methods=["GET"])
@login_required
def get_purchase_details(purchase_id):
    user = request.current_user
    purchase = Purchase.query.filter_by(id=purchase_id, user_id=user.id).first()
    if not purchase:
        return jsonify({"error": "Purchase record not found"}), 404

    events = purchase.events.order_by(PurchaseEvent.event_date.asc()).all()
    return jsonify({
        "purchase": purchase.to_dict(),
        "events": [e.to_dict() for e in events],
    }), 200

@purchases_bp.route("/<int:purchase_id>", methods=["PUT"])
@login_required
def update_purchase(purchase_id):
    user = request.current_user
    purchase = Purchase.query.filter_by(id=purchase_id, user_id=user.id).first()
    if not purchase:
        return jsonify({"error": "Purchase record not found"}), 404

    data = request.get_json() or {}
    if "product_name" in data:
        purchase.product_name = data["product_name"].strip()
    if "merchant" in data:
        purchase.merchant = data["merchant"].strip()
    if "price" in data:
        purchase.price = float(data["price"])
    if "purchase_date" in data:
        purchase.purchase_date = data["purchase_date"]
    if "category_id" in data:
        purchase.category_id = data["category_id"]
    if "warranty_months" in data:
        purchase.warranty_months = int(data["warranty_months"])
    if "warranty_expiry" in data:
        purchase.warranty_expiry = data["warranty_expiry"]
    if "notes" in data:
        purchase.notes = data["notes"]
    if "status" in data:
        purchase.status = data["status"]

    db.session.commit()
    return jsonify({"message": "Purchase updated successfully", "purchase": purchase.to_dict()}), 200

@purchases_bp.route("/<int:purchase_id>", methods=["DELETE"])
@login_required
def delete_purchase(purchase_id):
    user = request.current_user
    purchase = Purchase.query.filter_by(id=purchase_id, user_id=user.id).first()
    if not purchase:
        return jsonify({"error": "Purchase record not found"}), 404

    db.session.delete(purchase)
    db.session.commit()
    return jsonify({"message": "Purchase deleted successfully"}), 200

@purchases_bp.route("/<int:purchase_id>/events", methods=["POST"])
@login_required
def add_lifecycle_event(purchase_id):
    user = request.current_user
    purchase = Purchase.query.filter_by(id=purchase_id, user_id=user.id).first()
    if not purchase:
        return jsonify({"error": "Purchase record not found"}), 404

    data = request.get_json() or {}
    event_type = data.get("event_type", "maintenance")  # 'warranty_claim', 'maintenance', 'repair', 'replacement'
    event_date = data.get("event_date") or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    cost = float(data.get("cost", 0.0))
    description = data.get("description", "").strip()
    service_provider = data.get("service_provider", "").strip()

    event = PurchaseEvent(
        purchase_id=purchase.id,
        event_type=event_type,
        event_date=event_date,
        cost=cost,
        description=description,
        service_provider=service_provider
    )
    db.session.add(event)
    db.session.commit()

    return jsonify({"message": "Lifecycle event recorded", "event": event.to_dict()}), 201

@purchases_bp.route("/events/<int:event_id>", methods=["DELETE"])
@login_required
def delete_lifecycle_event(event_id):
    user = request.current_user
    event = PurchaseEvent.query.get(event_id)
    if not event or event.purchase.user_id != user.id:
        return jsonify({"error": "Lifecycle event not found"}), 404

    db.session.delete(event)
    db.session.commit()
    return jsonify({"message": "Lifecycle event deleted"}), 200
