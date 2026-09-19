def test_recurring_detection_and_anomalies(auth_client):
    client, token, user_id = auth_client
    headers = {"Authorization": f"Bearer {token}"}

    # Log 3 consecutive monthly payments to "Netflix India" (around 30 days apart)
    client.post("/api/transactions", headers=headers, json={
        "type": "expense",
        "amount": 649.0,
        "date": "2026-06-15",
        "merchant": "Netflix India"
    })
    client.post("/api/transactions", headers=headers, json={
        "type": "expense",
        "amount": 649.0,
        "date": "2026-07-15",
        "merchant": "Netflix India"
    })
    client.post("/api/transactions", headers=headers, json={
        "type": "expense",
        "amount": 649.0,
        "date": "2026-08-15",
        "merchant": "Netflix India"
    })

    # Trigger detection
    detect_resp = client.post("/api/recurring/detect", headers=headers)
    assert detect_resp.status_code == 200
    data = detect_resp.get_json()

    detected = data["detected_patterns"]
    netflix = next((d for d in detected if "Netflix" in d["merchant"]), None)
    assert netflix is not None
    assert netflix["frequency"] == "monthly"
    assert netflix["average_amount"] == 649.0
    assert netflix["estimated_annual_cost"] == 649.0 * 12
