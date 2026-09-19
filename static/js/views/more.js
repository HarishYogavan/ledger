/**
 * LEDGER MOBILE "MORE" HUB VIEW
 * Provides quick touch access to all 16+ core & advanced financial modules.
 */

window.LedgerViews = window.LedgerViews || {};

window.LedgerViews.more = {
  render(container) {
    if (!container) container = document.getElementById('view-container');
    if (!container) return;

    const user = window.LedgerApp.currentUser || {};
    const name = user.full_name || 'Ledger User';
    const email = user.email || '';
    const initial = name.charAt(0).toUpperCase();

    container.innerHTML = `
      <div class="more-hub-container">
        <!-- User Profile Card -->
        <div class="card" style="padding:16px; display:flex; align-items:center; justify-content:space-between; background:linear-gradient(135deg, rgba(6,214,160,0.1), rgba(58,134,255,0.08)); border-color:rgba(6,214,160,0.3);">
          <div style="display:flex; align-items:center; gap:12px;">
            <div class="user-avatar" style="width:44px; height:44px; font-size:18px;">${initial}</div>
            <div>
              <div style="font-weight:700; font-size:15px; color:var(--text-primary);">${name}</div>
              <div style="font-size:12px; color:var(--text-secondary);">${email}</div>
            </div>
          </div>
          <a href="#settings" class="btn btn-secondary" style="font-size:12px; padding:6px 12px;">Settings</a>
        </div>

        <!-- 1. Planning & Budgeting -->
        <div>
          <div class="more-section-title">📊 Planning & Budgeting</div>
          <div class="more-grid">
            <a href="#budgets" class="more-tile">
              <div class="more-tile-icon">🏷️</div>
              <div class="more-tile-label">Budgets</div>
              <div class="more-tile-desc">Category limits</div>
            </a>
            <a href="#goals" class="more-tile">
              <div class="more-tile-icon">🎯</div>
              <div class="more-tile-label">Goals</div>
              <div class="more-tile-desc">Savings milestones</div>
            </a>
            <a href="#calendar" class="more-tile">
              <div class="more-tile-icon">📅</div>
              <div class="more-tile-label">Calendar</div>
              <div class="more-tile-desc">Bills & income schedule</div>
            </a>
            <a href="#net-worth" class="more-tile">
              <div class="more-tile-icon">💼</div>
              <div class="more-tile-label">Net Worth</div>
              <div class="more-tile-desc">Assets & liabilities</div>
            </a>
          </div>
        </div>

        <!-- 2. Intelligence & Simulators -->
        <div>
          <div class="more-section-title">⚡ Intelligence & Simulators</div>
          <div class="more-grid">
            <a href="#twin" class="more-tile">
              <div class="more-tile-icon">🧬</div>
              <div class="more-tile-label">Financial Twin</div>
              <div class="more-tile-desc">Scenario simulator</div>
            </a>
            <a href="#twin" onclick="setTimeout(()=>window.LedgerViews.financialTwin.switchTab('emergency'),100)" class="more-tile">
              <div class="more-tile-icon">🛡️</div>
              <div class="more-tile-label">Emergency Fund</div>
              <div class="more-tile-desc">Survival runway</div>
            </a>
            <a href="#twin" onclick="setTimeout(()=>window.LedgerViews.financialTwin.switchTab('income'),100)" class="more-tile">
              <div class="more-tile-icon">📈</div>
              <div class="more-tile-label">Income Sim</div>
              <div class="more-tile-desc">Job & raise impact</div>
            </a>
            <a href="#twin" onclick="setTimeout(()=>window.LedgerViews.financialTwin.switchTab('events'),100)" class="more-tile">
              <div class="more-tile-icon">🎉</div>
              <div class="more-tile-label">Life Events</div>
              <div class="more-tile-desc">Baby, home, move</div>
            </a>
            <a href="#analytics" onclick="setTimeout(()=>window.LedgerViews.analytics.switchTab('dna'),100)" class="more-tile">
              <div class="more-tile-icon">🧪</div>
              <div class="more-tile-label">Expense DNA</div>
              <div class="more-tile-desc">Spending habits</div>
            </a>
            <a href="#analytics" onclick="setTimeout(()=>window.LedgerViews.analytics.switchTab('leak'),100)" class="more-tile">
              <div class="more-tile-icon">💧</div>
              <div class="more-tile-label">Money Leaks</div>
              <div class="more-tile-desc">Micro-spending map</div>
            </a>
            <a href="#analytics" onclick="setTimeout(()=>window.LedgerViews.analytics.switchTab('time-machine'),100)" class="more-tile">
              <div class="more-tile-icon">⏳</div>
              <div class="more-tile-label">Time Machine</div>
              <div class="more-tile-desc">Historical snapshots</div>
            </a>
            <a href="#health" class="more-tile">
              <div class="more-tile-icon">❤️</div>
              <div class="more-tile-label">Health Radar</div>
              <div class="more-tile-desc">Financial score</div>
            </a>
          </div>
        </div>

        <!-- 3. Vaults & Collaboration -->
        <div>
          <div class="more-section-title">📂 Vaults & Collaboration</div>
          <div class="more-grid">
            <a href="#purchases" class="more-tile">
              <div class="more-tile-icon">🛍️</div>
              <div class="more-tile-label">Purchases Vault</div>
              <div class="more-tile-desc">Warranties & lifecycle</div>
            </a>
            <a href="#documents" class="more-tile">
              <div class="more-tile-icon">📑</div>
              <div class="more-tile-label">Document Vault</div>
              <div class="more-tile-desc">Receipts & files</div>
            </a>
            <a href="#shared-expenses" class="more-tile">
              <div class="more-tile-icon">👥</div>
              <div class="more-tile-label">Shared Expenses</div>
              <div class="more-tile-desc">Splits & settlements</div>
            </a>
            <a href="#ai" class="more-tile">
              <div class="more-tile-icon">🤖</div>
              <div class="more-tile-label">Ask Ledger AI</div>
              <div class="more-tile-desc">AI financial advisor</div>
            </a>
          </div>
        </div>

        <!-- 4. Reports & Configuration -->
        <div>
          <div class="more-section-title">⚙️ Reports & System</div>
          <div class="more-grid">
            <a href="#reports" class="more-tile">
              <div class="more-tile-icon">📄</div>
              <div class="more-tile-label">Reports (PDF)</div>
              <div class="more-tile-desc">Export summaries</div>
            </a>
            <a href="#settings" class="more-tile">
              <div class="more-tile-icon">⚙️</div>
              <div class="more-tile-label">Preferences</div>
              <div class="more-tile-desc">Currency & privacy</div>
            </a>
          </div>
        </div>

        <!-- Sign Out Button -->
        <div style="margin-top:10px; margin-bottom:20px;">
          <button class="btn btn-secondary" style="width:100%; font-size:13px; padding:12px; color:var(--brand-danger); border-color:rgba(239,71,111,0.3);" onclick="window.LedgerAPI.logout()">
            Sign Out of Ledger
          </button>
        </div>
      </div>
    `;
  }
};
