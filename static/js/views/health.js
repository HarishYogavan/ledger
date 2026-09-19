/**
 * LEDGER FINANCIAL HEALTH CENTER
 * 6 concrete indicators with rigorous 3-step explanations:
 * What changed -> Why it changed -> What data supports it
 */

window.LedgerViews = window.LedgerViews || {};

window.LedgerViews.health = {
  async render(container) {
    container.innerHTML = `
      <div style="display:flex; justify-content:center; padding:60px;">
        <div style="color:var(--brand-teal); font-weight:600;">Evaluating Financial Health Center...</div>
      </div>
    `;

    try {
      const data = await window.LedgerAPI.getHealth();

      if (!data.has_data) {
        container.innerHTML = `
          <div class="empty-state" style="margin-top: 40px; padding: 60px 24px;">
            <img src="/static/icons/logo-192.png" alt="Ledger" class="empty-state-logo">
            <h2 class="empty-state-title">Financial Health Baseline Pending</h2>
            <p class="empty-state-desc">
              ${data.message || 'Add your first transaction or setup your profile to evaluate stability, savings velocity, and obligation load.'}
            </p>
            <button class="btn btn-primary" onclick="window.LedgerViews.quickAdd.open()">+ Add First Transaction</button>
          </div>
        `;
        return;
      }

      const indicators = data.indicators || [];

      container.innerHTML = `
        <div style="margin-bottom:24px;">
          <h1 style="font-size:24px; margin-bottom:4px;">Financial Health Center</h1>
          <p style="font-size:13px; color:var(--text-secondary);">
            Transparent evaluation across 6 critical operational metrics. Grounded strictly in your recorded data.
          </p>
        </div>

        <div class="grid-cols-2" style="gap:20px;">
          ${indicators.map(ind => `
            <div class="health-indicator-card indicator-${ind.badge}">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <h3 style="font-size:16px;">${ind.title}</h3>
                <span class="badge badge-${ind.badge}">${ind.status}</span>
              </div>

              <!-- 3-Step Explanation -->
              <div style="display:flex; flex-direction:column; gap:8px; margin-top:6px;">
                <div class="health-explanation-step">
                  <span class="step-title" style="color:var(--brand-teal);">1. What Changed</span>
                  <span class="step-desc">${ind.what_changed}</span>
                </div>

                <div class="health-explanation-step">
                  <span class="step-title" style="color:var(--brand-blue);">2. Why It Changed</span>
                  <span class="step-desc">${ind.why_it_changed}</span>
                </div>

                <div class="health-explanation-step">
                  <span class="step-title" style="color:var(--text-muted);">3. Supporting Data</span>
                  <span class="step-desc" style="font-family:monospace; font-size:11.5px;">${ind.data_support}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;

    } catch (err) {
      container.innerHTML = `<div class="card" style="border-color:var(--brand-danger);">${err.message}</div>`;
    }
  }
};
