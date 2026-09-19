from flask import Blueprint, request, jsonify
from models import db, FinancialMemory
from routes import login_required

memories_bp = Blueprint("memories", __name__, url_prefix="/api/memories")

@memories_bp.route("", methods=["GET"])
@login_required
def list_memories():
    user = request.current_user
    q = request.args.get("q", "").strip().lower()

    query = FinancialMemory.query.filter_by(user_id=user.id)
    memories = query.order_by(FinancialMemory.created_at.desc()).all()

    if q:
        memories = [m for m in memories if q in m.title.lower() or q in m.content.lower()]

    return jsonify({
        "memories": [m.to_dict() for m in memories],
        "count": len(memories),
    }), 200

@memories_bp.route("", methods=["POST"])
@login_required
def create_memory():
    user = request.current_user
    data = request.get_json() or {}

    title = data.get("title", "").strip()
    content = data.get("content", "").strip()

    if not title or not content:
        return jsonify({"error": "Title and content are required for financial memory"}), 400

    memory = FinancialMemory(
        user_id=user.id,
        title=title,
        content=content,
        is_active=True
    )
    db.session.add(memory)
    db.session.commit()

    return jsonify({"message": "Financial memory saved", "memory": memory.to_dict()}), 201

@memories_bp.route("/<int:memory_id>", methods=["PUT"])
@login_required
def update_memory(memory_id):
    user = request.current_user
    memory = FinancialMemory.query.filter_by(id=memory_id, user_id=user.id).first()
    if not memory:
        return jsonify({"error": "Memory not found"}), 404

    data = request.get_json() or {}
    if "title" in data:
        memory.title = data["title"].strip()
    if "content" in data:
        memory.content = data["content"].strip()
    if "is_active" in data:
        memory.is_active = bool(data["is_active"])

    db.session.commit()
    return jsonify({"message": "Financial memory updated", "memory": memory.to_dict()}), 200

@memories_bp.route("/<int:memory_id>", methods=["DELETE"])
@login_required
def delete_memory(memory_id):
    user = request.current_user
    memory = FinancialMemory.query.filter_by(id=memory_id, user_id=user.id).first()
    if not memory:
        return jsonify({"error": "Memory not found"}), 404

    db.session.delete(memory)
    db.session.commit()
    return jsonify({"message": "Financial memory removed"}), 200
