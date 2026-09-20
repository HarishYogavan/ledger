import re
import logging
from flask import Blueprint, request, jsonify, session, send_file
from sqlalchemy.exc import IntegrityError
from models import db, User, UserSettings, Category, UserSession
from services.auth_service import (
    hash_password, verify_password, seed_default_categories,
    export_all_user_data_zip, create_user_session,
    validate_user_session, get_active_sessions, invalidate_session,
    invalidate_all_other_sessions, verify_jwt, extract_token_from_request,
    generate_jwt
)
from routes import login_required

logger = logging.getLogger(__name__)

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    full_name = (data.get("full_name") or "").strip()
    currency = data.get("currency") or "₹"

    logger.info("Registration attempt received for email: %s", email)

    if not email or not password or not full_name:
        logger.warning("Registration rejected: missing required fields for email: %s", email)
        return jsonify({"error": "Full name, email, and password are required"}), 400

    if not re.match(r"^[^@]+@[^@]+\.[^@]+$", email):
        logger.warning("Registration rejected: invalid email format for email: %s", email)
        return jsonify({"error": "Please provide a valid email address"}), 400

    if len(password) < 8:
        logger.warning("Registration rejected: password under 8 chars for email: %s", email)
        return jsonify({"error": "Password must be at least 8 characters long"}), 400

    existing = User.query.filter_by(email=email).first()
    if existing:
        logger.info("Registration duplicate check hit for email: %s", email)
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

    try:
        db.session.add(new_user)
        db.session.commit()
        logger.info("User record created in database with user_id: %s", new_user.id)
    except IntegrityError:
        db.session.rollback()
        logger.warning("IntegrityError on registration commit for email: %s (duplicate detected)", email)
        return jsonify({"error": "An account with this email address already exists"}), 409
    except Exception as e:
        db.session.rollback()
        logger.error("Database error while committing new user: %s", str(e))
        return jsonify({"error": "Database error while creating user account. Please try again."}), 500

    # Seed default categories & settings
    try:
        seed_default_categories(new_user.id)
        settings = UserSettings(user_id=new_user.id)
        db.session.add(settings)
        db.session.commit()
        logger.info("Default categories and settings seeded for user_id: %s", new_user.id)
    except Exception as e:
        logger.warning("Default seeding non-fatal error for user_id %s: %s", new_user.id, str(e))

    # Create persistent device session & 30-day token
    user_agent = request.headers.get("User-Agent", "")
    ip_addr = request.headers.get("X-Forwarded-For", request.remote_addr or "").split(",")[0].strip()
    token, session_record = create_user_session(new_user.id, user_agent, ip_addr)
    logger.info("Persistent session created with session_id: %s for user_id: %s", session_record.id, new_user.id)

    session.permanent = True
    session["user_id"] = new_user.id
    session["session_id"] = session_record.id

    logger.info("Registration flow completed successfully for user_id: %s", new_user.id)

    return jsonify({
        "message": "Account created successfully",
        "user": new_user.to_dict(),
        "token": token,
        "session_id": session_record.id,
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

    # Create persistent device session & 30-day token
    user_agent = request.headers.get("User-Agent", "")
    ip_addr = request.headers.get("X-Forwarded-For", request.remote_addr or "").split(",")[0].strip()
    token, session_record = create_user_session(user.id, user_agent, ip_addr)

    session.permanent = True
    session["user_id"] = user.id
    session["session_id"] = session_record.id

    return jsonify({
        "message": "Logged in successfully",
        "user": user.to_dict(),
        "token": token,
        "session_id": session_record.id,
    }), 200

@auth_bp.route("/logout", methods=["POST"])
def logout():
    current_session_id = getattr(request, "current_session_id", None) or session.get("session_id")
    user_id = session.get("user_id")

    if not current_session_id:
        token = extract_token_from_request(request)
        if token:
            jwt_res = verify_jwt(token)
            if jwt_res:
                user_id, current_session_id = jwt_res

    if current_session_id and user_id:
        invalidate_session(current_session_id, user_id)

    session.clear()
    return jsonify({"message": "Logged out successfully"}), 200

@auth_bp.route("/demo", methods=["POST"])
def demo_login():
    demo_email = "live_verifier@ledger.finance"
    user = User.query.filter_by(email=demo_email).first()
    if not user:
        user = User(
            email=demo_email,
            password_hash=hash_password("SecurePassword123!"),
            full_name="Live Verifier",
            currency="₹",
            theme="dark",
            privacy_mode=False,
            onboarding_completed=True,
        )
        db.session.add(user)
        db.session.commit()
        seed_default_categories(user.id)
        settings = UserSettings(user_id=user.id)
        db.session.add(settings)
        db.session.commit()

    user_agent = request.headers.get("User-Agent", "")
    ip_addr = request.headers.get("X-Forwarded-For", request.remote_addr or "").split(",")[0].strip()
    token, session_record = create_user_session(user.id, user_agent, ip_addr)

    session.permanent = True
    session["user_id"] = user.id
    session["session_id"] = session_record.id

    return jsonify({
        "message": "Demo session started",
        "user": user.to_dict(),
        "token": token,
        "session_id": session_record.id,
    }), 200

@auth_bp.route("/me", methods=["GET"])
@login_required
def me():
    current_sid = getattr(request, "current_session_id", None) or session.get("session_id")
    token = generate_jwt(request.current_user.id, current_sid)
    return jsonify({
        "user": request.current_user.to_dict(),
        "session_id": current_sid,
        "token": token,
        "authenticated": True
    }), 200

@auth_bp.route("/sessions", methods=["GET"])
@login_required
def list_sessions():
    current_sid = getattr(request, "current_session_id", None) or session.get("session_id")
    sessions = get_active_sessions(request.current_user.id, current_sid)
    return jsonify({"sessions": sessions}), 200

@auth_bp.route("/sessions/<int:session_id>", methods=["DELETE"])
@login_required
def revoke_session_endpoint(session_id):
    success = invalidate_session(session_id, request.current_user.id)
    if not success:
        return jsonify({"error": "Session not found"}), 404
    return jsonify({"message": "Device session revoked successfully"}), 200

@auth_bp.route("/sessions/revoke-others", methods=["POST"])
@login_required
def revoke_other_sessions_endpoint():
    current_sid = getattr(request, "current_session_id", None) or session.get("session_id")
    count = invalidate_all_other_sessions(request.current_user.id, current_sid)
    return jsonify({"message": f"Revoked {count} other active device sessions"}), 200

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
    session.clear()

    return jsonify({"message": f"Account #{user_id} and all associated data permanently deleted."}), 200
