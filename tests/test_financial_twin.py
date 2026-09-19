from models import Transaction

def test_financial_twin_simulation_and_isolation(auth_client):
    client, token, user_id = auth_client
    headers = {"Authorization": f"Bearer {token}"}

    # Add real baseline transaction
    client.post("/api/transactions", headers=headers, json={
        "type": "income",
        "amount": 60000.0,
        "date": "2026-09-01",
        "merchant": "Salary"
    })
    client.post("/api/transactions", headers=headers, json={
        "type": "expense",
        "amount": 25000.0,
        "date": "2026-09-02",
        "merchant": "Rent & Groceries"
    })

    # Count real transactions before simulation
    count_before = client.get("/api/transactions", headers=headers).get_json()["total_count"]
    assert count_before == 2

    # Run hypothetical Financial Twin simulation:
    # "What if I buy a ₹50,000 laptop in month 2, and save ₹5,000 extra monthly?"
    sim_payload = {
        "months": 12,
        "changes": [
            {
                "change_type": "one_off_expense",
                "title": "Buy MacBook",
                "amount": 50000.0,
                "frequency": "once",
                "start_month_offset": 2
            },
            {
                "change_type": "recurring_expense",
                "title": "Cancel unused Gym",
                "amount": -2000.0,
                "frequency": "monthly",
                "start_month_offset": 1
            }
        ]
    }

    sim_resp = client.post("/api/scenarios/simulate", headers=headers, json=sim_payload)
    assert sim_resp.status_code == 200
    sim_data = sim_resp.get_json()

    # Projections should exist
    assert len(sim_data["baseline_timeline"]) == 12
    assert len(sim_data["simulated_timeline"]) == 12
    assert "net_difference" in sim_data

    # Month 2 in simulation should reflect the laptop purchase
    sim_m2 = sim_data["simulated_timeline"][2]
    base_m2 = sim_data["baseline_timeline"][2]
    assert sim_m2["expense"] > base_m2["expense"]

    # CRITICAL TEST: Verify real transactions count remains EXACTLY 2 (zero mutation!)
    count_after = client.get("/api/transactions", headers=headers).get_json()["total_count"]
    assert count_after == count_before

def test_purchase_impact_analyzer(auth_client):
    client, token, user_id = auth_client
    headers = {"Authorization": f"Bearer {token}"}

    # Setup baseline funds
    client.post("/api/transactions", headers=headers, json={
        "type": "income",
        "amount": 80000.0,
        "date": "2026-09-01",
        "merchant": "Salary"
    })

    # Add upcoming bill
    client.post("/api/bills", headers=headers, json={
        "title": "Apartment Maintenance",
        "amount": 4000.0,
        "due_date": "2026-09-28"
    })

    # Test purchase analyzer: evaluating a ₹35,000 Camera
    impact_resp = client.post("/api/scenarios/purchase-impact", headers=headers, json={
        "item_name": "Mirrorless Camera",
        "price": 35000.0,
        "planned_date": "2026-09-25"
    })
    assert impact_resp.status_code == 200
    impact = impact_resp.get_json()

    assert impact["item_name"] == "Mirrorless Camera"
    assert impact["price"] == 35000.0
    assert impact["current_available_funds"] >= 80000.0
    assert impact["upcoming_known_obligations"] >= 4000.0
    assert impact["projected_remaining_funds"] == impact["current_available_funds"] - 35000.0
    assert "safety_rating" in impact
    assert "explanation" in impact
