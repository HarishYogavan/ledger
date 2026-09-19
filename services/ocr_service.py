import os
import re
import json
import base64
from datetime import datetime, timezone
from PIL import Image
import requests
from config import Config
from models import db, Receipt, Category, User

def parse_receipt_image(file_path: str, user_id: int) -> dict:
    """
    Extracts structured receipt fields:
    merchant, date, total, tax, currency, category, line_items, confidence.
    Uses Gemini Vision if configured, with robust local OCR/pattern fallback.
    Always returns structured data for user confirmation.
    """
    user = db.session.get(User, user_id)
    currency_symbol = user.currency if user else "₹"

    extracted = {
        "merchant": "Store / Merchant",
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "total": 0.0,
        "tax": 0.0,
        "currency": currency_symbol,
        "category_id": None,
        "category_name": "Food & Dining",
        "line_items": [],
        "confidence": "uncertain",
        "raw_text": "",
        "needs_review": True,
    }

    # 1. Attempt Gemini Vision if API key provided
    if Config.GEMINI_API_KEY and os.path.exists(file_path):
        try:
            with open(file_path, "rb") as f:
                img_data = base64.b64encode(f.read()).decode("utf-8")

            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={Config.GEMINI_API_KEY}"
            prompt = (
                "Extract structured data from this receipt in JSON format with keys: "
                "'merchant' (string), 'date' (YYYY-MM-DD), 'total' (number), 'tax' (number), "
                "'currency' (symbol or code), 'category' (one of Dining, Groceries, Shopping, Healthcare, Utilities), "
                "'items' (array of {description, amount}). "
                "Only return valid JSON without markdown wrapping."
            )

            # Determine mime type
            mime = "image/jpeg"
            if file_path.lower().endswith(".png"):
                mime = "image/png"
            elif file_path.lower().endswith(".webp"):
                mime = "image/webp"

            payload = {
                "contents": [{
                    "parts": [
                        {"text": prompt},
                        {"inlineData": {"mimeType": mime, "data": img_data}}
                    ]
                }]
            }

            resp = requests.post(url, json=payload, timeout=15)
            if resp.status_code == 200:
                result_text = resp.json().get("candidates", [])[0]["content"]["parts"][0]["text"].strip()
                # Clean possible markdown ```json
                if "```" in result_text:
                    result_text = re.sub(r"```(?:json)?", "", result_text).strip()
                data = json.loads(result_text)

                extracted["merchant"] = data.get("merchant") or extracted["merchant"]
                extracted["date"] = data.get("date") or extracted["date"]
                extracted["total"] = float(data.get("total", 0.0))
                extracted["tax"] = float(data.get("tax", 0.0))
                extracted["currency"] = data.get("currency") or extracted["currency"]
                extracted["line_items"] = data.get("items", [])
                extracted["confidence"] = "high"
                extracted["raw_text"] = "Extracted via Gemini Vision"
                extracted["needs_review"] = False
                return extracted
        except Exception:
            pass

    # 2. Local fallback using Pillow & OCR if available, or heuristic filename/text parsing
    try:
        # Check if pytesseract works
        import pytesseract
        img = Image.open(file_path)
        text = pytesseract.image_to_string(img)
        extracted["raw_text"] = text

        # Parse amounts
        totals = re.findall(r'(?:total|amount|subtotal|balance|due|net)[\s:]*[\$₹€£]?\s*([0-9]+\.[0-9]{2})', text, re.IGNORECASE)
        if totals:
            extracted["total"] = float(totals[-1])
            extracted["confidence"] = "medium"

        # Parse date
        date_match = re.search(r'(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})', text)
        if date_match:
            try:
                raw_d = date_match.group(1).replace("/", "-")
                extracted["date"] = raw_d
            except Exception:
                pass

        # Parse merchant (first line of receipt text typically)
        lines = [l.strip() for l in text.split("\n") if len(l.strip()) > 3]
        if lines:
            extracted["merchant"] = lines[0][:40]

        # Parse tax
        tax_match = re.search(r'(?:tax|vat|gst)[\s:]*[\$₹€£]?\s*([0-9]+\.[0-9]{2})', text, re.IGNORECASE)
        if tax_match:
            extracted["tax"] = float(tax_match.group(1))

    except Exception:
        # If pytesseract binary is not installed on system, use intelligent image metadata heuristics
        base_name = os.path.basename(file_path)
        extracted["merchant"] = re.sub(r'[_0-9\-\.]', ' ', os.path.splitext(base_name)[0]).title().strip() or "Receipt Merchant"
        extracted["raw_text"] = f"Receipt file uploaded: {base_name}. Please verify total and merchant."
        extracted["confidence"] = "uncertain"

    # Match category if user has categories
    if user_id:
        cats = Category.query.filter_by(user_id=user_id, type="expense").all()
        for c in cats:
            if "dining" in c.name.lower() or "food" in c.name.lower():
                extracted["category_id"] = c.id
                extracted["category_name"] = c.name
                break

    return extracted
