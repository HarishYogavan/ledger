import unittest
import uuid
from app import create_app
from models import db, User
from services.cloud_sync import delete_cloud_user

class TestSplashAndAuthFix(unittest.TestCase):
    def setUp(self):
        self.app = create_app({'TESTING': True})
        self.client = self.app.test_client()
        self.test_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        self.test_password = "SecurePassword123!"

    def tearDown(self):
        with self.app.app_context():
            u = User.query.filter_by(email=self.test_email).first()
            if u:
                db.session.delete(u)
                db.session.commit()
        delete_cloud_user(self.test_email)

    def test_login_page_clean(self):
        """GET /login with no cookie should return 200 and login.html, with NO demo button"""
        res = self.client.get('/login')
        self.assertEqual(res.status_code, 200)
        self.assertIn(b"Sign In - Ledger Financial OS", res.data)
        self.assertNotIn(b"Launch Live Demo Account", res.data)
        self.assertNotIn(b"Instant Demo Workspace", res.data)

    def test_login_page_with_stale_cookie(self):
        """GET /login with stale cookie should clear cookie and return 200, NOT redirect loop!"""
        with self.client.session_transaction() as sess:
            sess['user_id'] = 999999
        res = self.client.get('/login', follow_redirects=False)
        self.assertEqual(res.status_code, 200)
        self.assertIn(b"Sign In - Ledger Financial OS", res.data)
        with self.client.session_transaction() as sess:
            self.assertNotIn('user_id', sess)

    def test_login_page_with_valid_cookie(self):
        """GET /login with valid cookie should redirect to / (NEVER /more)"""
        with self.app.app_context():
            user = User.query.filter_by(email=self.test_email).first()
            if not user:
                user = User(
                    email=self.test_email,
                    password_hash="testhash123",
                    full_name="Valid Test User",
                    currency="₹"
                )
                db.session.add(user)
                db.session.commit()
            user_id = user.id

        with self.client.session_transaction() as sess:
            sess['user_id'] = user_id

        res = self.client.get('/login', follow_redirects=False)
        self.assertEqual(res.status_code, 302)
        self.assertEqual(res.headers.get('Location'), '/')

    def test_register_page_with_stale_cookie(self):
        """GET /register with stale cookie should clear cookie and return 200"""
        with self.client.session_transaction() as sess:
            sess['user_id'] = 999999
        res = self.client.get('/register', follow_redirects=False)
        self.assertEqual(res.status_code, 200)
        self.assertIn(b"register-card", res.data)

    def test_demo_endpoint_is_removed(self):
        """POST /api/auth/demo should be completely removed (404 or 405)"""
        res = self.client.post('/api/auth/demo')
        self.assertEqual(res.status_code, 404)

    def test_register_and_login_flow(self):
        """Creating an account then signing in with same credentials must succeed"""
        reg_res = self.client.post('/api/auth/register', json={
            "full_name": "Test Real User",
            "email": self.test_email,
            "password": self.test_password,
            "currency": "₹"
        })
        self.assertEqual(reg_res.status_code, 201)
        reg_data = reg_res.get_json()
        self.assertIn("token", reg_data)
        self.assertEqual(reg_data["user"]["email"], self.test_email)

        # Clear session to simulate fresh login
        with self.client.session_transaction() as sess:
            sess.clear()

        # Sign in with the exact same account and password
        login_res = self.client.post('/api/auth/login', json={
            "email": self.test_email,
            "password": self.test_password
        })
        self.assertEqual(login_res.status_code, 200)
        login_data = login_res.get_json()
        self.assertIn("token", login_data)
        self.assertEqual(login_data["user"]["email"], self.test_email)

    def test_me_endpoint_returns_token(self):
        """GET /api/auth/me should return valid token and user for registered account"""
        reg_res = self.client.post('/api/auth/register', json={
            "full_name": "Test Auth Me",
            "email": self.test_email,
            "password": self.test_password,
            "currency": "₹"
        })
        token = reg_res.get_json()["token"]
        res = self.client.get('/api/auth/me', headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["authenticated"])
        self.assertIn("token", data)
        self.assertEqual(data["user"]["email"], self.test_email)

    def test_root_and_app_routes(self):
        """GET / and GET /dashboard should return index.html with safety watchdog"""
        res1 = self.client.get('/')
        self.assertEqual(res1.status_code, 200)
        self.assertIn(b"splash-fallback-actions", res1.data)
        self.assertIn(b"Safety Watchdog", res1.data)

        res2 = self.client.get('/dashboard')
        self.assertEqual(res2.status_code, 200)
        self.assertIn(b"app-splash-loader", res2.data)

if __name__ == '__main__':
    unittest.main()
