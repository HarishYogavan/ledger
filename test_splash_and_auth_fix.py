import unittest
from app import create_app
from models import db, User

class TestSplashAndAuthFix(unittest.TestCase):
    def setUp(self):
        self.app = create_app({'TESTING': True})
        self.client = self.app.test_client()

    def test_login_page_clean(self):
        """GET /login with no cookie should return 200 and login.html"""
        res = self.client.get('/login')
        self.assertEqual(res.status_code, 200)
        self.assertIn(b"Sign In - Ledger Financial OS", res.data)
        self.assertIn(b"Launch Live Demo Account", res.data)

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
            user = User.query.first()
            user_id = user.id if user else 1

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

    def test_demo_login_endpoint(self):
        """POST /api/auth/demo should start session and return user + token"""
        res = self.client.post('/api/auth/demo')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("token", data)
        self.assertIn("user", data)
        self.assertEqual(data["user"]["email"], "live_verifier@ledger.finance")

    def test_me_endpoint_returns_token(self):
        """GET /api/auth/me should return valid token and user"""
        demo_res = self.client.post('/api/auth/demo')
        token = demo_res.get_json()["token"]
        res = self.client.get('/api/auth/me', headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["authenticated"])
        self.assertIn("token", data)
        self.assertEqual(data["user"]["email"], "live_verifier@ledger.finance")

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
