from functools import wraps
from flask import session, request, jsonify
from models import db, User
from services.auth_service import verify_jwt

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = None
        # Authorization: Bearer <token> takes precedence
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            user_id = verify_jwt(token)

        if not user_id:
            user_id = session.get("user_id")

        if not user_id:
            return jsonify({"error": "Authentication required", "authenticated": False}), 401

        user = db.session.get(User, user_id)
        if not user:
            session.pop("user_id", None)
            return jsonify({"error": "User not found", "authenticated": False}), 401

        # Attach user to request context
        request.current_user = user
        return f(*args, **kwargs)
    return decorated_function
