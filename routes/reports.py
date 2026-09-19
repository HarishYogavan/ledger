import io
from flask import Blueprint, request, jsonify, Response
from services.report_service import build_report_data, export_report_csv
from routes import login_required

reports_bp = Blueprint("reports", __name__, url_prefix="/api/reports")

@reports_bp.route("/data", methods=["GET"])
@login_required
def get_report():
    user = request.current_user
    report_type = request.args.get("type", "monthly")
    try:
        year = int(request.args.get("year", 0)) or None
    except Exception:
        year = None
    try:
        month = int(request.args.get("month", 0)) or None
    except Exception:
        month = None

    data = build_report_data(user.id, report_type, year, month)
    return jsonify(data), 200

@reports_bp.route("/export-csv", methods=["GET"])
@login_required
def download_csv():
    user = request.current_user
    report_type = request.args.get("type", "monthly")
    try:
        year = int(request.args.get("year", 0)) or None
    except Exception:
        year = None
    try:
        month = int(request.args.get("month", 0)) or None
    except Exception:
        month = None

    csv_buf = export_report_csv(user.id, report_type, year, month)
    filename = f"ledger_{report_type}_report_{user.id}.csv"

    return Response(
        csv_buf.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@reports_bp.route("/export-pdf", methods=["GET"])
@login_required
def download_pdf():
    user = request.current_user
    report_type = request.args.get("type", "monthly")
    try:
        year = int(request.args.get("year", 0)) or None
    except Exception:
        year = None
    try:
        month = int(request.args.get("month", 0)) or None
    except Exception:
        month = None

    from services.report_service import export_report_pdf
    pdf_buf = export_report_pdf(user.id, report_type, year, month)
    filename = f"ledger_{report_type}_report_{user.id}.pdf"

    return Response(
        pdf_buf.getvalue(),
        mimetype="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

