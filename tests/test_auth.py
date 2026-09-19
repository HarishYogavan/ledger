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

def test_persistent_session_and_multi_device(client):
    # 1. Register User on Device 1 (iPhone)
    dev1_headers = {"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"}
    r1 = client.post("/api/auth/register", json={
        "full_name": "Multi Device User",
        "email": "multidev@ledger.finance",
        "password": "Password123!",
        "currency": "₹"
    }, headers=dev1_headers)
    assert r1.status_code == 201
    tok1 = r1.get_json()["token"]
    sid1 = r1.get_json()["session_id"]

    # 2. Login User on Device 2 (Windows PC)
    dev2_headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
    r2 = client.post("/api/auth/login", json={
        "email": "multidev@ledger.finance",
        "password": "Password123!"
    }, headers=dev2_headers)
    assert r2.status_code == 200
    tok2 = r2.get_json()["token"]
    sid2 = r2.get_json()["session_id"]
    assert sid1 != sid2

    # 3. Check sessions list from Device 2
    sess_resp = client.get("/api/auth/sessions", headers={"Authorization": f"Bearer {tok2}"})
    assert sess_resp.status_code == 200
    sessions = sess_resp.get_json()["sessions"]
    assert len(sessions) == 2
    dev_names = [s["device_name"] for s in sessions]
    assert "iPhone" in dev_names
    assert "Windows PC" in dev_names

    # 4. Device 1 remains authenticated and can fetch profile
    me1 = client.get("/api/auth/me", headers={"Authorization": f"Bearer {tok1}"})
    assert me1.status_code == 200
    assert me1.get_json()["user"]["email"] == "multidev@ledger.finance"

    # 5. Device 1 signs out
    logout1 = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {tok1}"})
    assert logout1.status_code == 200

    # 6. Device 1 is now rejected (session invalidated)
    me1_after = client.get("/api/auth/me", headers={"Authorization": f"Bearer {tok1}"})
    assert me1_after.status_code == 401

    # 7. Device 2 is STILL active and untouched!
    me2_after = client.get("/api/auth/me", headers={"Authorization": f"Bearer {tok2}"})
    assert me2_after.status_code == 200
    assert me2_after.get_json()["authenticated"] is True

def test_protected_ui_routes_and_error_handling(client):
    # Test all UI routes return 200 OK
    ui_routes = ["/", "/dashboard", "/transactions", "/budgets", "/analytics", "/goals", "/settings"]
    for route in ui_routes:
        res = client.get(route)
        assert res.status_code == 200

    # Test login with invalid password
    bad_pwd = client.post("/api/auth/login", json={
        "email": "multidev@ledger.finance",
        "password": "WrongPassword999!"
    })
    assert bad_pwd.status_code == 401
    assert "error" in bad_pwd.get_json()

    # Test login with nonexistent email
    no_user = client.post("/api/auth/login", json={
        "email": "nonexistent_email_12345@ledger.io",
        "password": "SomePassword123!"
    })
    assert no_user.status_code == 401
    assert "error" in no_user.get_json()
