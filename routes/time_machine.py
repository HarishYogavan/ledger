from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from services.time_machine_service import get_historical_snapshot, analyze_what_changed
from routes import login_required

time_machine_bp = Blueprint("time_machine", __name__, url_prefix="/api/time-machine")

@time_machine_bp.route("/snapshot", methods=["GET"])
@login_required
def get_snapshot():
    user = request.current_user
    target_period = request.args.get("date") or datetime.now(timezone.utc).strftime("%Y-%m")
    res = get_historical_snapshot(user.id, target_period)
    return jsonify(res), 200

@time_machine_bp.route("/what-changed", methods=["GET"])
@login_required
def get_what_changed():
    user = request.current_user
    now = datetime.now(timezone.utc)
    curr_month = now.strftime("%Y-%m")
    # Prior month default
    prior_month = (now.replace(day=1) - datetime.resolution).strftime("%Y-%m")

    period_a = request.args.get("period_a", prior_month)
    period_b = request.args.get("period_b", curr_month)

    res = analyze_what_changed(user.id, period_a, period_b)
    return jsonify(res), 200
