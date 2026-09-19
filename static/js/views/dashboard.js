/**
 * LEDGER DASHBOARD VIEW
 */

window.LedgerViews = window.LedgerViews || {};

window.LedgerViews.dashboard = {
  async render(container) {
    container.innerHTML = `
      <div style="display:flex; justify-content:center; padding: 60px;">
        <div style="color:var(--brand-teal); font-weight:600;">Loading Ledger Dashboard...</div>
      </div>
    `;

    try {
      const data = await window.LedgerAPI.getOverview();
      const user = window.LedgerApp.currentUser || {};
      const curr = data.currency || user.currency || '₹';
      const o = data.overview || {};

      if (!o.has_data) {
        container.innerHTML = `
          <div class="empty-state" style="margin-top: 40px; padding: 60px 24px;">
            <img src="/static/icons/logo-192.png" alt="Ledger" class="empty-state-logo">
            <h2 class="empty-state-title">Welcome to Ledger</h2>
            <p class="empty-state-desc">
              Your Personal Financial Operating System is ready. Record your first transaction or setup onboarding to activate cashflow tracking, AI summaries, and financial projections.
            </p>
            <div style="display:flex; gap:12px;">
              <button class="btn btn-primary" onclick="window.LedgerViews.quickAdd.open()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
                Add Your First Transaction
              </button>
              <button class="btn btn-secondary" onclick="window.LedgerApp.navigate('settings')">
                Account Settings
              </button>
            </div>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <!-- AI Summary Banner -->
        ${data.ai_summary ? `
          <div style="background:linear-gradient(135deg, rgba(6,214,160,0.1), rgba(58,134,255,0.08)); border:1px solid rgba(6,214,160,0.3); border-radius:var(--radius-lg); padding:16px 20px; margin-bottom:24px; display:flex; align-items:flex-start; gap:14px;">
            <img src="/static/icons/logo-32.png" alt="AI" style="width:24px; height:24px; margin-top:2px;">
            <div>
              <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--brand-teal); margin-bottom:2px;">
                Ledger Intelligence Summary
              </div>
              <p style="font-size:13.5px; color:var(--text-primary); line-height:1.45;">${data.ai_summary}</p>
            </div>
          </div>
        ` : ''}

        <!-- 4-Card Financial Overview -->
        <div class="grid-cols-4" style="margin-bottom: 24px;">
          <div class="card metric-card">
            <div class="metric-label">
              <span>Current Balance</span>
              <span class="badge badge-info">Liquid</span>
            </div>
            <div class="metric-value privacy-mask">${curr}${o.current_balance.toLocaleString(undefined, {minimumFractionDigits:2})}</div>
            <div class="metric-trend trend-neutral">Net cash across all accounts</div>
          </div>

          <div class="card metric-card">
            <div class="metric-label">
              <span>Monthly Income</span>
              <span class="badge badge-success">Inflow</span>
            </div>
            <div class="metric-value privacy-mask" style="color:var(--brand-teal);">${curr}${o.total_income.toLocaleString(undefined, {minimumFractionDigits:2})}</div>
            <div class="metric-trend trend-up">Current calendar month</div>
          </div>

          <div class="card metric-card">
            <div class="metric-label">
              <span>Monthly Expenses</span>
              <span class="badge badge-danger">Outflow</span>
            </div>
            <div class="metric-value privacy-mask" style="color:var(--brand-danger);">${curr}${o.total_expenses.toLocaleString(undefined, {minimumFractionDigits:2})}</div>
            <div class="metric-trend trend-down">Current calendar month</div>
          </div>

          <div class="card metric-card">
            <div class="metric-label">
              <span>Savings Rate</span>
              <span class="badge ${o.savings_rate >= 20 ? 'badge-success' : 'badge-warning'}">${o.savings_rate}%</span>
            </div>
            <div class="metric-value privacy-mask">${curr}${o.net_savings.toLocaleString(undefined, {minimumFractionDigits:2})}</div>
            <div class="metric-trend ${o.net_savings >= 0 ? 'trend-up' : 'trend-down'}">
              ${o.net_savings >= 0 ? 'Surplus this month' : 'Deficit this month'}
            </div>
          </div>
        </div>

        <!-- Middle Row: Cashflow Trend Chart & Spending Breakdown Donut -->
        <div class="grid-cols-2" style="margin-bottom: 24px;">
          <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <div>
                <h3 style="font-size:16px;">Cash Flow Trend</h3>
                <p style="font-size:12px; color:var(--text-secondary);">Income vs Expense monthly comparison</p>
              </div>
              <div style="display:flex; gap:12px; font-size:11px; font-weight:600;">
                <span style="display:flex; align-items:center; gap:4px; color:var(--brand-teal);">● Income</span>
                <span style="display:flex; align-items:center; gap:4px; color:var(--brand-danger);">● Expense</span>
              </div>
            </div>
            <div id="dashboard-cashflow-chart" class="chart-container"></div>
          </div>

          <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <div>
                <h3 style="font-size:16px;">Spending Breakdown</h3>
                <p style="font-size:12px; color:var(--text-secondary);">Current month distribution by category</p>
              </div>
              <button class="btn btn-secondary" style="padding:4px 10px; font-size:11px;" onclick="window.LedgerApp.navigate('analytics')">View All</button>
            </div>
            <div id="dashboard-spending-donut" style="min-height:220px; display:flex; align-items:center; justify-content:center;"></div>
          </div>
        </div>

        <!-- Bottom Row: Recent Transactions & Active Goals / Upcoming -->
        <div class="grid-cols-2" style="margin-bottom: 24px;">
          <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
              <h3 style="font-size:16px;">Recent Transactions</h3>
              <button class="btn btn-secondary" style="padding:4px 10px; font-size:11px;" onclick="window.LedgerApp.navigate('transactions')">View All</button>
            </div>
            <div class="data-table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Merchant / Description</th>
                    <th>Category</th>
                    <th>Date</th>
                    <th style="text-align:right;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.recent_transactions && data.recent_transactions.length > 0 ? data.recent_transactions.map(t => `
                    <tr>
                      <td>
                        <strong style="font-weight:600;">${t.merchant || t.notes || 'Transaction'}</strong>
                        ${t.is_recurring ? '<span class="badge badge-info" style="margin-left:6px; font-size:9px;">Recurring</span>' : ''}
                      </td>
                      <td>
                        <span class="category-pill">
                          <span class="cat-dot" style="background:${t.category_color};"></span>
                          ${t.category_name}
                        </span>
                      </td>
                      <td style="color:var(--text-secondary); font-size:12px;">${t.date}</td>
                      <td style="text-align:right; font-weight:700; color:${t.type === 'income' ? 'var(--brand-teal)' : 'var(--text-primary)'};" class="privacy-mask">
                        ${t.type === 'income' ? '+' : '-'}${curr}${t.amount.toLocaleString(undefined, {minimumFractionDigits:2})}
                      </td>
                    </tr>
                  `).join('') : `
                    <tr><td colspan="4" style="text-align:center; color:var(--text-muted);">No recent transactions</td></tr>
                  `}
                </tbody>
              </table>
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:20px;">
            <!-- Active Goals -->
            <div class="card">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                <h3 style="font-size:16px;">Active Financial Goals</h3>
                <button class="btn btn-secondary" style="padding:4px 10px; font-size:11px;" onclick="window.LedgerApp.navigate('goals')">Manage</button>
              </div>
              ${data.goals && data.goals.length > 0 ? data.goals.map(g => `
                <div style="margin-bottom:12px;">
                  <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:600; margin-bottom:4px;">
                    <span>${g.name}</span>
                    <span class="privacy-mask">${curr}${g.current_amount.toLocaleString()} / ${curr}${g.target_amount.toLocaleString()}</span>
                  </div>
                  <div class="safety-meter">
                    <div class="safety-meter-fill" style="width:${g.progress_percent}%; background:linear-gradient(90deg, var(--brand-teal), var(--brand-blue));"></div>
                  </div>
                  <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-muted);">
                    <span>${g.progress_percent}% funded</span>
                    <span>Target: ${g.target_date}</span>
                  </div>
                </div>
              `).join('') : `
                <p style="font-size:13px; color:var(--text-muted);">No active goals. Create a goal to track your milestone velocity.</p>
              `}
            </div>

            <!-- Upcoming Obligations -->
            <div class="card">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                <h3 style="font-size:16px;">Upcoming Obligations (14 Days)</h3>
                <span class="badge badge-warning privacy-mask">${curr}${o.upcoming_obligations.toLocaleString()} Due</span>
              </div>
              ${data.upcoming_bills && data.upcoming_bills.length > 0 ? data.upcoming_bills.map(b => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--brand-border-subtle); font-size:13px;">
                  <div>
                    <strong style="color:var(--text-primary);">${b.title}</strong>
                    <div style="font-size:11px; color:var(--text-muted);">Due: ${b.due_date}</div>
                  </div>
                  <div style="text-align:right;">
                    <span style="font-weight:700; color:var(--brand-danger);" class="privacy-mask">${curr}${b.amount.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
                  </div>
                </div>
              `).join('') : `
                <p style="font-size:13px; color:var(--text-muted);">No unpaid bills scheduled in the next 14 days.</p>
              `}
            </div>
          </div>
        </div>
      `;

      // Render Charts
      window.LedgerCharts.renderCashflowChart('dashboard-cashflow-chart', data.cashflow_trend, curr);
      window.LedgerCharts.renderDonutChart('dashboard-spending-donut', data.spending_breakdown, curr);

    } catch (err) {
      container.innerHTML = `
        <div class="card" style="border-color:var(--brand-danger);">
          <h3 style="color:var(--brand-danger);">Error Loading Dashboard</h3>
          <p style="color:var(--text-secondary); margin-top:6px;">${err.message}</p>
        </div>`;
    }
  }
};
