import requests
import time

BASE_URL = 'https://ledger-two-inky.vercel.app'
print('Testing live production at:', BASE_URL)

# 1. Test root page
res = requests.get(f'{BASE_URL}/')
assert res.status_code == 200
assert 'app-splash-loader' in res.text
print('[PASS] Root index.html serves app-splash-loader')

# 2. Test login page preflight
res = requests.get(f'{BASE_URL}/login')
assert res.status_code == 200
assert 'checkExistingSession' in res.text
print('[PASS] /login page serves preflight session check')

# 3. Create test user on Desktop
test_email = f'pers_user_{int(time.time())}@ledgerapp.io'
desktop_headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'}
reg_res = requests.post(f'{BASE_URL}/api/auth/register', json={
    'full_name': 'Persistent Test User',
    'email': test_email,
    'password': 'SecurePassword123!'
}, headers=desktop_headers)
assert reg_res.status_code == 201, reg_res.text
reg_data = reg_res.json()
desktop_token = reg_data['token']
desktop_sid = reg_data['session_id']
print('[PASS] Registered new user with Desktop session:', desktop_sid)

# 4. Login from Mobile Device
mobile_headers = {'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'}
login_res = requests.post(f'{BASE_URL}/api/auth/login', json={
    'email': test_email,
    'password': 'SecurePassword123!'
}, headers=mobile_headers)
assert login_res.status_code == 200, login_res.text
mobile_data = login_res.json()
mobile_token = mobile_data['token']
mobile_sid = mobile_data['session_id']
print('[PASS] Logged in from iPhone Safari with session:', mobile_sid)
assert desktop_sid != mobile_sid

# 5. Check active sessions from Desktop
sess_res = requests.get(f'{BASE_URL}/api/auth/sessions', headers={'Authorization': f'Bearer {desktop_token}', **desktop_headers})
assert sess_res.status_code == 200, sess_res.text
sessions = sess_res.json()['sessions']
print(f'[PASS] Active sessions retrieved: {len(sessions)}')
for s in sessions:
    print(f"  - ID: {s['id']}, Device: {s['device_name']}, Browser: {s['browser_name']}, Current: {s['is_current']}")
assert len(sessions) >= 2

# 6. Verify /api/auth/me works for both independent sessions
me_desktop = requests.get(f'{BASE_URL}/api/auth/me', headers={'Authorization': f'Bearer {desktop_token}'})
assert me_desktop.status_code == 200
me_mobile = requests.get(f'{BASE_URL}/api/auth/me', headers={'Authorization': f'Bearer {mobile_token}'})
assert me_mobile.status_code == 200
print('[PASS] Both Desktop and Mobile sessions authenticate independently via /api/auth/me')

# 7. Desktop revokes Mobile session
del_res = requests.delete(f'{BASE_URL}/api/auth/sessions/{mobile_sid}', headers={'Authorization': f'Bearer {desktop_token}'})
assert del_res.status_code == 200, del_res.text
print('[PASS] Mobile session revoked remotely by Desktop')

# 8. Verify Mobile session is now rejected, while Desktop session remains active
me_mobile_after = requests.get(f'{BASE_URL}/api/auth/me', headers={'Authorization': f'Bearer {mobile_token}'})
assert me_mobile_after.status_code == 401
print('[PASS] Revoked Mobile session properly rejected (HTTP 401)')

me_desktop_after = requests.get(f'{BASE_URL}/api/auth/me', headers={'Authorization': f'Bearer {desktop_token}'})
assert me_desktop_after.status_code == 200
print('[PASS] Desktop session remains securely authenticated (HTTP 200)')

print('\nALL LIVE PRODUCTION PERSISTENT AUTH & MULTI-DEVICE TESTS PASSED!')
