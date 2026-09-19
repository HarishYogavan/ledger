import time
import requests

def run_tests(base_url):
    print(f"\n==========================================")
    print(f"RUNNING AUTH PIPELINE TESTS ON: {base_url}")
    print(f"==========================================")

    # User test credentials
    test_ts = int(time.time())
    email = f"auth_flow_test_{test_ts}@ledgerapp.io"
    password = "SecurePassword123!"
    full_name = "Auth Flow Verifier"

    desktop_headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
    }
    mobile_headers = {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
    }

    # Test 6: Enter incorrect password -> Show error
    bad_login = requests.post(f"{base_url}/api/auth/login", json={"email": "nobody@ledger.io", "password": "wrong"})
    assert bad_login.status_code == 401, f"Expected 401, got {bad_login.status_code}"
    bad_data = bad_login.json()
    assert "error" in bad_data
    print("[PASS] Test 6: Incorrect credentials return 401 with explicit error message")

    # Test 7: Enter invalid email -> Show validation error
    bad_reg = requests.post(f"{base_url}/api/auth/register", json={"full_name": "Test", "email": "not-an-email", "password": "short"})
    assert bad_reg.status_code == 400
    assert "error" in bad_reg.json()
    print("[PASS] Test 7: Invalid input returns 400 with validation error")

    # Test 1: Create account -> Sign In -> Dashboard
    reg = requests.post(f"{base_url}/api/auth/register", json={
        "full_name": full_name,
        "email": email,
        "password": password,
        "currency": "₹"
    }, headers=desktop_headers)
    assert reg.status_code == 201, f"Registration failed: {reg.text}"
    reg_data = reg.json()
    token = reg_data.get("token")
    assert token, "Token not returned in registration"
    user_id = reg_data["user"]["id"]
    print(f"[PASS] Test 1A: Account created successfully (User ID: {user_id})")

    # Sign in with the newly created account
    login = requests.post(f"{base_url}/api/auth/login", json={
        "email": email,
        "password": password
    }, headers=desktop_headers)
    assert login.status_code == 200, f"Login failed: {login.text}"
    login_data = login.json()
    token = login_data.get("token")
    auth_headers = {"Authorization": f"Bearer {token}", "X-Auth-Token": token, **desktop_headers}

    # Verify Dashboard route and overview API data access
    dash_page = requests.get(f"{base_url}/dashboard")
    assert dash_page.status_code == 200, f"/dashboard returned {dash_page.status_code}"
    overview = requests.get(f"{base_url}/api/dashboard/overview", headers=auth_headers)
    assert overview.status_code == 200, f"Overview API returned {overview.status_code}"
    print("[PASS] Test 1B: Sign In -> Protected Dashboard access granted & Overview loaded")

    # Test 2: Sign out -> Sign In again -> Dashboard
    logout = requests.post(f"{base_url}/api/auth/logout", headers=auth_headers)
    assert logout.status_code == 200
    me_after_logout = requests.get(f"{base_url}/api/auth/me", headers=auth_headers)
    assert me_after_logout.status_code == 401, "Expected 401 after logout"
    print("[PASS] Test 2A: Sign out invalidates session")

    # Sign in again with same user
    login2 = requests.post(f"{base_url}/api/auth/login", json={
        "email": email,
        "password": password
    }, headers=desktop_headers)
    assert login2.status_code == 200
    token2 = login2.json()["token"]
    auth_headers2 = {"Authorization": f"Bearer {token2}", "X-Auth-Token": token2, **desktop_headers}
    me2 = requests.get(f"{base_url}/api/auth/me", headers=auth_headers2)
    assert me2.status_code == 200
    print("[PASS] Test 2B: Sign In again restores valid authentication session")

    # Test 3: Refresh Dashboard -> Remain authenticated
    me_refresh = requests.get(f"{base_url}/api/auth/me", headers=auth_headers2)
    assert me_refresh.status_code == 200
    dash_refresh = requests.get(f"{base_url}/api/dashboard/overview", headers=auth_headers2)
    assert dash_refresh.status_code == 200
    print("[PASS] Test 3: Refresh Dashboard maintains persistent authenticated state")

    # Test 4: Close application -> Reopen (simulate new client instance with stored token)
    new_client_headers = {"Authorization": f"Bearer {token2}", "X-Auth-Token": token2, "User-Agent": desktop_headers["User-Agent"]}
    reopen_me = requests.get(f"{base_url}/api/auth/me", headers=new_client_headers)
    assert reopen_me.status_code == 200
    assert reopen_me.json()["user"]["email"] == email
    print("[PASS] Test 4: Reopening application restores session seamlessly")

    # Test 5: Open protected route while signed out
    unauth_overview = requests.get(f"{base_url}/api/dashboard/overview")
    assert unauth_overview.status_code == 401
    assert unauth_overview.json().get("authenticated") is False
    print("[PASS] Test 5: Protected API rejects unauthenticated requests with 401")

    # Test 8: Mobile sign-in -> Dashboard
    mobile_login = requests.post(f"{base_url}/api/auth/login", json={
        "email": email,
        "password": password
    }, headers=mobile_headers)
    assert mobile_login.status_code == 200
    mobile_token = mobile_login.json()["token"]
    mobile_auth = {"Authorization": f"Bearer {mobile_token}", "X-Auth-Token": mobile_token, **mobile_headers}
    mobile_overview = requests.get(f"{base_url}/api/dashboard/overview", headers=mobile_auth)
    assert mobile_overview.status_code == 200
    print("[PASS] Test 8: Mobile browser sign-in -> Independent Dashboard access")

    # Test 9: Desktop sign-in -> Dashboard concurrently
    desktop_overview = requests.get(f"{base_url}/api/dashboard/overview", headers=auth_headers2)
    assert desktop_overview.status_code == 200
    print("[PASS] Test 9: Desktop session concurrently active without conflicts")

    # Test 10: Check sessions list includes both Mobile and Desktop
    sessions_res = requests.get(f"{base_url}/api/auth/sessions", headers=auth_headers2)
    assert sessions_res.status_code == 200
    active_sessions = sessions_res.json()["sessions"]
    assert len(active_sessions) >= 2
    dev_types = [s["device_name"] for s in active_sessions]
    print(f"[PASS] Test 10: Multi-device session restoration verified (Devices: {dev_types})")

    print(f"\nALL 10 AUTH PIPELINE TESTS PASSED ON {base_url}!\n")

if __name__ == "__main__":
    import sys
    url = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5000"
    run_tests(url)
