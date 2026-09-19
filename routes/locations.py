from flask import Blueprint, request, jsonify
from models import db, Transaction, UserSettings
from routes import login_required

locations_bp = Blueprint("locations", __name__, url_prefix="/api/locations")

@locations_bp.route("/transactions", methods=["GET"])
@login_required
def get_location_transactions():
    user = request.current_user
    # Fetch transactions where latitude and longitude exist
    txs = Transaction.query.filter(
        Transaction.user_id == user.id,
        Transaction.latitude.isnot(None),
        Transaction.longitude.isnot(None)
    ).order_by(Transaction.date.desc()).all()

    tracking_enabled = False
    if user.settings:
        tracking_enabled = bool(user.settings.location_tracking_enabled)

    return jsonify({
        "tracking_enabled": tracking_enabled,
        "currency": user.currency,
        "count": len(txs),
        "transactions": [t.to_dict() for t in txs],
    }), 200

@locations_bp.route("/toggle", methods=["POST"])
@login_required
def toggle_location_tracking():
    user = request.current_user
    if not user.settings:
        user.settings = UserSettings(user_id=user.id)

    data = request.get_json() or {}
    if "enabled" in data:
        user.settings.location_tracking_enabled = bool(data["enabled"])
    else:
        user.settings.location_tracking_enabled = not user.settings.location_tracking_enabled

    db.session.commit()
    return jsonify({
        "message": f"Location tracking {'enabled' if user.settings.location_tracking_enabled else 'disabled'}",
        "tracking_enabled": user.settings.location_tracking_enabled,
    }), 200

@locations_bp.route("/clear", methods=["POST"])
@login_required
def clear_location_data():
    user = request.current_user
    # Purge location coordinates from all user transactions
    txs = Transaction.query.filter_by(user_id=user.id).all()
    count = 0
    for t in txs:
        if t.latitude is not None or t.longitude is not None or t.location_name:
            t.latitude = None
            t.longitude = None
            t.location_name = ""
            count += 1

    db.session.commit()
    return jsonify({"message": f"Cleared location coordinates from {count} transactions"}), 200
