import re
from flask import Blueprint, request, jsonify, session, send_file
from models import db, User, UserSettings, Category
from services.auth_service import hash_password, verify_password, generate_jwt, seed_default_categories, export_all_user_data_zip
from routes import login_required

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    full_name = (data.get("full_name") or "").strip()
    currency = data.get("currency") or "₹"

    if not email or not password or not full_name:
        return jsonify({"error": "Full name, email, and password are required"}), 400

    if not re.match(r"^[^@]+@[^@]+\.[^@]+$", email):
        return jsonify({"error": "Please provide a valid email address"}), 400

    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters long"}), 400

    existing = User.query.filter_by(email=email).first()
    if existing:
        return jsonify({"error": "An account with this email address already exists"}), 409

    pwd_hash = hash_password(password)
    new_user = User(
        email=email,
        password_hash=pwd_hash,
        full_name=full_name,
        currency=currency,
        theme="dark",
        privacy_mode=False,
        onboarding_completed=False,
    )
    db.session.add(new_user)
    db.session.commit()

    # Seed default categories & settings
    seed_default_categories(new_user.id)
    settings = UserSettings(user_id=new_user.id)
    db.session.add(settings)
    db.session.commit()

    # Create session & token
    session["user_id"] = new_user.id
    token = generate_jwt(new_user.id)

    return jsonify({
        "message": "Account created successfully",
        "user": new_user.to_dict(),
        "token": token,
    }), 201

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not verify_password(password, user.password_hash):
        return jsonify({"error": "Invalid email or password"}), 401

    session["user_id"] = user.id
    token = generate_jwt(user.id)

    return jsonify({
        "message": "Logged in successfully",
        "user": user.to_dict(),
        "token": token,
    }), 200

@auth_bp.route("/logout", methods=["POST"])
def logout():
    session.pop("user_id", None)
    return jsonify({"message": "Logged out successfully"}), 200

@auth_bp.route("/me", methods=["GET"])
@login_required
def me():
    return jsonify({
        "user": request.current_user.to_dict(),
        "authenticated": True
    }), 200

@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    new_password = data.get("new_password") or ""

    if not email or not new_password:
        return jsonify({"error": "Email and new password are required"}), 400

    if len(new_password) < 8:
        return jsonify({"error": "New password must be at least 8 characters long"}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        # Avoid user enumeration in public responses
        return jsonify({"message": "If an account matches this email, the password has been reset."}), 200

    user.password_hash = hash_password(new_password)
    db.session.commit()
    return jsonify({"message": "Password updated successfully. You can now log in."}), 200

@auth_bp.route("/onboarding", methods=["POST"])
@login_required
def complete_onboarding():
    user = request.current_user
    data = request.get_json() or {}

    if "currency" in data:
        user.currency = data["currency"]
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

    user.onboarding_completed = True
    db.session.commit()

    return jsonify({
        "message": "Onboarding completed successfully",
        "user": user.to_dict()
    }), 200

@auth_bp.route("/export-data", methods=["GET"])
@login_required
def export_data():
    user = request.current_user
    zip_buffer = export_all_user_data_zip(user.id)
    return send_file(
        zip_buffer,
        mimetype="application/zip",
        as_attachment=True,
        download_name=f"ledger_data_{user.id}_{user.email.split('@')[0]}.zip"
    )

@auth_bp.route("/delete-account", methods=["POST"])
@login_required
def delete_account():
    data = request.get_json() or {}
    password = data.get("password") or ""
    user = request.current_user

    if not verify_password(password, user.password_hash):
        return jsonify({"error": "Incorrect password. Account deletion canceled."}), 403

    user_id = user.id
    db.session.delete(user)
    db.session.commit()
    session.pop("user_id", None)

    return jsonify({"message": f"Account #{user_id} and all associated data permanently deleted."}), 200
