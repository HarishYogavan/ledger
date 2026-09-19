from flask import Blueprint, request, jsonify
from services.expense_dna_service import analyze_expense_dna
from routes import login_required

expense_dna_bp = Blueprint("expense_dna", __name__, url_prefix="/api/expense-dna")

@expense_dna_bp.route("", methods=["GET"])
@login_required
def get_expense_dna():
    user = request.current_user
    res = analyze_expense_dna(user.id)
    return jsonify(res), 200
