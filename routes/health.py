from flask import Blueprint, jsonify, request
from services.health_service import evaluate_financial_health
from routes import login_required

health_bp = Blueprint("health", __name__, url_prefix="/api/health")

@health_bp.route("", methods=["GET"])
@login_required
def get_health_indicators():
    user = request.current_user
    health_data = evaluate_financial_health(user.id)
    return jsonify(health_data), 200
