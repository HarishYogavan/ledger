import json
from flask import Blueprint, request, jsonify
from models import db, User, UserSettings
from services.auth_service import hash_password, verify_password
from routes import login_required

settings_bp = Blueprint("settings", __name__, url_prefix="/api/settings")

@settings_bp.route("", methods=["GET"])
@login_required
def get_settings():
    user = request.current_user
    settings = UserSettings.query.filter_by(user_id=user.id).first()
    if not settings:
        settings = UserSettings(user_id=user.id)
        db.session.add(settings)
        db.session.commit()

    return jsonify({
        "user": user.to_dict(),
        "settings": settings.to_dict(),
    }), 200

@settings_bp.route("", methods=["PUT"])
@login_required
def update_settings():
    user = request.current_user
    settings = UserSettings.query.filter_by(user_id=user.id).first()
    if not settings:
        settings = UserSettings(user_id=user.id)
        db.session.add(settings)

    data = request.get_json() or {}

    # User profile fields
    if "full_name" in data and data["full_name"].strip():
        user.full_name = data["full_name"].strip()
    if "currency" in data and data["currency"].strip():
        user.currency = data["currency"].strip()
    if "theme" in data and data["theme"] in ["dark", "light", "system"]:
        user.theme = data["theme"]
    if "privacy_mode" in data:
        user.privacy_mode = bool(data["privacy_mode"])
    if "monthly_income" in data:
        try:
            user.monthly_income = float(data["monthly_income"])
        except Exception:
            pass
    if "savings_target" in data:
        try:
            user.savings_target = float(data["savings_target"])
        except Exception:
            pass

    # Password update
    if "current_password" in data and "new_password" in data:
        curr_pwd = data["current_password"]
        new_pwd = data["new_password"]
        if not verify_password(curr_pwd, user.password_hash):
            return jsonify({"error": "Current password does not match"}), 400
        if len(new_pwd) < 8:
            return jsonify({"error": "New password must be at least 8 characters"}), 400
        user.password_hash = hash_password(new_pwd)

    # Preferences JSON
    if "notification_prefs" in data:
        settings.notification_prefs = json.dumps(data["notification_prefs"])
    if "ai_prefs" in data:
        settings.ai_prefs = json.dumps(data["ai_prefs"])
    if "dashboard_layout" in data:
        settings.dashboard_layout = json.dumps(data["dashboard_layout"])
    if "location_tracking_enabled" in data:
        settings.location_tracking_enabled = bool(data["location_tracking_enabled"])
    if "ai_memory_enabled" in data:
        settings.ai_memory_enabled = bool(data["ai_memory_enabled"])

    db.session.commit()

    return jsonify({
        "message": "Settings updated successfully",
        "user": user.to_dict(),
        "settings": settings.to_dict(),
    }), 200

@settings_bp.route("/privacy-mode/toggle", methods=["POST"])
@login_required
def toggle_privacy_mode():
    user = request.current_user
    user.privacy_mode = not user.privacy_mode
    db.session.commit()
    return jsonify({
        "message": f"Privacy mode {'enabled' if user.privacy_mode else 'disabled'}",
        "privacy_mode": user.privacy_mode
    }), 200
