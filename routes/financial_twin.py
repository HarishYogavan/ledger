from flask import Blueprint, request, jsonify
from models import db, Scenario, ScenarioChange
from services.twin_service import run_twin_simulation, analyze_purchase_impact, calculate_baseline_metrics
from routes import login_required

twin_bp = Blueprint("financial_twin", __name__, url_prefix="/api/scenarios")

@twin_bp.route("", methods=["GET"])
@login_required
def get_scenarios():
    user = request.current_user
    scenarios = Scenario.query.filter_by(user_id=user.id).order_by(Scenario.created_at.desc()).all()
    baseline = calculate_baseline_metrics(user.id)
    return jsonify({
        "scenarios": [s.to_dict() for s in scenarios],
        "baseline": baseline,
    }), 200

@twin_bp.route("", methods=["POST"])
@login_required
def create_scenario():
    user = request.current_user
    data = request.get_json() or {}

    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Scenario name is required"}), 400

    description = data.get("description", "")
    changes_input = data.get("changes", [])

    scenario = Scenario(
        user_id=user.id,
        name=name,
        description=description,
    )
    db.session.add(scenario)
    db.session.commit()

    for ch in changes_input:
        change_obj = ScenarioChange(
            scenario_id=scenario.id,
            change_type=ch.get("change_type", "one_off_expense"),
            title=ch.get("title", "Hypothetical Change"),
            amount=float(ch.get("amount", 0)),
            frequency=ch.get("frequency", "once"),
            start_month_offset=int(ch.get("start_month_offset", 0)),
        )
        db.session.add(change_obj)

    db.session.commit()

    # Compute simulation projection
    sim_result = run_twin_simulation(user.id, [c.to_dict() for c in scenario.changes], months=12)

    return jsonify({
        "message": "Scenario saved successfully",
        "scenario": scenario.to_dict(),
        "simulation": sim_result,
    }), 201

@twin_bp.route("/<int:scenario_id>", methods=["DELETE"])
@login_required
def delete_scenario(scenario_id):
    user = request.current_user
    scenario = Scenario.query.filter_by(id=scenario_id, user_id=user.id).first()
    if not scenario:
        return jsonify({"error": "Scenario not found"}), 404

    db.session.delete(scenario)
    db.session.commit()
    return jsonify({"message": "Scenario deleted successfully"}), 200

@twin_bp.route("/simulate", methods=["POST"])
@login_required
def simulate_changes():
    """
    Runs dynamic what-if simulation without saving or altering any real records.
    """
    user = request.current_user
    data = request.get_json() or {}
    changes = data.get("changes", [])
    months = int(data.get("months", 12))

    result = run_twin_simulation(user.id, changes, months=months)
    return jsonify(result), 200

@twin_bp.route("/purchase-impact", methods=["POST"])
@login_required
def evaluate_purchase():
    """
    Dedicated endpoint for the Purchase Impact Analyzer.
    """
    user = request.current_user
    data = request.get_json() or {}

    item_name = (data.get("item_name") or "Planned Purchase").strip()
    try:
        price = float(data.get("price", 0))
    except (ValueError, TypeError):
        return jsonify({"error": "Valid price is required"}), 400

    if price <= 0:
        return jsonify({"error": "Price must be positive"}), 400

    planned_date = data.get("planned_date") or ""
    impact = analyze_purchase_impact(user.id, item_name, price, planned_date)

    return jsonify(impact), 200

@twin_bp.route("/forecast", methods=["GET"])
@login_required
def get_forecast():
    """Expense Forecast: estimate upcoming expenses based on historical patterns"""
    user = request.current_user
    days = int(request.args.get("days", 30))
    from services.twin_service import forecast_upcoming_expenses
    res = forecast_upcoming_expenses(user.id, days=days)
    return jsonify(res), 200

@twin_bp.route("/emergency-fund", methods=["POST"])
@login_required
def simulate_emergency():
    """Emergency Fund Simulator"""
    user = request.current_user
    data = request.get_json() or {}
    target = data.get("target_amount")
    current = data.get("current_amount")
    tiers = data.get("tiers")
    from services.twin_service import simulate_emergency_fund
    res = simulate_emergency_fund(user.id, target_amount=target, current_amount=current, contribution_tiers=tiers)
    return jsonify(res), 200

@twin_bp.route("/income-change", methods=["POST"])
@login_required
def simulate_income():
    """Income Change Simulator"""
    user = request.current_user
    data = request.get_json() or {}
    try:
        delta = float(data.get("income_delta", 0.0))
    except Exception:
        return jsonify({"error": "Valid income delta required"}), 400

    label = data.get("change_label", "Income Adjustment")
    months = int(data.get("duration_months", 12))
    from services.twin_service import simulate_income_change
    res = simulate_income_change(user.id, income_delta=delta, duration_months=months, change_label=label)
    return jsonify(res), 200

@twin_bp.route("/life-events", methods=["GET"])
@login_required
def get_life_events():
    """List recorded life events"""
    user = request.current_user
    from models import LifeEvent
    events = LifeEvent.query.filter_by(user_id=user.id).order_by(LifeEvent.target_date.asc()).all()
    return jsonify({
        "life_events": [e.to_dict() for e in events],
        "count": len(events)
    }), 200

@twin_bp.route("/life-events", methods=["POST"])
@login_required
def create_life_event():
    """Create and simulate a life event"""
    user = request.current_user
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Event name is required"}), 400

    event_type = data.get("event_type", "custom")
    cost = float(data.get("cost", 0.0))
    target_date = data.get("target_date") or "2026-12-01"
    recurring_delta = float(data.get("recurring_cost_delta", 0.0))
    income_delta = float(data.get("income_delta", 0.0))
    notes = data.get("notes", "").strip()

    from models import LifeEvent
    ev = LifeEvent(
        user_id=user.id,
        name=name,
        event_type=event_type,
        cost=cost,
        target_date=target_date,
        recurring_cost_delta=recurring_delta,
        income_delta=income_delta,
        notes=notes
    )
    db.session.add(ev)
    db.session.commit()

    from services.twin_service import simulate_life_event_impact
    sim = simulate_life_event_impact(user.id, name, cost, target_date, recurring_delta, income_delta)

    return jsonify({
        "message": "Life event saved and simulated",
        "event": ev.to_dict(),
        "simulation": sim
    }), 201

@twin_bp.route("/life-events/<int:event_id>", methods=["DELETE"])
@login_required
def delete_life_event(event_id):
    user = request.current_user
    from models import LifeEvent
    ev = LifeEvent.query.filter_by(id=event_id, user_id=user.id).first()
    if not ev:
        return jsonify({"error": "Event not found"}), 404

    db.session.delete(ev)
    db.session.commit()
    return jsonify({"message": "Life event deleted"}), 200

