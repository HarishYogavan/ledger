import os
import pytest
from app import create_app
from models import db, User
from config import Config

@pytest.fixture
def app():
    # Use in-memory or dedicated test database
    os.environ["DATABASE_PATH"] = ":memory:"
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"

    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def auth_client(app, client):
    """Registers and logs in a test user, returning client + user info."""
    resp = client.post("/api/auth/register", json={
        "full_name": "Test FinTech User",
        "email": "tester@ledger.finance",
        "password": "SecurePassword123!",
        "currency": "₹"
    })
    data = resp.get_json()
    token = data["token"]
    user_id = data["user"]["id"]
    return client, token, user_id
