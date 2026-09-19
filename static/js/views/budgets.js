/**
 * DEDICATED BUDGETS VIEW
 */

window.LedgerViews = window.LedgerViews || {};

window.LedgerViews.budgets = {
  currentPeriod: 'monthly', // 'monthly' | 'weekly' | 'custom'

  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Budgets</h1>
          <p class="page-subtitle">Track category spending limits and maintain financial peace of mind without judgment.</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-primary" onclick="window.LedgerViews.budgets.openSetBudgetModal()">
            + Set Category Budget
          </button>
        </div>
      </div>

      <!-- Period Filter -->
      <div class="tab-pills" style="margin-bottom: 20px;">
        <button class="tab-pill active" id="btn-period-monthly" onclick="window.LedgerViews.budgets.switchPeriod('monthly')">Monthly Budgets</button>
        <button class="tab-pill" id="btn-period-weekly" onclick="window.LedgerViews.budgets.switchPeriod('weekly')">Weekly Budgets</button>
      </div>

      <div id="budgets-stream-container">
        <div style="text-align: center; padding: 40px; color: var(--text-muted);">Loading budgets...</div>
      </div>
    `;

    this.loadBudgets();
  },

  switchPeriod(period) {
    this.currentPeriod = period;
    document.querySelectorAll('.tab-pill').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`btn-period-${period}`);
    if (btn) btn.classList.add('active');
    this.loadBudgets();
  },

  async loadBudgets() {
    const container = document.getElementById('budgets-stream-container');
    if (!container) return;

    try {
      const res = await window.LedgerAPI.getBudgets();
      const allBudgets = res.budgets || [];
      const curr = res.currency || '₹';

      const filtered = allBudgets.filter(b => b.period === this.currentPeriod);

      if (filtered.length === 0) {
        container.innerHTML = `
          <div class="empty-state-card">
            <div class="empty-state-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--brand-teal)" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <h3 class="empty-state-title">No ${this.currentPeriod.charAt(0).toUpperCase() + this.currentPeriod.slice(1)} Budgets Configured</h3>
            <p class="empty-state-desc">Set spending guidelines for categories like Food, Utilities, or Shopping to monitor pace without stress.</p>
            <button class="btn btn-primary" onclick="window.LedgerViews.budgets.openSetBudgetModal()">+ Create Budget Limit</button>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px;">
          ${filtered.map(b => {
            const spent = b.spent || 0.0;
            const limit = b.amount;
            const remaining = Math.max(0, limit - spent);
            const pct = Math.min(100, Math.round((spent / limit) * 100));
            const isExceeded = spent > limit;

            return `
              <div class="card" style="border-left: 3px solid ${b.category_color};">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                  <div>
                    <h3 style="font-size: 16px; margin: 0 0 4px 0;">${b.category_name}</h3>
                    <span style="font-size: 11px; text-transform: uppercase; color: var(--text-muted);">${b.period}</span>
                  </div>
                  <div style="text-align: right;">
                    <span class="privacy-mask" style="font-size: 16px; font-weight: 700; color: var(--text-primary);">${curr}${limit.toLocaleString()}</span>
                  </div>
                </div>

                <!-- Progress Bar -->
                <div style="background: rgba(255,255,255,0.06); height: 8px; border-radius: 4px; overflow: hidden; margin-bottom: 10px;">
                  <div style="width: ${pct}%; height: 100%; background: ${isExceeded ? 'var(--brand-warning)' : 'var(--brand-teal)'}; transition: width 0.3s ease;"></div>
                </div>

                <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-secondary);">
                  <span>Used: <strong class="privacy-mask" style="color: var(--text-primary);">${curr}${spent.toLocaleString()}</strong> (${pct}%)</span>
                  <span>Remaining: <strong class="privacy-mask" style="color: ${isExceeded ? 'var(--brand-warning)' : 'var(--brand-teal)'};">${curr}${remaining.toLocaleString()}</strong></span>
                </div>

                ${isExceeded ? `
                  <div style="margin-top: 10px; font-size: 11px; color: var(--brand-warning); background: rgba(255,209,102,0.08); padding: 6px 10px; border-radius: 4px;">
                    Observed spending exceeded budget by ${curr}${(spent - limit).toLocaleString()}.
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="card" style="color:var(--brand-danger);">Failed to load budgets: ${err.message}</div>`;
    }
  },

  async openSetBudgetModal() {
    let modal = document.getElementById('budget-modal');
    if (modal) modal.remove();

    let categories = [];
    try {
      const res = await window.LedgerAPI.getCategories();
      categories = (res.categories || []).filter(c => c.type === 'expense');
    } catch (e) {}

    modal = document.createElement('div');
    modal.id = 'budget-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 440px;">
        <div class="modal-header">
          <h3 class="modal-title">Set Category Budget</h3>
          <button class="modal-close" onclick="document.getElementById('budget-modal').remove()">✕</button>
        </div>
        <form onsubmit="window.LedgerViews.budgets.handleSaveBudget(event)">
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Category *</label>
              <select id="b-category" class="form-select" required>
                ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Budget Limit Amount *</label>
              <input type="number" step="any" id="b-amount" class="form-input" placeholder="0.00" required>
            </div>
            <div class="form-group">
              <label class="form-label">Period</label>
              <select id="b-period" class="form-select">
                <option value="monthly" ${this.currentPeriod==='monthly'?'selected':''}>Monthly</option>
                <option value="weekly" ${this.currentPeriod==='weekly'?'selected':''}>Weekly</option>
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('budget-modal').remove()">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Budget</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  },

  async handleSaveBudget(e) {
    e.preventDefault();
    const payload = {
      category_id: parseInt(document.getElementById('b-category').value),
      amount: parseFloat(document.getElementById('b-amount').value),
      period: document.getElementById('b-period').value,
    };
    try {
      await window.LedgerAPI.setBudget(payload);
      document.getElementById('budget-modal').remove();
      this.loadBudgets();
    } catch (err) {
      alert('Error saving budget: ' + err.message);
    }
  }
};
