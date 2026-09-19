import os
import json
from datetime import datetime, timezone
from werkzeug.utils import secure_filename
from flask import Blueprint, request, jsonify, current_app
from models import db, AIConversation, Receipt
from services.ai_service import ask_ledger_assistant
from services.ocr_service import parse_receipt_image
from routes import login_required

ai_bp = Blueprint("ai", __name__, url_prefix="/api/ai")

@ai_bp.route("/ask", methods=["POST"])
@login_required
def ask_ai():
    user = request.current_user
    data = request.get_json() or {}
    query = (data.get("query") or "").strip()

    if not query:
        return jsonify({"error": "Query cannot be empty"}), 400

    # Save user message
    user_msg = AIConversation(user_id=user.id, role="user", message=query)
    db.session.add(user_msg)

    # Generate grounded response
    result = ask_ledger_assistant(query, user.id)
    response_text = result.get("response", "I could not process your query.")

    assistant_msg = AIConversation(
        user_id=user.id,
        role="assistant",
        message=response_text,
        context_summary=result.get("source", "ledger_engine")
    )
    db.session.add(assistant_msg)
    db.session.commit()

    return jsonify({
        "response": response_text,
        "source": result.get("source", "ledger_engine"),
        "created_at": assistant_msg.created_at.isoformat(),
    }), 200

@ai_bp.route("/conversations", methods=["GET"])
@login_required
def get_conversation_history():
    user = request.current_user
    msgs = AIConversation.query.filter_by(user_id=user.id).order_by(AIConversation.created_at.asc()).limit(50).all()
    return jsonify({"messages": [m.to_dict() for m in msgs]}), 200

@ai_bp.route("/conversations", methods=["DELETE"])
@login_required
def clear_conversations():
    user = request.current_user
    AIConversation.query.filter_by(user_id=user.id).delete()
    db.session.commit()
    return jsonify({"message": "Conversation history cleared"}), 200

@ai_bp.route("/receipt-scan", methods=["POST"])
@login_required
def upload_and_scan_receipt():
    user = request.current_user

    if "receipt" not in request.files:
        return jsonify({"error": "Receipt file is required"}), 400

    file = request.files["receipt"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    filename = secure_filename(file.filename)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    unique_filename = f"{user.id}_{timestamp}_{filename}"

    upload_folder = current_app.config["UPLOAD_FOLDER"]
    os.makedirs(upload_folder, exist_ok=True)
    file_path = os.path.join(upload_folder, unique_filename)
    file.save(file_path)

    # Extract data via OCR service
    parsed = parse_receipt_image(file_path, user.id)

    # Save receipt record
    receipt = Receipt(
        user_id=user.id,
        filename=unique_filename,
        file_path=file_path,
        ocr_raw_text=parsed.get("raw_text", ""),
        parsed_data=json.dumps(parsed),
        status="pending"
    )
    db.session.add(receipt)
    db.session.commit()

    parsed["receipt_id"] = receipt.id
    return jsonify({
        "message": "Receipt processed. Please confirm the extracted details before saving.",
        "extracted": parsed,
        "receipt_id": receipt.id,
    }), 200
