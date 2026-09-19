def test_transaction_lifecycle(auth_client):
    client, token, user_id = auth_client
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch default categories
    cats_resp = client.get("/api/categories", headers=headers)
    assert cats_resp.status_code == 200
    cats = cats_resp.get_json()["categories"]
    assert len(cats) > 0
    dining_cat = next((c for c in cats if "Dining" in c["name"]), cats[0])

    # 1. Create income transaction
    inc_resp = client.post("/api/transactions", headers=headers, json={
        "type": "income",
        "amount": 50000.0,
        "merchant": "Tech Corp Salary",
        "date": "2026-09-01",
        "payment_method": "Bank Transfer",
        "notes": "September Salary"
    })
    assert inc_resp.status_code == 201
    inc_id = inc_resp.get_json()["transaction"]["id"]

    # 2. Create expense transaction
    exp_resp = client.post("/api/transactions", headers=headers, json={
        "type": "expense",
        "amount": 1200.0,
        "category_id": dining_cat["id"],
        "merchant": "Olive Bistro",
        "date": "2026-09-05",
        "payment_method": "Card",
        "tags": ["weekend", "dining"]
    })
    assert exp_resp.status_code == 201
    exp_id = exp_resp.get_json()["transaction"]["id"]

    # 3. List & filter transactions
    list_resp = client.get("/api/transactions", headers=headers)
    assert list_resp.status_code == 200
    assert list_resp.get_json()["total_count"] == 2

    # Filter by expense only
    filter_resp = client.get("/api/transactions?type=expense", headers=headers)
    assert filter_resp.status_code == 200
    assert filter_resp.get_json()["total_count"] == 1
    assert filter_resp.get_json()["transactions"][0]["merchant"] == "Olive Bistro"

    # 4. Edit expense
    edit_resp = client.put(f"/api/transactions/{exp_id}", headers=headers, json={
        "amount": 1450.0,
        "notes": "Updated dinner bill"
    })
    assert edit_resp.status_code == 200
    assert edit_resp.get_json()["transaction"]["amount"] == 1450.0

    # 5. Delete income
    del_resp = client.delete(f"/api/transactions/{inc_id}", headers=headers)
    assert del_resp.status_code == 200

    # Verify count is now 1
    after_del = client.get("/api/transactions", headers=headers)
    assert after_del.get_json()["total_count"] == 1

def test_quick_add_nlp_parse(auth_client):
    client, token, user_id = auth_client
    headers = {"Authorization": f"Bearer {token}"}

    parse_resp = client.post("/api/transactions/quick-add/nlp", headers=headers, json={
        "text": "Spent ₹450 at Starbucks today"
    })
    assert parse_resp.status_code == 200
    parsed = parse_resp.get_json()["parsed"]
    assert parsed["amount"] == 450.0
    assert parsed["type"] == "expense"
    assert "Starbucks" in parsed["merchant"]
