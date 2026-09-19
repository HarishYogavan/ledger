import uuid
from collections import defaultdict
from flask import Blueprint, request, jsonify
from models import db, SharedWorkspace, WorkspaceMember, SharedExpense, SharedExpenseSplit, Settlement
from routes import login_required

shared_expenses_bp = Blueprint("shared_expenses", __name__, url_prefix="/api/shared-expenses")

@shared_expenses_bp.route("/workspaces", methods=["GET"])
@login_required
def list_workspaces():
    user = request.current_user
    # Find workspaces where user is owner or a member
    member_workspaces = WorkspaceMember.query.filter_by(user_id=user.id).all()
    workspace_ids = {m.workspace_id for m in member_workspaces}
    owner_workspaces = SharedWorkspace.query.filter_by(created_by_user_id=user.id).all()
    for w in owner_workspaces:
        workspace_ids.add(w.id)

    workspaces = SharedWorkspace.query.filter(SharedWorkspace.id.in_(list(workspace_ids))).order_by(SharedWorkspace.created_at.desc()).all() if workspace_ids else []

    return jsonify({
        "workspaces": [w.to_dict() for w in workspaces],
        "count": len(workspaces),
    }), 200

@shared_expenses_bp.route("/workspaces", methods=["POST"])
@login_required
def create_workspace():
    user = request.current_user
    data = request.get_json() or {}

    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "Workspace name is required"}), 400

    description = data.get("description", "").strip()
    currency = data.get("currency") or user.currency or "₹"
    invite_code = uuid.uuid4().hex[:8].upper()

    ws = SharedWorkspace(
        name=name,
        description=description,
        currency=currency,
        created_by_user_id=user.id,
        invite_code=invite_code
    )
    db.session.add(ws)
    db.session.flush()

    # Automatically add owner as first member
    owner_member = WorkspaceMember(
        workspace_id=ws.id,
        user_id=user.id,
        email=user.email,
        display_name=user.full_name,
        role="owner"
    )
    db.session.add(owner_member)
    db.session.commit()

    return jsonify({"message": "Workspace created successfully", "workspace": ws.to_dict()}), 201

@shared_expenses_bp.route("/workspaces/<int:workspace_id>", methods=["GET"])
@login_required
def get_workspace_details(workspace_id):
    user = request.current_user
    ws = db.session.get(SharedWorkspace, workspace_id)
    if not ws:
        return jsonify({"error": "Workspace not found"}), 404

    # Authorization check: user must be owner or member
    is_member = any(m.user_id == user.id or m.email == user.email for m in ws.members)
    if ws.created_by_user_id != user.id and not is_member:
        return jsonify({"error": "Access denied"}), 403

    expenses = ws.expenses.order_by(SharedExpense.date.desc()).all()
    settlements = ws.settlements.order_by(Settlement.date.desc()).all()

    # Calculate net balance matrix (who paid what vs who owes what)
    member_balances = defaultdict(float)  # positive: is owed, negative: owes

    for exp in expenses:
        paid_by_id = exp.paid_by_member_id
        member_balances[paid_by_id] += exp.amount
        for sp in exp.splits:
            if not sp.is_settled:
                member_balances[sp.member_id] -= sp.split_amount

    # Account for completed settlements
    for st in settlements:
        if st.status == "completed":
            member_balances[st.from_member_id] += st.amount
            member_balances[st.to_member_id] -= st.amount

    balance_summary = []
    for m in ws.members:
        bal = round(member_balances[m.id], 2)
        balance_summary.append({
            "member_id": m.id,
            "display_name": m.display_name,
            "email": m.email,
            "net_balance": bal,
            "status": "Gets Back" if bal > 0 else ("Owes" if bal < 0 else "Settled"),
        })

    return jsonify({
        "workspace": ws.to_dict(),
        "balances": balance_summary,
        "expenses": [e.to_dict() for e in expenses],
        "settlements": [s.to_dict() for s in settlements],
    }), 200

@shared_expenses_bp.route("/workspaces/<int:workspace_id>/invite", methods=["POST"])
@login_required
def invite_member(workspace_id):
    user = request.current_user
    ws = db.session.get(SharedWorkspace, workspace_id)
    if not ws:
        return jsonify({"error": "Workspace not found"}), 404

    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    name = data.get("display_name", "").strip() or email.split("@")[0]

    if not email:
        return jsonify({"error": "Member email is required"}), 400

    # Check if already a member
    existing = WorkspaceMember.query.filter_by(workspace_id=ws.id, email=email).first()
    if existing:
        return jsonify({"error": f"{email} is already a member of this workspace"}), 400

    member = WorkspaceMember(
        workspace_id=ws.id,
        email=email,
        display_name=name,
        role="member"
    )
    db.session.add(member)
    db.session.commit()

    return jsonify({"message": f"{name} added to workspace", "member": member.to_dict()}), 201

@shared_expenses_bp.route("/workspaces/<int:workspace_id>/expenses", methods=["POST"])
@login_required
def add_shared_expense(workspace_id):
    user = request.current_user
    ws = db.session.get(SharedWorkspace, workspace_id)
    if not ws:
        return jsonify({"error": "Workspace not found"}), 404

    data = request.get_json() or {}
    description = data.get("description", "").strip()
    try:
        amount = float(data.get("amount", 0.0))
    except Exception:
        return jsonify({"error": "Valid amount is required"}), 400

    if not description or amount <= 0:
        return jsonify({"error": "Valid description and amount are required"}), 400

    date = data.get("date") or "2026-09-19"
    category = data.get("category", "General")
    paid_by_member_id = data.get("paid_by_member_id")
    split_method = data.get("split_method", "equal")  # 'equal', 'exact', 'percentage'

    if not paid_by_member_id:
        # Default to the current logged in user's member ID
        me_member = WorkspaceMember.query.filter_by(workspace_id=ws.id, user_id=user.id).first()
        paid_by_member_id = me_member.id if me_member else ws.members[0].id

    exp = SharedExpense(
        workspace_id=ws.id,
        paid_by_member_id=paid_by_member_id,
        amount=amount,
        description=description,
        date=date,
        category=category,
        split_method=split_method
    )
    db.session.add(exp)
    db.session.flush()

    members = ws.members
    custom_splits = data.get("splits", [])  # list of {member_id, amount}

    if split_method == "equal" or not custom_splits:
        # Split equally among all workspace members
        split_share = round(amount / len(members), 2)
        accumulated = 0.0
        for i, m in enumerate(members):
            # Final member gets rounding remainder
            this_share = round(amount - accumulated, 2) if i == len(members) - 1 else split_share
            accumulated += this_share
            db.session.add(SharedExpenseSplit(
                shared_expense_id=exp.id,
                member_id=m.id,
                split_amount=this_share,
                is_settled=False
            ))
    else:
        for s in custom_splits:
            m_id = s.get("member_id")
            s_amt = float(s.get("amount", 0.0))
            db.session.add(SharedExpenseSplit(
                shared_expense_id=exp.id,
                member_id=m_id,
                split_amount=s_amt,
                is_settled=False
            ))

    db.session.commit()
    return jsonify({"message": "Shared expense logged successfully", "expense": exp.to_dict()}), 201

@shared_expenses_bp.route("/workspaces/<int:workspace_id>/settle", methods=["POST"])
@login_required
def record_settlement(workspace_id):
    user = request.current_user
    ws = db.session.get(SharedWorkspace, workspace_id)
    if not ws:
        return jsonify({"error": "Workspace not found"}), 404

    data = request.get_json() or {}
    from_member_id = data.get("from_member_id")
    to_member_id = data.get("to_member_id")
    amount = float(data.get("amount", 0.0))
    date = data.get("date") or "2026-09-19"
    notes = data.get("notes", "").strip()

    if not from_member_id or not to_member_id or amount <= 0:
        return jsonify({"error": "Invalid settlement parameters"}), 400

    settlement = Settlement(
        workspace_id=ws.id,
        from_member_id=from_member_id,
        to_member_id=to_member_id,
        amount=amount,
        date=date,
        notes=notes,
        status="completed"
    )
    db.session.add(settlement)
    db.session.commit()

    return jsonify({"message": "Settlement recorded successfully", "settlement": settlement.to_dict()}), 201
