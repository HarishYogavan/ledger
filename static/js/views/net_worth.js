/**
 * LEDGER NET WORTH VIEW
 */

window.LedgerViews = window.LedgerViews || {};

window.LedgerViews.netWorth = {
  async render(container) {
    container.innerHTML = `
      <div style="display:flex; justify-content:center; padding:60px;">
        <div style="color:var(--brand-teal); font-weight:600;">Calculating Net Worth...</div>
      </div>
    `;

    try {
      const data = await window.LedgerAPI.getNetWorth();
      const user = window.LedgerApp.currentUser || {};
      const curr = data.currency || user.currency || '₹';

      container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; flex-wrap:wrap; gap:16px;">
          <div>
            <h1 style="font-size:24px; margin-bottom:4px;">Net Worth</h1>
            <p style="font-size:13px; color:var(--text-secondary);">Track assets, debts, and comprehensive net wealth over time</p>
          </div>
          <div style="display:flex; gap:10px;">
            <button class="btn btn-secondary" onclick="window.LedgerViews.netWorth.openAddLiabilityModal()">+ Add Debt / Liability</button>
            <button class="btn btn-primary" onclick="window.LedgerViews.netWorth.openAddAssetModal()">+ Add Asset</button>
          </div>
        </div>

        <!-- 3 KPIs -->
        <div class="grid-cols-3" style="margin-bottom:24px;">
          <div class="card metric-card" style="border-left:4px solid var(--brand-teal);">
            <div class="metric-label">Total Net Worth</div>
            <div class="metric-value privacy-mask" style="color:var(--brand-teal); font-size:32px;">${curr}${data.net_worth.toLocaleString(undefined, {minimumFractionDigits:2})}</div>
            <div class="metric-trend trend-neutral">Assets minus Liabilities</div>
          </div>

          <div class="card metric-card">
            <div class="metric-label">Total Assets</div>
            <div class="metric-value privacy-mask" style="font-size:30px;">${curr}${data.total_assets.toLocaleString(undefined, {minimumFractionDigits:2})}</div>
            <div class="metric-trend trend-neutral">Includes ${curr}${data.ledger_cash_balance.toLocaleString()} liquid ledger balance</div>
          </div>

          <div class="card metric-card">
            <div class="metric-label">Total Liabilities</div>
            <div class="metric-value privacy-mask" style="color:var(--brand-danger); font-size:30px;">${curr}${data.total_liabilities.toLocaleString(undefined, {minimumFractionDigits:2})}</div>
            <div class="metric-trend trend-down">Loans, mortgages & cards</div>
          </div>
        </div>

        <!-- Two Columns: Assets & Liabilities -->
        <div class="grid-cols-2" style="gap:24px;">
          <!-- Assets Column -->
          <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
              <h3 style="font-size:16px;">Recorded Assets</h3>
              <button class="btn btn-secondary" style="padding:4px 10px; font-size:11px;" onclick="window.LedgerViews.netWorth.openAddAssetModal()">+ Add</button>
            </div>
            <div class="data-table-wrapper" style="border:none;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Asset Name</th>
                    <th>Class</th>
                    <th style="text-align:right;">Valuation</th>
                    <th style="text-align:center;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.assets && data.assets.length > 0 ? data.assets.map(a => `
                    <tr>
                      <td><strong style="color:var(--text-primary);">${a.name}</strong></td>
                      <td><span class="badge badge-info">${a.category}</span></td>
                      <td style="text-align:right; font-weight:700; color:var(--brand-teal);" class="privacy-mask">${curr}${a.value.toLocaleString()}</td>
                      <td style="text-align:center;">
                        <button class="btn-icon" style="color:var(--brand-danger);" onclick="window.LedgerViews.netWorth.deleteAsset(${a.id})">✕</button>
                      </td>
                    </tr>
                  `).join('') : `
                    <tr><td colspan="4" style="text-align:center; color:var(--text-muted);">No manual assets recorded yet</td></tr>
                  `}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Liabilities Column -->
          <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
              <h3 style="font-size:16px;">Recorded Liabilities</h3>
              <button class="btn btn-secondary" style="padding:4px 10px; font-size:11px;" onclick="window.LedgerViews.netWorth.openAddLiabilityModal()">+ Add</button>
            </div>
            <div class="data-table-wrapper" style="border:none;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Liability Name</th>
                    <th>Type</th>
                    <th style="text-align:right;">Outstanding</th>
                    <th style="text-align:center;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.liabilities && data.liabilities.length > 0 ? data.liabilities.map(l => `
                    <tr>
                      <td><strong style="color:var(--text-primary);">${l.name}</strong></td>
                      <td><span class="badge badge-warning">${l.category}</span></td>
                      <td style="text-align:right; font-weight:700; color:var(--brand-danger);" class="privacy-mask">${curr}${l.amount.toLocaleString()}</td>
                      <td style="text-align:center;">
                        <button class="btn-icon" style="color:var(--brand-danger);" onclick="window.LedgerViews.netWorth.deleteLiability(${l.id})">✕</button>
                      </td>
                    </tr>
                  `).join('') : `
                    <tr><td colspan="4" style="text-align:center; color:var(--text-muted);">No liabilities recorded</td></tr>
                  `}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="card" style="border-color:var(--brand-danger);">${err.message}</div>`;
    }
  },

  openAddAssetModal() {
    let modal = document.getElementById('add-asset-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'add-asset-modal';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }
    const curr = window.LedgerApp.currentUser?.currency || '₹';

    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title">+ Add Asset</h3>
          <button class="modal-close" onclick="document.getElementById('add-asset-modal').remove()">✕</button>
        </div>
        <div class="modal-body">
          <form onsubmit="window.LedgerViews.netWorth.handleAddAsset(event)">
            <div class="form-group">
              <label class="form-label">Asset Name *</label>
              <input type="text" id="asset-name" class="form-control" placeholder="e.g. Mutual Funds, Gold, Real Estate" required>
            </div>
            <div class="form-group">
              <label class="form-label">Valuation Amount (${curr}) *</label>
              <input type="number" step="100" id="asset-value" class="form-control" placeholder="0.00" required>
            </div>
            <div class="form-group">
              <label class="form-label">Category</label>
              <select id="asset-cat" class="form-control">
                <option value="investments">Investments / Stocks / Mutual Funds</option>
                <option value="savings">Fixed Deposits / Savings</option>
                <option value="property">Real Estate / Land</option>
                <option value="vehicles">Vehicles</option>
                <option value="other">Valuables / Other</option>
              </select>
            </div>
            <div class="modal-footer" style="padding:12px 0 0 0;">
              <button type="button" class="btn btn-secondary" onclick="document.getElementById('add-asset-modal').remove()">Cancel</button>
              <button type="submit" class="btn btn-primary">Save Asset</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  async handleAddAsset(e) {
    e.preventDefault();
    const name = document.getElementById('asset-name').value.trim();
    const value = parseFloat(document.getElementById('asset-value').value);
    const category = document.getElementById('asset-cat').value;
    try {
      await window.LedgerAPI.addAsset({ name, value, category });
      document.getElementById('add-asset-modal').remove();
      this.render(document.getElementById('view-container'));
    } catch (err) {
      alert(err.message);
    }
  },

  async deleteAsset(id) {
    if (confirm('Delete asset record?')) {
      await window.LedgerAPI.deleteAsset(id);
      this.render(document.getElementById('view-container'));
    }
  },

  openAddLiabilityModal() {
    let modal = document.getElementById('add-liab-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'add-liab-modal';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }
    const curr = window.LedgerApp.currentUser?.currency || '₹';

    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title">+ Add Debt / Liability</h3>
          <button class="modal-close" onclick="document.getElementById('add-liab-modal').remove()">✕</button>
        </div>
        <div class="modal-body">
          <form onsubmit="window.LedgerViews.netWorth.handleAddLiability(event)">
            <div class="form-group">
              <label class="form-label">Liability Name *</label>
              <input type="text" id="liab-name" class="form-control" placeholder="e.g. Home Loan, Credit Card Balance" required>
            </div>
            <div class="form-group">
              <label class="form-label">Outstanding Amount (${curr}) *</label>
              <input type="number" step="100" id="liab-amount" class="form-control" placeholder="0.00" required>
            </div>
            <div class="form-group">
              <label class="form-label">Type</label>
              <select id="liab-cat" class="form-control">
                <option value="loans">Personal / Vehicle Loan</option>
                <option value="mortgage">Mortgage / Home Loan</option>
                <option value="credit_cards">Credit Card Debt</option>
                <option value="other">Other Obligation</option>
              </select>
            </div>
            <div class="modal-footer" style="padding:12px 0 0 0;">
              <button type="button" class="btn btn-secondary" onclick="document.getElementById('add-liab-modal').remove()">Cancel</button>
              <button type="submit" class="btn btn-primary">Save Liability</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  async handleAddLiability(e) {
    e.preventDefault();
    const name = document.getElementById('liab-name').value.trim();
    const amount = parseFloat(document.getElementById('liab-amount').value);
    const category = document.getElementById('liab-cat').value;
    try {
      await window.LedgerAPI.addLiability({ name, amount, category });
      document.getElementById('add-liab-modal').remove();
      this.render(document.getElementById('view-container'));
    } catch (err) {
      alert(err.message);
    }
  },

  async deleteLiability(id) {
    if (confirm('Delete liability record?')) {
      await window.LedgerAPI.deleteLiability(id);
      this.render(document.getElementById('view-container'));
    }
  }
};
