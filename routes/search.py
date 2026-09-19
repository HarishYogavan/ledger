from flask import Blueprint, request, jsonify
from models import db, Transaction, Category, Goal, Bill, RecurringPayment, Purchase, Document, FinancialMemory, Scenario
from routes import login_required

search_bp = Blueprint("search", __name__, url_prefix="/api/search")

@search_bp.route("", methods=["GET"])
@login_required
def global_search():
    user = request.current_user
    q = (request.args.get("q") or "").strip()
    if not q:
        return jsonify({
            "query": "",
            "transactions": [],
            "categories": [],
            "goals": [],
            "bills": [],
            "recurring_payments": [],
            "purchases": [],
            "documents": [],
            "memories": [],
            "scenarios": [],
            "total_results": 0,
        }), 200

    pattern = f"%{q}%"

    # Search transactions
    txs = Transaction.query.filter(
        Transaction.user_id == user.id,
        (Transaction.merchant.ilike(pattern)) |
        (Transaction.notes.ilike(pattern)) |
        (Transaction.payment_method.ilike(pattern)) |
        (Transaction.tags.ilike(pattern))
    ).order_by(Transaction.date.desc()).limit(15).all()

    # Search categories
    cats = Category.query.filter(
        (Category.user_id == user.id) | (Category.user_id == None),
        Category.name.ilike(pattern)
    ).limit(10).all()

    # Search goals
    goals = Goal.query.filter(
        Goal.user_id == user.id,
        (Goal.name.ilike(pattern)) | (Goal.category_tag.ilike(pattern))
    ).limit(10).all()

    # Search bills
    bills = Bill.query.filter(
        Bill.user_id == user.id,
        Bill.title.ilike(pattern)
    ).limit(10).all()

    # Search recurring
    recurring = RecurringPayment.query.filter(
        RecurringPayment.user_id == user.id,
        RecurringPayment.name.ilike(pattern)
    ).limit(10).all()

    # Search purchases
    purchases = Purchase.query.filter(
        Purchase.user_id == user.id,
        (Purchase.product_name.ilike(pattern)) |
        (Purchase.merchant.ilike(pattern)) |
        (Purchase.notes.ilike(pattern))
    ).limit(10).all()

    # Search documents
    documents = Document.query.filter(
        Document.user_id == user.id,
        (Document.original_name.ilike(pattern)) |
        (Document.notes.ilike(pattern))
    ).limit(10).all()

    # Search financial memories
    memories = FinancialMemory.query.filter(
        FinancialMemory.user_id == user.id,
        (FinancialMemory.title.ilike(pattern)) |
        (FinancialMemory.content.ilike(pattern))
    ).limit(10).all()

    # Search scenarios
    scenarios = Scenario.query.filter(
        Scenario.user_id == user.id,
        (Scenario.name.ilike(pattern)) |
        (Scenario.description.ilike(pattern))
    ).limit(10).all()

    total = (len(txs) + len(cats) + len(goals) + len(bills) +
             len(recurring) + len(purchases) + len(documents) +
             len(memories) + len(scenarios))

    return jsonify({
        "query": q,
        "transactions": [t.to_dict() for t in txs],
        "categories": [c.to_dict() for c in cats],
        "goals": [g.to_dict() for g in goals],
        "bills": [b.to_dict() for b in bills],
        "recurring_payments": [r.to_dict() for r in recurring],
        "purchases": [p.to_dict() for p in purchases],
        "documents": [d.to_dict() for d in documents],
        "memories": [m.to_dict() for m in memories],
        "scenarios": [s.to_dict() for s in scenarios],
        "total_results": total,
    }), 200

