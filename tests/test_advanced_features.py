import io
import json
import pytest
from models import db, Transaction, Category, Purchase, Document, FinancialMemory

def test_expense_dna_and_money_leak_map(auth_client):
    client, token, user_id = auth_client
    headers = {"Authorization": f"Bearer {token}"}

    # Add small repetitive transactions to trigger money leak map
    for i in range(4):
        client.post("/api/transactions", headers=headers, json={
            "amount": 250.0,
            "type": "expense",
            "merchant": "Blue Tokai Coffee",
            "date": f"2026-09-0{i+1}",
            "payment_method": "UPI"
        })

    # Add weekend transactions
    client.post("/api/transactions", headers=headers, json={
        "amount": 1800.0,
        "type": "expense",
        "merchant": "Weekend Bistro",
        "date": "2026-09-05",  # Saturday
        "payment_method": "Card"
    })

    res = client.get("/api/expense-dna", headers=headers)
    assert res.status_code == 200
    data = res.get_json()
    assert data["has_data"] is True
    assert len(data["money_leaks"]) >= 1
    assert data["money_leaks"][0]["merchant"] == "Blue Tokai Coffee"
    assert data["money_leaks"][0]["transaction_count"] == 4
    assert data["weekday_weekend"]["weekend_total"] >= 1800.0

def test_time_machine_and_what_changed(auth_client):
    client, token, user_id = auth_client
    headers = {"Authorization": f"Bearer {token}"}

    # Add transactions in August
    client.post("/api/transactions", headers=headers, json={
        "amount": 50000.0,
        "type": "income",
        "merchant": "Employer Corp",
        "date": "2026-08-01"
    })
    client.post("/api/transactions", headers=headers, json={
        "amount": 12000.0,
        "type": "expense",
        "merchant": "Apartment Rent",
        "date": "2026-08-02"
    })

    # Add transactions in September
    client.post("/api/transactions", headers=headers, json={
        "amount": 50000.0,
        "type": "income",
        "merchant": "Employer Corp",
        "date": "2026-09-01"
    })
    client.post("/api/transactions", headers=headers, json={
        "amount": 16000.0,
        "type": "expense",
        "merchant": "Apartment Rent",
        "date": "2026-09-02"
    })

    # Test snapshot as of August
    snap_res = client.get("/api/time-machine/snapshot?date=2026-08", headers=headers)
    assert snap_res.status_code == 200
    snap_data = snap_res.get_json()
    assert snap_data["historical_balance"] == 38000.0
    assert "then_vs_now" in snap_data

    # Test What Changed? August vs September
    wc_res = client.get("/api/time-machine/what-changed?period_a=2026-08&period_b=2026-09", headers=headers)
    assert wc_res.status_code == 200
    wc_data = wc_res.get_json()
    assert wc_data["summary"]["expenses"]["diff"] == 4000.0
    assert "ai_explanation" in wc_data
    assert len(wc_data["ai_explanation"]) > 10

def test_purchases_and_warranties_lifecycle(auth_client):
    client, token, user_id = auth_client
    headers = {"Authorization": f"Bearer {token}"}

    # Create purchase with 24 months warranty
    res = client.post("/api/purchases", headers=headers, json={
        "product_name": "MacBook Pro M3",
        "merchant": "Apple Store",
        "price": 149900.0,
        "purchase_date": "2026-01-15",
        "warranty_months": 24,
        "notes": "AppleCare+ active"
    })
    assert res.status_code == 201
    purchase_data = res.get_json()["purchase"]
    p_id = purchase_data["id"]
    assert purchase_data["warranty_expiry"] is not None
    assert purchase_data["is_warranty_active"] is True

    # Add lifecycle event
    ev_res = client.post(f"/api/purchases/{p_id}/events", headers=headers, json={
        "event_type": "maintenance",
        "event_date": "2026-06-10",
        "cost": 0.0,
        "description": "Routine diagnostic and display cleaning",
        "service_provider": "Apple Genius Bar"
    })
    assert ev_res.status_code == 201
    assert ev_res.get_json()["event"]["event_type"] == "maintenance"

    # View purchase details with lifecycle events
    detail_res = client.get(f"/api/purchases/{p_id}", headers=headers)
    assert detail_res.status_code == 200
    assert len(detail_res.get_json()["events"]) == 2  # initial purchase + maintenance

def test_document_vault_upload_and_download(auth_client):
    client, token, user_id = auth_client
    headers = {"Authorization": f"Bearer {token}"}

    file_content = b"%PDF-1.4 Mock statement document content"
    data = {
        "file": (io.BytesIO(file_content), "statement_september.pdf"),
        "category": "statement",
        "notes": "HDFC Bank September statement"
    }

    res = client.post("/api/documents/upload", headers=headers, data=data, content_type="multipart/form-data")
    assert res.status_code == 201
    doc_id = res.get_json()["document"]["id"]

    # Download document
    dl_res = client.get(f"/api/documents/{doc_id}/download", headers=headers)
    assert dl_res.status_code == 200
    assert dl_res.data == file_content

    # Delete document
    del_res = client.delete(f"/api/documents/{doc_id}", headers=headers)
    assert del_res.status_code == 200

def test_shared_expenses_and_settlement(auth_client):
    client, token, user_id = auth_client
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create shared workspace
    ws_res = client.post("/api/shared-expenses/workspaces", headers=headers, json={
        "name": "Goa Trip 2026",
        "description": "Friends vacation expenses",
        "currency": "₹"
    })
    assert ws_res.status_code == 201
    ws = ws_res.get_json()["workspace"]
    ws_id = ws["id"]

    # 2. Invite member
    inv_res = client.post(f"/api/shared-expenses/workspaces/{ws_id}/invite", headers=headers, json={
        "email": "friend@ledger.finance",
        "display_name": "Rohan"
    })
    assert inv_res.status_code == 201
    friend_member_id = inv_res.get_json()["member"]["id"]
    owner_member_id = ws["members"][0]["id"]

    # 3. Add expense paid by owner split equally
    exp_res = client.post(f"/api/shared-expenses/workspaces/{ws_id}/expenses", headers=headers, json={
        "description": "Beach Villa Booking",
        "amount": 10000.0,
        "date": "2026-09-19",
        "paid_by_member_id": owner_member_id,
        "split_method": "equal"
    })
    assert exp_res.status_code == 201

    # 4. Check workspace balances: friend should owe 5000
    detail_res = client.get(f"/api/shared-expenses/workspaces/{ws_id}", headers=headers)
    assert detail_res.status_code == 200
    balances = {b["member_id"]: b["net_balance"] for b in detail_res.get_json()["balances"]}
    assert balances[owner_member_id] == 5000.0
    assert balances[friend_member_id] == -5000.0

    # 5. Settle expense: friend pays owner 5000
    set_res = client.post(f"/api/shared-expenses/workspaces/{ws_id}/settle", headers=headers, json={
        "from_member_id": friend_member_id,
        "to_member_id": owner_member_id,
        "amount": 5000.0,
        "date": "2026-09-19",
        "notes": "Settled via UPI"
    })
    assert set_res.status_code == 201

    # Check that balances are now settled (0.0)
    final_res = client.get(f"/api/shared-expenses/workspaces/{ws_id}", headers=headers)
    final_bals = {b["member_id"]: b["net_balance"] for b in final_res.get_json()["balances"]}
    assert final_bals[owner_member_id] == 0.0
    assert final_bals[friend_member_id] == 0.0

def test_financial_memories_and_story(auth_client):
    client, token, user_id = auth_client
    headers = {"Authorization": f"Bearer {token}"}

    # Add memory
    mem_res = client.post("/api/memories", headers=headers, json={
        "title": "Emergency Fund Goal",
        "content": "I plan to save ₹3 lakh emergency fund by next December."
    })
    assert mem_res.status_code == 201
    mem_id = mem_res.get_json()["memory"]["id"]

    # Verify memory list
    list_res = client.get("/api/memories", headers=headers)
    assert list_res.status_code == 200
    assert len(list_res.get_json()["memories"]) == 1

    # Query AI assistant asking about memory
    ai_res = client.post("/api/ai/ask", headers=headers, json={
        "query": "Show my saved financial memories"
    })
    assert ai_res.status_code == 200
    assert "Emergency Fund Goal" in ai_res.get_json()["response"]

    # Test Monthly Financial Story
    story_res = client.get("/api/monthly-story?month=2026-09", headers=headers)
    assert story_res.status_code == 200
    story_data = story_res.get_json()
    assert "headline" in story_data
    assert "narrative" in story_data

def test_simulators_and_forecast(auth_client):
    client, token, user_id = auth_client
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Expense Forecast
    fc_res = client.get("/api/scenarios/forecast?days=30", headers=headers)
    assert fc_res.status_code == 200
    assert "forecast_items" in fc_res.get_json()

    # 2. Emergency Fund Simulator
    ef_res = client.post("/api/scenarios/emergency-fund", headers=headers, json={
        "target_amount": 100000.0,
        "current_amount": 20000.0,
        "tiers": [2000.0, 5000.0, 8000.0]
    })
    assert ef_res.status_code == 200
    ef_data = ef_res.get_json()
    assert len(ef_data["scenarios"]) == 3
    assert ef_data["scenarios"][1]["months_to_target"] == 16.0  # 80000 / 5000 = 16

    # 3. Income Change Simulator
    ic_res = client.post("/api/scenarios/income-change", headers=headers, json={
        "income_delta": 10000.0,
        "duration_months": 12,
        "change_label": "Promotion Salary Increment"
    })
    assert ic_res.status_code == 200
    assert ic_res.get_json()["is_positive"] is True

    # 4. Life Event Simulator
    le_res = client.post("/api/scenarios/life-events", headers=headers, json={
        "name": "Higher Education Masters",
        "event_type": "education",
        "cost": 150000.0,
        "target_date": "2026-11-01",
        "recurring_cost_delta": 3000.0,
        "income_delta": 0.0
    })
    assert le_res.status_code == 201
    le_data = le_res.get_json()
    assert "actual_data" in le_data["simulation"]
    assert "user_estimates" in le_data["simulation"]
    assert "simulation_results" in le_data["simulation"]

def test_pdf_export(auth_client):
    client, token, user_id = auth_client
    headers = {"Authorization": f"Bearer {token}"}

    # Add a transaction to export
    client.post("/api/transactions", headers=headers, json={
        "amount": 1500.0,
        "type": "expense",
        "merchant": "Bookstore",
        "date": "2026-09-10"
    })

    res = client.get("/api/reports/export-pdf?type=monthly", headers=headers)
    assert res.status_code == 200
    assert res.content_type == "application/pdf"
    assert len(res.data) > 500  # valid non-empty PDF binary
