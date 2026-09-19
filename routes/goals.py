from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from models import db, Goal
from routes import login_required

goals_bp = Blueprint("goals", __name__, url_prefix="/api/goals")

@goals_bp.route("", methods=["GET"])
@login_required
def get_goals():
    user = request.current_user
    goals = Goal.query.filter_by(user_id=user.id).order_by(Goal.created_at.desc()).all()
    return jsonify({"goals": [g.to_dict() for g in goals]}), 200

@goals_bp.route("", methods=["POST"])
@login_required
def create_goal():
    user = request.current_user
    data = request.get_json() or {}

    name = (data.get("name") or "").strip()
    try:
        target_amount = float(data.get("target_amount", 0))
    except (ValueError, TypeError):
        return jsonify({"error": "Target amount must be a number"}), 400

    target_date = data.get("target_date")
    if not name or target_amount <= 0 or not target_date:
        return jsonify({"error": "Goal name, target amount, and target date are required"}), 400

    current_amount = float(data.get("current_amount") or 0.0)
    monthly_contrib = float(data.get("monthly_contribution") or 0.0)
    category_tag = data.get("category_tag") or "General"

    goal = Goal(
        user_id=user.id,
        name=name,
        target_amount=target_amount,
        current_amount=current_amount,
        target_date=target_date,
        monthly_contribution=monthly_contrib,
        category_tag=category_tag,
        status="active"
    )
    db.session.add(goal)
    db.session.commit()

    return jsonify({"message": "Goal created successfully", "goal": goal.to_dict()}), 201

@goals_bp.route("/<int:goal_id>", methods=["PUT"])
@login_required
def update_goal(goal_id):
    user = request.current_user
    goal = Goal.query.filter_by(id=goal_id, user_id=user.id).first()
    if not goal:
        return jsonify({"error": "Goal not found"}), 404

    data = request.get_json() or {}

    if "name" in data and data["name"].strip():
        goal.name = data["name"].strip()
    if "target_amount" in data:
        goal.target_amount = float(data["target_amount"])
    if "current_amount" in data:
        goal.current_amount = float(data["current_amount"])
    if "target_date" in data:
        goal.target_date = data["target_date"]
    if "monthly_contribution" in data:
        goal.monthly_contribution = float(data["monthly_contribution"])
    if "status" in data and data["status"] in ["active", "paused", "completed"]:
        goal.status = data["status"]
    if "category_tag" in data:
        goal.category_tag = data["category_tag"]

    # Auto complete if current >= target
    if goal.current_amount >= goal.target_amount and goal.target_amount > 0:
        goal.status = "completed"

    db.session.commit()
    return jsonify({"message": "Goal updated successfully", "goal": goal.to_dict()}), 200

@goals_bp.route("/<int:goal_id>/deposit", methods=["POST"])
@login_required
def add_deposit_to_goal(goal_id):
    user = request.current_user
    goal = Goal.query.filter_by(id=goal_id, user_id=user.id).first()
    if not goal:
        return jsonify({"error": "Goal not found"}), 404

    data = request.get_json() or {}
    try:
        amount = float(data.get("amount", 0))
    except Exception:
        return jsonify({"error": "Valid deposit amount required"}), 400

    if amount <= 0:
        return jsonify({"error": "Deposit amount must be positive"}), 400

    goal.current_amount += amount
    if goal.current_amount >= goal.target_amount:
        goal.status = "completed"

    db.session.commit()
    return jsonify({"message": f"Added deposit to goal '{goal.name}'", "goal": goal.to_dict()}), 200

@goals_bp.route("/<int:goal_id>", methods=["DELETE"])
@login_required
def delete_goal(goal_id):
    user = request.current_user
    goal = Goal.query.filter_by(id=goal_id, user_id=user.id).first()
    if not goal:
        return jsonify({"error": "Goal not found"}), 404

    db.session.delete(goal)
    db.session.commit()
    return jsonify({"message": "Goal deleted successfully"}), 200
