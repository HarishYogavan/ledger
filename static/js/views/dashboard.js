/**
 * LEDGER DASHBOARD VIEW
 * Responsive, Mobile-First Financial Operating System Dashboard
 */

window.LedgerViews = window.LedgerViews || {};

window.LedgerViews.dashboard = {
  async render(container) {
    if (!container) container = document.getElementById('view-container');
    if (!container) return;

    container.innerHTML = `
      <div style="display:flex; justify-content:center; padding: 60px;">
        <div style="color:var(--brand-teal); font-weight:600;">Loading Ledger Dashboard...</div>
      </div>
    `;

    try {
      const [overviewData, netWorthData] = await Promise.all([
        window.LedgerAPI.getOverview(),
        window.LedgerAPI.getNetWorth().catch(() => ({ net_worth: 0, total_assets: 0, total_liabilities: 0 }))
      ]);

      const data = overviewData;
      const user = window.LedgerApp.currentUser || {};
      const curr = data.currency || user.currency || '₹';
      const o = data.overview || {};
      const nw = netWorthData || {};

      if (!o.has_data) {
        container.innerHTML = `
          <div class="empty-state" style="margin-top: 20px; padding: 48px 20px;">
            <img src="/static/icons/logo-192.png" alt="Ledger" class="empty-state-logo">
            <h2 class="empty-state-title">Welcome to Ledger</h2>
            <p class="empty-state-desc">
              Your Personal Financial Operating System is active. Record your first income or expense to activate cashflow intelligence, DNA mapping, and forecasting.
            </p>
            <div style="display:flex; gap:12px; flex-wrap:wrap; justify-content:center;">
              <button class="btn btn-primary" onclick="window.LedgerViews.quickAdd.open()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
                Log First Transaction
              </button>
              <button class="btn btn-secondary" onclick="window.LedgerApp.navigate('settings')">
                Settings
              </button>
            </div>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <!-- Dashboard Master Container -->
        <div class="dashboard-flow" style="display:flex; flex-direction:column; gap:16px;">
          
          <!-- 1. Current Balance & Liquid Runway -->
          <div class="card" style="background:linear-gradient(135deg, rgba(16,27,51,0.95), rgba(22,36,68,0.9)); border:1px solid rgba(6,214,160,0.3); box-shadow:0 8px 30px rgba(0,0,0,0.25);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
              <div>
                <span style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--text-secondary);">Current Liquid Balance</span>
                <div class="stat-card-value privacy-mask" style="font-size:clamp(28px, 6vw, 36px); font-weight:800; font-family:var(--font-heading); color:var(--text-primary); margin-top:4px;">
                  ${curr}${o.current_balance.toLocaleString(undefined, {minimumFractionDigits:2})}
                </div>
              </div>
              <span class="badge badge-success" style="font-size:11px; padding:4px 10px;">Liquid Cash</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; color:var(--text-muted); border-top:1px solid var(--brand-border-subtle); padding-top:10px; margin-top:6px;">
              <span>Monthly Burn: <strong class="privacy-mask" style="color:var(--text-primary);">${curr}${o.total_expenses.toLocaleString()}</strong></span>
              <span>Net Status: <strong style="color:${o.net_savings >= 0 ? 'var(--brand-teal)' : 'var(--brand-danger)'};">${o.net_savings >= 0 ? 'Surplus' : 'Deficit'}</strong></span>
            </div>
          </div>

          <!-- 2. Income vs Expenses Row -->
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:12px;">
            <div class="card" style="padding:14px;">
              <div style="display:flex; align-items:center; gap:6px; font-size:11px; font-weight:700; text-transform:uppercase; color:var(--brand-teal);">
                <span>▲ Inflow</span>
              </div>
              <div class="privacy-mask" style="font-size:clamp(18px, 4.5vw, 24px); font-weight:800; color:var(--brand-teal); margin:6px 0 2px 0;">
                +${curr}${o.total_income.toLocaleString(undefined, {minimumFractionDigits:2})}
              </div>
              <div style="font-size:11px; color:var(--text-muted);">This month</div>
            </div>

            <div class="card" style="padding:14px;">
              <div style="display:flex; align-items:center; gap:6px; font-size:11px; font-weight:700; text-transform:uppercase; color:var(--brand-danger);">
                <span>▼ Outflow</span>
              </div>
              <div class="privacy-mask" style="font-size:clamp(18px, 4.5vw, 24px); font-weight:800; color:var(--brand-danger); margin:6px 0 2px 0;">
                -${curr}${o.total_expenses.toLocaleString(undefined, {minimumFractionDigits:2})}
              </div>
              <div style="font-size:11px; color:var(--text-muted);">This month</div>
            </div>
          </div>

          <!-- 3. Savings Rate & 4. Net Worth Banner -->
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:12px;">
            <div class="card" style="padding:14px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:11px; font-weight:700; text-transform:uppercase; color:var(--text-secondary);">Savings Rate</span>
                <span class="badge ${o.savings_rate >= 20 ? 'badge-success' : 'badge-warning'}">${o.savings_rate}%</span>
              </div>
              <div class="privacy-mask" style="font-size:clamp(18px, 4.5vw, 22px); font-weight:700; margin:6px 0 2px 0; color:var(--text-primary);">
                ${curr}${o.net_savings.toLocaleString(undefined, {minimumFractionDigits:2})}
              </div>
              <div style="font-size:11px; color:var(--text-muted);">Retained surplus</div>
            </div>

            <div class="card" style="padding:14px; cursor:pointer;" onclick="window.LedgerApp.navigate('net-worth')">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:11px; font-weight:700; text-transform:uppercase; color:var(--brand-blue);">Net Worth</span>
                <span style="font-size:10px; color:var(--brand-blue);">View ›</span>
              </div>
              <div class="privacy-mask" style="font-size:clamp(18px, 4.5vw, 22px); font-weight:700; margin:6px 0 2px 0; color:var(--text-primary);">
                ${curr}${(nw.net_worth || o.current_balance).toLocaleString()}
              </div>
              <div style="font-size:11px; color:var(--text-muted);">Assets vs Debts</div>
            </div>
          </div>

          <!-- 9. AI Financial Insight (Promoted near top for high-impact intelligence) -->
          ${data.ai_summary ? `
            <div class="card" style="background:linear-gradient(135deg, rgba(6,214,160,0.08), rgba(58,134,255,0.06)); border:1px solid rgba(6,214,160,0.25); padding:14px;">
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                <img src="/static/icons/logo-32.png" alt="AI" style="width:18px; height:18px;">
                <span style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--brand-teal);">
                  Ledger AI Insight
                </span>
              </div>
              <p style="font-size:13px; color:var(--text-primary); line-height:1.45; margin:0;">${data.ai_summary}</p>
            </div>
          ` : ''}

          <!-- 5. Cash Flow Trend Chart -->
          <div class="card" style="padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
              <div>
                <h3 style="font-size:15px; margin-bottom:2px;">Cash Flow Trend</h3>
                <p style="font-size:11px; color:var(--text-secondary);">Monthly Income vs Outflow Trajectory</p>
              </div>
              <div style="display:flex; gap:10px; font-size:11px; font-weight:600;">
                <span style="color:var(--brand-teal);">● Income</span>
                <span style="color:var(--brand-danger);">● Outflow</span>
              </div>
            </div>
            <div id="dashboard-cashflow-chart" class="chart-container" style="height:220px; width:100%;"></div>
          </div>

          <!-- 8. Spending Summary Category Breakdown -->
          <div class="card" style="padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <div>
                <h3 style="font-size:15px; margin-bottom:2px;">Spending Breakdown</h3>
                <p style="font-size:11px; color:var(--text-secondary);">Monthly expense allocation</p>
              </div>
              <button class="btn btn-secondary" style="padding:4px 8px; font-size:11px;" onclick="window.LedgerApp.navigate('analytics')">Explore</button>
            </div>
            <div id="dashboard-spending-donut" style="min-height:200px; display:flex; align-items:center; justify-content:center;"></div>
          </div>

          <!-- 6. Upcoming Bills (Obligations) -->
          <div class="card" style="padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <div>
                <h3 style="font-size:15px; margin-bottom:2px;">Upcoming Bills (14 Days)</h3>
                <span style="font-size:11px; color:var(--text-muted);">Scheduled obligations</span>
              </div>
              <span class="badge badge-warning privacy-mask">${curr}${o.upcoming_obligations.toLocaleString()} Due</span>
            </div>
            ${data.upcoming_bills && data.upcoming_bills.length > 0 ? `
              <div style="display:flex; flex-direction:column; gap:8px;">
                ${data.upcoming_bills.map(b => `
                  <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:var(--brand-surface); border-radius:var(--radius-sm); border:1px solid var(--brand-border-subtle);">
                    <div>
                      <strong style="font-size:13px; color:var(--text-primary);">${b.title}</strong>
                      <div style="font-size:11px; color:var(--text-muted);">Due: ${b.due_date}</div>
                    </div>
                    <div style="text-align:right;">
                      <span class="privacy-mask" style="font-weight:700; font-size:13px; color:var(--brand-danger);">${curr}${b.amount.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : `
              <p style="font-size:12px; color:var(--text-muted); margin:0;">No unpaid bills scheduled in the next 14 days.</p>
            `}
          </div>

          <!-- 7. Active Financial Goals -->
          <div class="card" style="padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <div>
                <h3 style="font-size:15px; margin-bottom:2px;">Active Goals</h3>
                <span style="font-size:11px; color:var(--text-muted);">Milestone progress</span>
              </div>
              <button class="btn btn-secondary" style="padding:4px 8px; font-size:11px;" onclick="window.LedgerApp.navigate('goals')">Manage</button>
            </div>
            ${data.goals && data.goals.length > 0 ? `
              <div style="display:flex; flex-direction:column; gap:10px;">
                ${data.goals.slice(0, 3).map(g => `
                  <div style="background:var(--brand-surface); padding:10px 12px; border-radius:var(--radius-sm); border:1px solid var(--brand-border-subtle);">
                    <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:600; margin-bottom:4px;">
                      <span>${g.name}</span>
                      <span class="privacy-mask">${curr}${g.current_amount.toLocaleString()} / ${curr}${g.target_amount.toLocaleString()}</span>
                    </div>
                    <div class="safety-meter" style="height:6px; margin:6px 0;">
                      <div class="safety-meter-fill" style="width:${Math.min(g.progress_percent, 100)}%; background:linear-gradient(90deg, var(--brand-teal), var(--brand-blue));"></div>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-muted);">
                      <span>${g.progress_percent}% funded</span>
                      <span>Target: ${g.target_date || 'Ongoing'}</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : `
              <p style="font-size:12px; color:var(--text-muted); margin:0;">No active goals set yet. Set a goal to track your savings velocity.</p>
            `}
          </div>

          <!-- 10. Recent Transactions -->
          <div class="card" style="padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <div>
                <h3 style="font-size:15px; margin-bottom:2px;">Recent Transactions</h3>
                <span style="font-size:11px; color:var(--text-muted);">Latest logged activity</span>
              </div>
              <button class="btn btn-secondary" style="padding:4px 8px; font-size:11px;" onclick="window.LedgerApp.navigate('transactions')">View All</button>
            </div>

            <!-- Mobile Card List View -->
            <div class="tx-mobile-list">
              ${data.recent_transactions && data.recent_transactions.length > 0 ? data.recent_transactions.slice(0, 5).map(t => `
                <div class="tx-mobile-card" onclick="window.LedgerApp.navigate('transactions')">
                  <div class="tx-mobile-left">
                    <div class="tx-mobile-icon" style="background:${t.category_color ? t.category_color + '22' : 'var(--brand-surface-elevated)'}; color:${t.category_color || 'var(--brand-teal)'};">
                      ${t.type === 'income' ? '↓' : '↑'}
                    </div>
                    <div class="tx-mobile-meta">
                      <div class="tx-mobile-merchant">${t.merchant || t.notes || 'Transaction'}</div>
                      <div class="tx-mobile-sub">
                        <span>${t.category_name}</span>
                        <span>•</span>
                        <span>${t.date}</span>
                      </div>
                    </div>
                  </div>
                  <div class="tx-mobile-amount privacy-mask" style="color:${t.type === 'income' ? 'var(--brand-teal)' : 'var(--text-primary)'};">
                    ${t.type === 'income' ? '+' : '-'}${curr}${t.amount.toLocaleString(undefined, {minimumFractionDigits:2})}
                  </div>
                </div>
              `).join('') : `
                <div style="text-align:center; padding:20px; color:var(--text-muted); font-size:13px;">No recent transactions</div>
              `}
            </div>
          </div>

        </div>
      `;

      // Render Charts with responsive dimensions
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
