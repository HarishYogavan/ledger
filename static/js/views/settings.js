/**
 * LEDGER SETTINGS VIEW
 */

window.LedgerViews = window.LedgerViews || {};

window.LedgerViews.settings = {
  async render(container) {
    container.innerHTML = `
      <div style="display:flex; justify-content:center; padding:60px;">
        <div style="color:var(--brand-teal); font-weight:600;">Loading Settings...</div>
      </div>
    `;

    try {
      const data = await window.LedgerAPI.getSettings();
      const u = data.user || {};
      const s = data.settings || {};

      container.innerHTML = `
        <div style="margin-bottom:24px;">
          <h1 style="font-size:24px; margin-bottom:4px;">Account & Preferences</h1>
          <p style="font-size:13px; color:var(--text-secondary);">Manage currency, security, privacy mode, and export your personal records</p>
        </div>

        <div style="display:flex; flex-direction:column; gap:24px; max-width:800px;">
          <!-- Profile & Security -->
          <div class="card">
            <h3 style="font-size:16px; margin-bottom:16px;">Profile & Account</h3>
            <form onsubmit="window.LedgerViews.settings.handleSaveProfile(event)">
              <div class="responsive-form-grid">
                <div class="form-group">
                  <label class="form-label">Full Name</label>
                  <input type="text" id="set-name" class="form-control" value="${u.full_name || ''}" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Email Address (Read-only)</label>
                  <input type="email" class="form-control" value="${u.email || ''}" disabled style="opacity:0.6;">
                </div>
              </div>

              <div class="responsive-form-grid">
                <div class="form-group">
                  <label class="form-label">Primary Currency</label>
                  <select id="set-currency" class="form-control">
                    <option value="₹" ${u.currency === '₹' ? 'selected' : ''}>₹ - Indian Rupee (INR)</option>
                    <option value="$" ${u.currency === '$' ? 'selected' : ''}>$ - US Dollar (USD)</option>
                    <option value="€" ${u.currency === '€' ? 'selected' : ''}>€ - Euro (EUR)</option>
                    <option value="£" ${u.currency === '£' ? 'selected' : ''}>£ - British Pound (GBP)</option>
                    <option value="¥" ${u.currency === '¥' ? 'selected' : ''}>¥ - Japanese Yen (JPY)</option>
                    <option value="C$" ${u.currency === 'C$' ? 'selected' : ''}>C$ - Canadian Dollar (CAD)</option>
                    <option value="A$" ${u.currency === 'A$' ? 'selected' : ''}>A$ - Australian Dollar (AUD)</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Appearance Theme</label>
                  <select id="set-theme" class="form-control" onchange="window.LedgerApp.setTheme(this.value)">
                    <option value="dark" ${u.theme === 'dark' ? 'selected' : ''}>Dark Fintech Mode</option>
                    <option value="light" ${u.theme === 'light' ? 'selected' : ''}>Light Clean Mode</option>
                  </select>
                </div>
              </div>

              <div class="responsive-form-grid">
                <div class="form-group">
                  <label class="form-label">Monthly Income Baseline (${u.currency || '₹'})</label>
                  <input type="number" id="set-income" class="form-control" value="${u.monthly_income || 0}">
                </div>
                <div class="form-group">
                  <label class="form-label">Monthly Savings Target (${u.currency || '₹'})</label>
                  <input type="number" id="set-target" class="form-control" value="${u.savings_target || 0}">
                </div>
              </div>

              <div style="display:flex; justify-content:flex-end;">
                <button type="submit" class="btn btn-primary">Save Profile Changes</button>
              </div>
            </form>
          </div>

            <!-- Privacy & Security -->
          <div class="card">
            <h3 style="font-size:16px; margin-bottom:14px;">Privacy & Discretion Controls</h3>
            
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; padding:12px; background:var(--brand-surface); border-radius:var(--radius-md); margin-bottom:12px;">
              <div style="flex:1; min-width:200px;">
                <strong style="color:var(--text-primary);">Privacy Mode (Discretion Filter)</strong>
                <p style="font-size:12px; color:var(--text-secondary); margin:2px 0 0 0;">Blurs all monetary values and account balances across the entire application.</p>
              </div>
              <button class="btn ${u.privacy_mode ? 'btn-primary' : 'btn-secondary'}" onclick="window.LedgerApp.togglePrivacyMode()">
                ${u.privacy_mode ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; padding:12px; background:var(--brand-surface); border-radius:var(--radius-md); margin-bottom:12px;">
              <div style="flex:1; min-width:200px;">
                <strong style="color:var(--text-primary);">📍 Geolocation Tagging</strong>
                <p style="font-size:12px; color:var(--text-secondary); margin:2px 0 0 0;">Automatically attach approximate location/city to transactions when recorded.</p>
              </div>
              <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                <button class="btn ${s.location_tracking_enabled ? 'btn-primary' : 'btn-secondary'}" onclick="window.LedgerViews.settings.toggleLocationTracking(${!s.location_tracking_enabled})">
                  ${s.location_tracking_enabled ? 'Active' : 'Disabled'}
                </button>
                <button class="btn btn-secondary" style="font-size:11px; padding:6px 10px;" onclick="window.LedgerViews.settings.clearLocationHistory()">
                  Clear History
                </button>
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; padding:12px; background:var(--brand-surface); border-radius:var(--radius-md); margin-bottom:16px;">
              <div style="flex:1; min-width:200px;">
                <strong style="color:var(--text-primary);">🧠 AI Financial Memory</strong>
                <p style="font-size:12px; color:var(--text-secondary); margin:2px 0 0 0;">Allow Ledger AI to recall financial facts and past goals during conversations.</p>
              </div>
              <button class="btn ${s.ai_memory_enabled !== false ? 'btn-primary' : 'btn-secondary'}" onclick="window.LedgerViews.settings.toggleAiMemory(${s.ai_memory_enabled === false})">
                ${s.ai_memory_enabled !== false ? 'Active' : 'Disabled'}
              </button>
            </div>

            <!-- Password Change -->
            <h4 style="font-size:14px; margin-bottom:12px;">Change Password</h4>
            <form onsubmit="window.LedgerViews.settings.handleChangePassword(event)">
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                <div class="form-group">
                  <label class="form-label">Current Password</label>
                  <input type="password" id="set-curr-pwd" class="form-control" required>
                </div>
                <div class="form-group">
                  <label class="form-label">New Password (min 8 chars)</label>
                  <input type="password" id="set-new-pwd" class="form-control" minlength="8" required>
                </div>
              </div>
              <div style="display:flex; justify-content:flex-end;">
                <button type="submit" class="btn btn-secondary">Update Password</button>
              </div>
            </form>
          </div>

          <!-- Data Ownership & Danger Zone -->
          <div class="card" style="border-color:rgba(239,71,111,0.3);">
            <h3 style="font-size:16px; color:var(--brand-danger); margin-bottom:14px;">Data Portability & Account Lifecycle</h3>
            <p style="font-size:13px; color:var(--text-secondary); margin-bottom:16px;">
              You maintain complete ownership of your personal financial records. You can export everything at any time or permanently delete your account.
            </p>
            <div style="display:flex; gap:12px; flex-wrap:wrap;">
              <button class="btn btn-secondary" onclick="window.location.href='/api/auth/export-data'">
                📥 Export All Personal Data (ZIP)
              </button>
              <button class="btn" style="background:var(--brand-danger-bg); color:var(--brand-danger); border:1px solid rgba(239,71,111,0.4);" onclick="window.LedgerViews.settings.openDeleteAccountModal()">
                🗑️ Permanently Delete Account
              </button>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="card" style="border-color:var(--brand-danger);">${err.message}</div>`;
    }
  },

  async handleSaveProfile(e) {
    e.preventDefault();
    const full_name = document.getElementById('set-name').value.trim();
    const currency = document.getElementById('set-currency').value;
    const monthly_income = parseFloat(document.getElementById('set-income').value) || 0;
    const savings_target = parseFloat(document.getElementById('set-target').value) || 0;

    try {
      await window.LedgerAPI.updateSettings({ full_name, currency, monthly_income, savings_target });
      alert('Settings saved successfully');
      window.location.reload();
    } catch (err) {
      alert(err.message);
    }
  },

  async handleChangePassword(e) {
    e.preventDefault();
    const current_password = document.getElementById('set-curr-pwd').value;
    const new_password = document.getElementById('set-new-pwd').value;

    try {
      await window.LedgerAPI.updateSettings({ current_password, new_password });
      alert('Password updated successfully');
      document.getElementById('set-curr-pwd').value = '';
      document.getElementById('set-new-pwd').value = '';
    } catch (err) {
      alert(err.message);
    }
  },

  async toggleLocationTracking(enabled) {
    try {
      await window.LedgerAPI.request('/api/locations/toggle', {
        method: 'POST',
        body: JSON.stringify({ enabled })
      });
      const container = document.getElementById('main-content');
      this.render(container);
    } catch (err) {
      alert(err.message);
    }
  },

  async clearLocationHistory() {
    if (!confirm('Are you sure you want to permanently clear location coordinates from all past transactions?')) return;
    try {
      const res = await window.LedgerAPI.request('/api/locations/clear', { method: 'POST' });
      alert(res.message || 'Location data cleared.');
      const container = document.getElementById('main-content');
      this.render(container);
    } catch (err) {
      alert(err.message);
    }
  },

  async toggleAiMemory(enabled) {
    try {
      await window.LedgerAPI.updateSettings({ ai_memory_enabled: enabled });
      const container = document.getElementById('main-content');
      this.render(container);
    } catch (err) {
      alert(err.message);
    }
  },

  openDeleteAccountModal() {
    const pwd = prompt('CRITICAL: Type your current password to permanently erase your account and all financial records:');
    if (!pwd) return;

    window.LedgerAPI.request('/api/auth/delete-account', {
      method: 'POST',
      body: JSON.stringify({ password: pwd })
    }).then(() => {
      alert('Your account and financial data have been permanently deleted.');
      window.location.href = '/register';
    }).catch(err => alert(err.message));
  }
};
