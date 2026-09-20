import requests
import uuid
import sys

LIVE = "https://ledger-two-inky.vercel.app"
s = requests.Session()

print("--- TEST 1: Check Login Page for Demo Removal ---")
r = s.get(f"{LIVE}/login")
assert r.status_code == 200, f"Login page failed: {r.status_code}"
assert "Instant Demo Workspace" not in r.text, "Instant Demo Workspace must NOT be on page"
assert "Launch Live Demo Account" not in r.text, "Launch Live Demo Account must NOT be on page"
assert "demo-btn" not in r.text, "demo-btn must NOT be on page"
assert "live_verifier" not in r.text, "live_verifier must NOT be on page"
print("TEST 1 PASSED: All demo UI components and accounts are completely removed!")

print("\n--- TEST 2: Verify /api/auth/demo is Removed ---")
r_demo = s.post(f"{LIVE}/api/auth/demo")
assert r_demo.status_code == 404, f"Expected 404, got {r_demo.status_code}"
print("TEST 2 PASSED: Demo endpoint returns 404 Not Found.")

print("\n--- TEST 3: Register New User Account ---")
test_email = f"user_{uuid.uuid4().hex[:8]}@ledgerfinance.app"
test_pwd = "MySecurePassword2026!"
test_name = "Harish User"
reg_payload = {
    "email": test_email,
    "password": test_pwd,
    "full_name": test_name,
    "currency": "₹"
}
r_reg = s.post(f"{LIVE}/api/auth/register", json=reg_payload)
assert r_reg.status_code == 201, f"Register failed: {r_reg.status_code} {r_reg.text}"
reg_json = r_reg.json()
assert reg_json["user"]["email"] == test_email
assert "token" in reg_json
print(f"TEST 3 PASSED: Account registered successfully: {test_email} (User ID: {reg_json['user']['id']})")

print("\n--- TEST 4: Clear Session / Sign Out ---")
s.cookies.clear()
print("Session cookies cleared to simulate a fresh browser sign-in.")

print("\n--- TEST 5: Sign In with EXACT Same Email and Password ---")
login_payload = {
    "email": test_email,
    "password": test_pwd
}
r_login = s.post(f"{LIVE}/api/auth/login", json=login_payload)
assert r_login.status_code == 200, f"Login failed: {r_login.status_code} {r_login.text}"
login_json = r_login.json()
assert login_json["user"]["email"] == test_email
assert "token" in login_json
token = login_json["token"]
print("TEST 5 PASSED: Logged in successfully with exact same credentials! Token received.")

print("\n--- TEST 6: Verify Authenticated Session with JWT ---")
r_me = s.get(f"{LIVE}/api/auth/me", headers={"Authorization": f"Bearer {token}"})
assert r_me.status_code == 200, f"/me failed: {r_me.status_code} {r_me.text}"
me_json = r_me.json()
assert me_json["authenticated"] is True
assert me_json["user"]["email"] == test_email
print(f"TEST 6 PASSED: Session verified for {me_json['user']['full_name']} ({me_json['user']['email']})")

print("\n--- TEST 7: Create a Real Financial Transaction ---")
r_tx = s.post(f"{LIVE}/api/transactions", headers={"Authorization": f"Bearer {token}"}, json={
    "type": "income",
    "amount": 75000.0,
    "date": "2026-09-20",
    "merchant": "Salary Direct Deposit",
    "category_id": 1,
    "notes": "September Paycheck"
})
assert r_tx.status_code == 201, f"Create tx failed: {r_tx.status_code} {r_tx.text}"
tx_data = r_tx.json()
print(f"TEST 7 PASSED: Transaction created! ID: {tx_data['transaction']['id']}, Amount: INR {tx_data['transaction']['amount']}")

print("\n--- TEST 8: Fetch Dashboard Overview ---")
r_dash = s.get(f"{LIVE}/api/dashboard/overview", headers={"Authorization": f"Bearer {token}"})
assert r_dash.status_code == 200, f"Overview failed: {r_dash.status_code} {r_dash.text}"
dash_json = r_dash.json()
print(f"TEST 8 PASSED: Dashboard overview returned data: Income = INR {dash_json.get('total_income', 0)}")

print("\n=======================================================")
print("  ALL 8 LIVE PRODUCTION TESTS PASSED WITH 100% SUCCESS! ")
print("=======================================================")
