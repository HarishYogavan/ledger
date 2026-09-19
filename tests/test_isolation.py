def test_user_data_isolation(client):
    # 1. Register User A
    resp_a = client.post("/api/auth/register", json={
        "full_name": "Alice Fin",
        "email": "alice@ledger.finance",
        "password": "PasswordAlice123!",
        "currency": "₹"
    })
    token_a = resp_a.get_json()["token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # 2. Register User B
    resp_b = client.post("/api/auth/register", json={
        "full_name": "Bob Fin",
        "email": "bob@ledger.finance",
        "password": "PasswordBob123!",
        "currency": "$"
    })
    token_b = resp_b.get_json()["token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Alice creates a private transaction
    tx_a_resp = client.post("/api/transactions", headers=headers_a, json={
        "type": "expense",
        "amount": 9999.0,
        "merchant": "Alice Private Purchase",
        "date": "2026-09-10"
    })
    tx_a_id = tx_a_resp.get_json()["transaction"]["id"]

    # Bob lists transactions -> must be 0 (cannot see Alice's transaction)
    bob_list = client.get("/api/transactions", headers=headers_b).get_json()
    assert bob_list["total_count"] == 0

    # Bob directly attempts to GET Alice's transaction -> must be 404
    bob_get_a = client.get(f"/api/transactions/{tx_a_id}", headers=headers_b)
    assert bob_get_a.status_code == 404

    # Bob attempts to DELETE Alice's transaction -> must be 404
    bob_del_a = client.delete(f"/api/transactions/{tx_a_id}", headers=headers_b)
    assert bob_del_a.status_code == 404

    # Confirm Alice's transaction is still safe and intact
    alice_check = client.get(f"/api/transactions/{tx_a_id}", headers=headers_a)
    assert alice_check.status_code == 200
    assert alice_check.get_json()["transaction"]["amount"] == 9999.0
