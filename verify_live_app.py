import requests

BASE_URL = "http://127.0.0.1:5000"

def test_live_app():
    s = requests.Session()
    print("1. Testing index and static assets...")
    r = s.get(f"{BASE_URL}/")
    assert r.status_code == 200, f"Index failed: {r.status_code}"
    assert "Ledger" in r.text
    print("  Index OK")

    for asset in [
        "/static/icons/logo-192.png",
        "/static/icons/logo-32.png",
        "/static/css/ledger.css",
        "/static/css/components.css",
        "/static/js/api.js",
        "/static/js/app.js",
        "/static/js/views/budgets.js",
        "/static/js/views/purchases.js",
        "/static/js/views/documents.js",
        "/static/js/views/shared_expenses.js",
        "/static/js/views/analytics.js",
        "/static/js/views/calendar.js",
        "/static/js/views/financial_twin.js",
        "/static/js/views/ai_assistant.js",
        "/static/js/views/reports.js",
        "/static/js/views/settings.js"
    ]:
        ar = s.get(f"{BASE_URL}{asset}")
        assert ar.status_code == 200, f"Failed asset {asset}: {ar.status_code}"
    print("  All 16 static assets loaded successfully!")

    print("\n2. Testing User Registration & Authentication...")
    import uuid
    dynamic_email = f"verifier_{uuid.uuid4().hex[:8]}@example.com"
    reg_data = {
        "email": dynamic_email,
        "password": "SecurePassword123!",
        "full_name": "Live Verifier",
        "currency": "₹"
    }
    r = s.post(f"{BASE_URL}/api/auth/register", json=reg_data)
    if r.status_code in [400, 409]:
        r = s.post(f"{BASE_URL}/api/auth/login", json={"email": reg_data["email"], "password": reg_data["password"]})
    assert r.status_code in [200, 201], f"Auth failed: {r.status_code} {r.text}"
    token = r.json().get("token")
    headers = {"Authorization": f"Bearer {token}"}
    print("  Auth OK, token obtained.")

    print("\n3. Testing Transactions & NLP Quick Add...")
    r = s.post(f"{BASE_URL}/api/transactions/quick-add/nlp", headers=headers, json={"text": "Spent 420 at Blue Tokai for coffee on 2026-09-18"})
    assert r.status_code == 200, f"NLP parse failed: {r.text}"
    parsed = r.json().get("parsed", {})
    assert parsed.get("amount") == 420.0
    print(f"  NLP Parsed: {parsed.get('merchant')} - {parsed.get('amount')}")

    r = s.post(f"{BASE_URL}/api/transactions", headers=headers, json={
        "type": "expense",
        "amount": 420.0,
        "date": "2026-09-18",
        "merchant": "Blue Tokai",
        "category_id": 1,
        "notes": "Espresso and croissant",
        "location_name": "Bangalore"
    })
    assert r.status_code == 201, f"Create transaction failed: {r.text}"
    tx_id = r.json()["transaction"]["id"]
    print(f"  Created transaction ID: {tx_id}")

    print("\n4. Testing Core & Advanced APIs:")
    endpoints = [
        ("/api/dashboard/overview", "Overview"),
        ("/api/transactions", "Transactions List"),
        ("/api/categories", "Categories"),
        ("/api/budgets", "Budgets"),
        ("/api/goals", "Goals"),
        ("/api/recurring", "Recurring Payments"),
        ("/api/bills", "Bills"),
        ("/api/analytics?timeframe=monthly", "Analytics"),
        ("/api/expense-dna", "Expense DNA & Money Leak Map"),
        ("/api/time-machine/snapshot?date=2026-09-18", "Time Machine Snapshot"),
        ("/api/time-machine/what-changed?from_date=2026-08-18&to_date=2026-09-18", "What Changed Delta"),
        ("/api/purchases", "Purchases Vault"),
        ("/api/documents", "Document Vault"),
        ("/api/shared-expenses/workspaces", "Shared Workspaces"),
        ("/api/memories", "Financial Memories"),
        ("/api/locations/transactions", "Location Transactions"),
        ("/api/monthly-story", "Monthly Financial Story"),
        ("/api/scenarios", "Financial Twin Scenarios"),
        ("/api/scenarios/forecast?months=6", "Forecast Sim"),
        ("/api/net-worth", "Net Worth"),
        ("/api/health", "Financial Health Radar"),
        ("/api/reports/export-pdf", "Branded PDF Export"),
        ("/api/search?q=Blue", "Global Universal Search"),
    ]

    post_endpoints = [
        ("/api/scenarios/emergency-fund", "Emergency Fund Sim", {"monthly_expenses": 25000, "current_savings": 50000, "target_months": 6}),
        ("/api/scenarios/income-change", "Income Change Sim", {"change_type": "increase_percent", "value": 15}),
        ("/api/scenarios/life-events", "Life Events Sim", {"name": "New Baby", "one_off_cost": 100000, "ongoing_monthly_cost": 8000}),
    ]

    for ep, name in endpoints:
        resp = s.get(f"{BASE_URL}{ep}", headers=headers)
        assert resp.status_code == 200, f"Failed {name} ({ep}): {resp.status_code} {resp.text}"
        print(f"  [OK] {name} ({ep}) -> 200 OK")

    for ep, name, payload in post_endpoints:
        resp = s.post(f"{BASE_URL}{ep}", headers=headers, json=payload)
        assert resp.status_code in [200, 201], f"Failed {name} ({ep}): {resp.status_code} {resp.text}"
        print(f"  [OK] {name} ({ep}) -> {resp.status_code} OK")

    print("\n=======================================================")
    print("  ALL 26 LIVE ENDPOINTS & ALL 16 ASSETS TESTED 100% OK! ")
    print("=======================================================")

if __name__ == "__main__":
    test_live_app()
