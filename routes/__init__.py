from functools import wraps
from flask import session, request, jsonify
from models import db, User
from services.auth_service import verify_jwt, validate_user_session, extract_token_from_request

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = None
        session_id = None

        # 1. Authorization: Bearer, X-Auth-Token, or WSGI environ
        token = extract_token_from_request(request)
        if token:
            jwt_res = verify_jwt(token)
            if jwt_res:
                user_id, session_id = jwt_res

        # 2. Fall back to cookie session
        if not user_id:
            user_id = session.get("user_id")
            session_id = session.get("session_id")

        if not user_id:
            return jsonify({"error": "Authentication required", "authenticated": False}), 401

        # 3. Validate user exists in database
        user = db.session.get(User, user_id)
        if not user:
            try:
                from services.cloud_sync import get_cloud_user
                remote = get_cloud_user(f"id_{user_id}")
                if remote:
                    user = User(
                        id=user_id,
                        email=remote["email"],
                        password_hash=remote.get("password_hash", ""),
                        full_name=remote.get("full_name", "User"),
                        currency=remote.get("currency", "₹"),
                        theme="dark",
                        privacy_mode=False,
                        onboarding_completed=True,
                    )
                    db.session.add(user)
                    db.session.commit()
            except Exception:
                db.session.rollback()
                user = db.session.get(User, user_id)

        if not user:
            session.clear()
            return jsonify({"error": "User not found", "authenticated": False}), 401

        # 4. Validate persistent session
        user_agent = request.headers.get("User-Agent", "")
        ip_addr = request.headers.get("X-Forwarded-For", request.remote_addr or "").split(",")[0].strip()
        valid_session = validate_user_session(user_id, session_id, user_agent, ip_addr)
        if session_id and not valid_session:
            session.clear()
            return jsonify({"error": "Session revoked or expired", "authenticated": False}), 401

        # 5. Keep session cookie refreshed and permanent
        session.permanent = True
        session["user_id"] = user.id
        if valid_session:
            session["session_id"] = valid_session.id
            request.current_session_id = valid_session.id
        else:
            request.current_session_id = session_id

        # Attach user to request context
        request.current_user = user
        return f(*args, **kwargs)
    return decorated_function
