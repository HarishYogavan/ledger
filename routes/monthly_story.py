from flask import Blueprint, request, jsonify
from services.ai_service import generate_monthly_financial_story
from routes import login_required

monthly_story_bp = Blueprint("monthly_story", __name__, url_prefix="/api/monthly-story")

@monthly_story_bp.route("", methods=["GET"])
@login_required
def get_story():
    user = request.current_user
    month_str = request.args.get("month")  # YYYY-MM
    story = generate_monthly_financial_story(user.id, month_str)
    return jsonify(story), 200
