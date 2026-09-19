from functools import wraps
from flask import session, request, jsonify
from models import db, User
from services.auth_service import verify_jwt, validate_user_session

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = None
        session_id = None

        # 1. Authorization: Bearer <token> takes precedence
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
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
            session.clear()
            return jsonify({"error": "User not found", "authenticated": False}), 401

        # 4. Validate persistent session
        valid_session = validate_user_session(user_id, session_id)
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
