import os
import uuid
from flask import Blueprint, request, jsonify, send_file, current_app
from werkzeug.utils import secure_filename
from models import db, Document
from routes import login_required

documents_bp = Blueprint("documents", __name__, url_prefix="/api/documents")

ALLOWED_DOC_EXTENSIONS = {"pdf", "png", "jpg", "jpeg", "webp", "txt", "csv", "xlsx", "docx"}

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_DOC_EXTENSIONS

@documents_bp.route("", methods=["GET"])
@login_required
def list_documents():
    user = request.current_user
    category = request.args.get("category")
    search_q = request.args.get("q", "").strip().lower()

    query = Document.query.filter_by(user_id=user.id)
    if category and category != "all":
        query = query.filter_by(category=category)

    docs = query.order_by(Document.created_at.desc()).all()
    if search_q:
        docs = [d for d in docs if search_q in d.original_name.lower() or search_q in (d.notes or "").lower()]

    return jsonify({
        "documents": [d.to_dict() for d in docs],
        "count": len(docs),
    }), 200

@documents_bp.route("/upload", methods=["POST"])
@login_required
def upload_document():
    user = request.current_user
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": f"File type not permitted. Allowed: {', '.join(sorted(ALLOWED_DOC_EXTENSIONS))}"}), 400

    original_name = secure_filename(file.filename) or "document"
    ext = original_name.rsplit(".", 1)[1].lower() if "." in original_name else "bin"
    unique_filename = f"{uuid.uuid4().hex}_{original_name}"

    user_docs_dir = os.path.join(current_app.config["UPLOAD_FOLDER"], "documents", str(user.id))
    os.makedirs(user_docs_dir, exist_ok=True)
    full_path = os.path.join(user_docs_dir, unique_filename)

    file.save(full_path)
    file_size = os.path.getsize(full_path)

    category = request.form.get("category", "other").strip()
    notes = request.form.get("notes", "").strip()
    transaction_id = request.form.get("transaction_id") or None
    purchase_id = request.form.get("purchase_id") or None

    try:
        tx_id_int = int(transaction_id) if transaction_id else None
    except Exception:
        tx_id_int = None

    try:
        purchase_id_int = int(purchase_id) if purchase_id else None
    except Exception:
        purchase_id_int = None

    mime_map = {
        "pdf": "application/pdf",
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "webp": "image/webp",
        "csv": "text/csv",
        "txt": "text/plain",
    }
    mime_type = mime_map.get(ext, file.content_type or "application/octet-stream")

    doc = Document(
        user_id=user.id,
        filename=unique_filename,
        original_name=original_name,
        file_path=full_path,
        file_size=file_size,
        mime_type=mime_type,
        category=category,
        notes=notes,
        transaction_id=tx_id_int,
        purchase_id=purchase_id_int
    )
    db.session.add(doc)
    db.session.commit()

    return jsonify({"message": "Document uploaded successfully", "document": doc.to_dict()}), 201

@documents_bp.route("/<int:doc_id>/download", methods=["GET"])
@login_required
def download_document(doc_id):
    user = request.current_user
    doc = Document.query.filter_by(id=doc_id, user_id=user.id).first()
    if not doc or not os.path.exists(doc.file_path):
        return jsonify({"error": "Document not found or access denied"}), 404

    return send_file(
        doc.file_path,
        mimetype=doc.mime_type,
        as_attachment=True,
        download_name=doc.original_name
    )

@documents_bp.route("/<int:doc_id>", methods=["DELETE"])
@login_required
def delete_document(doc_id):
    user = request.current_user
    doc = Document.query.filter_by(id=doc_id, user_id=user.id).first()
    if not doc:
        return jsonify({"error": "Document not found or access denied"}), 404

    if os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except Exception:
            pass

    db.session.delete(doc)
    db.session.commit()
    return jsonify({"message": "Document removed successfully"}), 200
