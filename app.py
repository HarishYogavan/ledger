import os
from flask import Flask, render_template, send_from_directory, redirect, url_for, session, request, jsonify
from config import Config
from models import db, User

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

def create_app(test_config=None):
    app = Flask(
        __name__,
        static_folder=os.path.join(BASE_DIR, "static"),
        template_folder=os.path.join(BASE_DIR, "templates")
    )
    app.config.from_object(Config)
    if test_config:
        app.config.update(test_config)

    # Ensure uploads directory exists
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    # Initialize database
    db.init_app(app)

    # Register API blueprints
    from routes.auth import auth_bp
    from routes.dashboard import dashboard_bp
    from routes.transactions import transactions_bp
    from routes.categories import categories_bp
    from routes.budgets import budgets_bp
    from routes.goals import goals_bp
    from routes.recurring import recurring_bp
    from routes.bills import bills_bp
    from routes.financial_twin import twin_bp
    from routes.analytics import analytics_bp
    from routes.health import health_bp
    from routes.net_worth import net_worth_bp
    from routes.ai import ai_bp
    from routes.reports import reports_bp
    from routes.settings import settings_bp
    from routes.search import search_bp
    from routes.expense_dna import expense_dna_bp
    from routes.time_machine import time_machine_bp
    from routes.purchases import purchases_bp
    from routes.documents import documents_bp
    from routes.shared_expenses import shared_expenses_bp
    from routes.memories import memories_bp
    from routes.locations import locations_bp
    from routes.monthly_story import monthly_story_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(transactions_bp)
    app.register_blueprint(categories_bp)
    app.register_blueprint(budgets_bp)
    app.register_blueprint(goals_bp)
    app.register_blueprint(recurring_bp)
    app.register_blueprint(bills_bp)
    app.register_blueprint(twin_bp)
    app.register_blueprint(analytics_bp)
    app.register_blueprint(health_bp)
    app.register_blueprint(net_worth_bp)
    app.register_blueprint(ai_bp)
    app.register_blueprint(reports_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(search_bp)
    app.register_blueprint(expense_dna_bp)
    app.register_blueprint(time_machine_bp)
    app.register_blueprint(purchases_bp)
    app.register_blueprint(documents_bp)
    app.register_blueprint(shared_expenses_bp)
    app.register_blueprint(memories_bp)
    app.register_blueprint(locations_bp)
    app.register_blueprint(monthly_story_bp)

    # UI Pages & Protected Application Routes
    @app.route("/")
    def index():
        return render_template("index.html")

    @app.route("/dashboard")
    @app.route("/transactions")
    @app.route("/budgets")
    @app.route("/analytics")
    @app.route("/goals")
    @app.route("/calendar")
    @app.route("/twin")
    @app.route("/health")
    @app.route("/net-worth")
    @app.route("/purchases")
    @app.route("/documents")
    @app.route("/shared-expenses")
    @app.route("/reports")
    @app.route("/settings")
    @app.route("/more")
    def app_views():
        return render_template("index.html")

    @app.route("/login")
    def login_page():
        user_id = session.get("user_id")
        if user_id:
            user = db.session.get(User, user_id)
            if user:
                return redirect("/")
            else:
                # Clear orphaned session cookie
                session.clear()
        return render_template("login.html")

    @app.route("/register")
    def register_page():
        user_id = session.get("user_id")
        if user_id:
            user = db.session.get(User, user_id)
            if user:
                return redirect("/")
            else:
                session.clear()
        return render_template("register.html")

    @app.route("/reset-password")
    def reset_password_page():
        return render_template("reset_password.html")

    @app.route("/favicon.ico")
    def favicon():
        return send_from_directory(
            os.path.join(app.root_path, "static", "icons"),
            "logo-32.png",
            mimetype="image/png"
        )

    # Error handling
    @app.errorhandler(404)
    def handle_404(e):
        if request.path.startswith("/api/"):
            return jsonify({"error": "Resource not found"}), 404
        return render_template("index.html"), 404

    @app.errorhandler(500)
    def handle_500(e):
        if request.path.startswith("/api/"):
            return jsonify({"error": "An internal server error occurred"}), 500
        return "An internal server error occurred", 500

    # Auto create tables on startup
    with app.app_context():
        db.create_all()

    return app

if __name__ == "__main__":
    app = create_app()
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
