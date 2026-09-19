# Ledger - Your Personal Financial Operating System

<div align="center">
  <img src="static/icons/logo-192.png" alt="Ledger Logo" width="96" height="96">
  <h3>Record → Understand → Plan → Simulate → Improve</h3>
  <p>A comprehensive, production-grade personal finance management application and simulation engine.</p>
</div>

---

## Overview

**Ledger** goes beyond traditional expense tracking. It is a complete financial operating system designed to give individuals absolute clarity over their net worth, spending temperaments, cashflow horizons, and future life decisions.

Built with a high-performance **Flask (Python 3.11)** backend and a responsive, custom-crafted **Vanilla JavaScript/CSS SPA** frontend featuring glassmorphism, native Canvas financial charts, and Discretion/Privacy Mode.

---

## Key Features

### 1. Financial Twin & Simulation Engine
- **What-If Scenario Simulator**: Multi-scenario projections across 12-month timelines modeling spending shifts and goal impacts.
- **Purchase Impact Analyzer**: Computes a Safety Score (0–100), savings runway impact, and goal delays before making large purchases.
- **Emergency Fund Simulator**: Tests survival runway against 3, 6, 9, or 12 months of essential living expenses.
- **Income Change Simulator**: Simulates job loss, promotions, bonuses, and salary reductions.
- **Life Events Simulator**: Models milestones (New Baby, Home Purchase, Relocation, Marriage) with initial and recurring budget shifts.
- **Cashflow Forecaster**: Multi-month cashflow projections factoring recurring subscriptions, bills, and planned purchases.

### 2. Expense DNA & Money Leak Map
- **Behavioral DNA**: Analyzes spending temperament (Spender vs Balanced vs Saver, Essentials vs Discretionary ratio).
- **Weekday vs. Weekend Divergence**: Highlights behavioral shifts in weekend spending patterns.
- **Merchant Clusters**: Pinpoints vendor concentration risks.
- **Money Leak Map**: Detects micro-transactions (<₹300, impulse dining, delivery fees, subscription creep) with direct transaction drill-down.

### 3. Financial Time Machine & "What Changed?"
- **Historical Reconstruction**: Time travel to any past date to inspect financial health, balances, and net worth at that exact moment.
- **THEN vs. NOW Delta Engine**: Compares two points in time across 6 financial dimensions with deterministic AI narrative generation.

### 4. Purchases & Warranty Vault
- **Asset Lifecycle Pipeline**: Track items across 5 stages: `Planned` → `Active` → `Under Warranty` → `Expiring Soon` → `Out of Warranty`.
- **Warranty Expiration Alerts**: Automatic calendar milestone integration.

### 5. Document Vault
- **Encrypted Receipt & Document Storage**: Categorized vault for receipts, tax forms, insurance policies, and warranties with secure downloads.

### 6. Shared Expenses & Workspace Collaboration
- **Multi-Member Workspaces**: Roommates, couples, trips, and shared households.
- **Splits & Minimization**: Equal, percentage, and custom splits with automated net balance minimization and one-click debt settlement.

### 7. Core Personal Finance
- **Interactive Calendar**: Month, Week, and Day views tracking income cycles, bills, subscriptions, goals, and warranties.
- **Category Budgets**: Non-judgmental tracking with spending pace indicators and rollover surplus.
- **Financial Health Radar**: Multi-pillar health scores (Savings Rate, Debt-to-Income, Emergency Runway, Discretionary Ratio).
- **Net Worth Tracking**: Asset & liability ledger with historical trajectory charts.
- **Natural Language Quick Add (NLP)**: Ingests commands like *"Spent 350 at Blue Tokai for coffee"* instantly.
- **Universal Global Search**: Real-time cross-entity search across all 10 financial data models.
- **Privacy Mode**: Instant one-click masking of all financial figures and balances for public discretion.
- **Executive Branded PDF Reports**: Generated via ReportLab with embedded Ledger brand identity.

---

## Architecture & Technology Stack

- **Backend**: Python 3.11, Flask (24 modular blueprints), SQLAlchemy ORM, ReportLab, OpenPyXL, PyJWT, Werkzeug.
- **Frontend**: Vanilla JavaScript (SPA hash-routing architecture), Custom CSS Design System (no Tailwind dependencies), Native HTML5 Canvas charting engine.
- **Database**: SQLite (local) / PostgreSQL compatible (via `DATABASE_URL`).
- **Security**: Argon2/PBKDF2 salted password hashing, JWT bearer tokens, user data isolation enforcement on every query.

---

## Getting Started Locally

### Prerequisites
- Python 3.10+
- pip

### Installation
```bash
# Clone repository
git clone <repo-url>
cd ledger

# Install dependencies
pip install -r requirements.txt

# Run development server
python run.py
```
The application will be live at `http://localhost:5000`.

### Running Automated Tests
```bash
python -m pytest -v
```

---

## Deployment to Vercel

Ledger is pre-configured with `vercel.json` and `api/index.py` for serverless deployment on Vercel:

```bash
# Deploy with Vercel CLI
npx vercel --prod
```

---

## License
Proprietary / MIT. Built for personal financial excellence.
