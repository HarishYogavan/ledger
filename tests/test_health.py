def test_financial_health_indicators(auth_client):
    client, token, user_id = auth_client
    headers = {"Authorization": f"Bearer {token}"}

    # Clean empty state when no transactions exist
    empty_health = client.get("/api/health", headers=headers).get_json()
    assert empty_health["has_data"] is False

    # Add realistic financial records
    client.post("/api/transactions", headers=headers, json={
        "type": "income",
        "amount": 70000.0,
        "date": "2026-09-01",
        "merchant": "Corporate Salary"
    })
    client.post("/api/transactions", headers=headers, json={
        "type": "expense",
        "amount": 15000.0,
        "date": "2026-09-05",
        "merchant": "Supermarket"
    })
    client.post("/api/goals", headers=headers, json={
        "name": "Emergency Cushion",
        "target_amount": 100000.0,
        "current_amount": 40000.0,
        "target_date": "2027-03-31",
        "monthly_contribution": 10000.0
    })
    client.post("/api/bills", headers=headers, json={
        "title": "Internet Fiber",
        "amount": 1199.0,
        "due_date": "2026-09-29"
    })

    # Fetch health
    health_resp = client.get("/api/health", headers=headers)
    assert health_resp.status_code == 200
    data = health_resp.get_json()
    assert data["has_data"] is True

    indicators = data["indicators"]
    assert len(indicators) == 6

    # Verify each indicator provides What changed -> Why it changed -> What data supports it
    keys = [ind["key"] for ind in indicators]
    assert "spending_stability" in keys
    assert "savings_progress" in keys
    assert "recurring_load" in keys
    assert "cash_flow_consistency" in keys
    assert "goal_progress" in keys
    assert "obligation_load" in keys

    for ind in indicators:
        assert "what_changed" in ind and len(ind["what_changed"]) > 0
        assert "why_it_changed" in ind and len(ind["why_it_changed"]) > 0
        assert "data_support" in ind and len(ind["data_support"]) > 0
