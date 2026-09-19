def test_register_and_login(client):
    # Register
    reg_resp = client.post("/api/auth/register", json={
        "full_name": "Sarah Connor",
        "email": "sarah@ledger.finance",
        "password": "Password12345!",
        "currency": "₹"
    })
    assert reg_resp.status_code == 201
    reg_data = reg_resp.get_json()
    assert reg_data["user"]["email"] == "sarah@ledger.finance"
    assert "token" in reg_data

    # Duplicate register should fail
    dup_resp = client.post("/api/auth/register", json={
        "full_name": "Sarah Connor",
        "email": "sarah@ledger.finance",
        "password": "Password12345!",
    })
    assert dup_resp.status_code == 409

    # Login correct password
    login_resp = client.post("/api/auth/login", json={
        "email": "sarah@ledger.finance",
        "password": "Password12345!"
    })
    assert login_resp.status_code == 200
    login_data = login_resp.get_json()
    assert login_data["user"]["email"] == "sarah@ledger.finance"

    # Login incorrect password
    bad_login = client.post("/api/auth/login", json={
        "email": "sarah@ledger.finance",
        "password": "WrongPassword!"
    })
    assert bad_login.status_code == 401

def test_auth_me_and_onboarding(auth_client):
    client, token, user_id = auth_client
    headers = {"Authorization": f"Bearer {token}"}

    # Verify me
    me_resp = client.get("/api/auth/me", headers=headers)
    assert me_resp.status_code == 200
    assert me_resp.get_json()["user"]["id"] == user_id

    # Complete onboarding
    onboarding_resp = client.post("/api/auth/onboarding", headers=headers, json={
        "currency": "₹",
        "monthly_income": 75000,
        "savings_target": 25000,
    })
    assert onboarding_resp.status_code == 200
    user_data = onboarding_resp.get_json()["user"]
    assert user_data["onboarding_completed"] is True
    assert user_data["monthly_income"] == 75000

def test_export_data(auth_client):
    client, token, user_id = auth_client
    headers = {"Authorization": f"Bearer {token}"}

    export_resp = client.get("/api/auth/export-data", headers=headers)
    assert export_resp.status_code == 200
    assert export_resp.mimetype == "application/zip"
