/**
 * LEDGER ADVANCED ANALYTICS & FINANCIAL INTELLIGENCE
 * Includes: Overview Charts, Expense DNA, Money Leak Map, Time Machine, What Changed
 */

window.LedgerViews = window.LedgerViews || {};

window.LedgerViews.analytics = {
  activeTab: 'overview', // 'overview' | 'dna' | 'leak' | 'timemachine' | 'whatchanged'
  currentTimeframe: 'monthly',

  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Professional Analytics</h1>
          <p class="page-subtitle">Granular behavioral intelligence, historical comparisons, and structural patterns.</p>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="tab-pills" style="margin-bottom: 20px;">
        <button class="tab-pill ${this.activeTab==='overview'?'active':''}" onclick="window.LedgerViews.analytics.switchTab('overview')">
          Overview & Charts
        </button>
        <button class="tab-pill ${this.activeTab==='dna'?'active':''}" onclick="window.LedgerViews.analytics.switchTab('dna')">
          Expense DNA
        </button>
        <button class="tab-pill ${this.activeTab==='leak'?'active':''}" onclick="window.LedgerViews.analytics.switchTab('leak')">
          Money Leak Map
        </button>
        <button class="tab-pill ${this.activeTab==='timemachine'?'active':''}" onclick="window.LedgerViews.analytics.switchTab('timemachine')">
          Time Machine
        </button>
        <button class="tab-pill ${this.activeTab==='whatchanged'?'active':''}" onclick="window.LedgerViews.analytics.switchTab('whatchanged')">
          What Changed?
        </button>
      </div>

      <div id="analytics-tab-body">
        <div style="text-align:center; padding: 40px; color: var(--brand-teal);">Loading analytics module...</div>
      </div>
    `;

    this.loadActiveTab();
  },

  switchTab(tab) {
    this.activeTab = tab;
    document.querySelectorAll('.tab-pill').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    this.loadActiveTab();
  },

  async loadActiveTab() {
    const container = document.getElementById('analytics-tab-body');
    if (!container) return;

    if (this.activeTab === 'overview') {
      this.renderOverview(container);
    } else if (this.activeTab === 'dna') {
      this.renderExpenseDNA(container);
    } else if (this.activeTab === 'leak') {
      this.renderMoneyLeakMap(container);
    } else if (this.activeTab === 'timemachine') {
      this.renderTimeMachine(container);
    } else if (this.activeTab === 'whatchanged') {
      this.renderWhatChanged(container);
    }
  },

  // 1. Overview & Interactive Charts
  async renderOverview(container) {
    try {
      const data = await window.LedgerAPI.getAnalytics(this.currentTimeframe);
      const user = window.LedgerApp.currentUser || {};
      const curr = data.currency || user.currency || '₹';

      if (!data.has_data) {
        container.innerHTML = `
          <div class="empty-state-card">
            <div class="empty-state-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--brand-teal)" stroke-width="2"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
            </div>
            <h3 class="empty-state-title">No Transaction Records to Analyze</h3>
            <p class="empty-state-desc">Add transactions over time to unlock spending trajectories, category breakdowns, and cashflow charts.</p>
            <button class="btn btn-primary" onclick="window.LedgerViews.quickAdd.open()">+ Add First Transaction</button>
          </div>
        `;
        return;
      }

      const s = data.summary || {};
      const cats = data.category_analytics || [];
      const incs = data.income_sources || [];

      container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
          <div>
            <h3 style="font-size:16px; margin:0 0 4px 0;">Cash Flow Trajectory</h3>
            <span style="font-size:12px; color:var(--text-muted);">Historical inflow vs outflow performance</span>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn ${this.currentTimeframe === 'monthly' ? 'btn-primary' : 'btn-secondary'}" style="font-size:12px; padding:4px 10px;" onclick="window.LedgerViews.analytics.setTimeframe('monthly')">Monthly</button>
            <button class="btn ${this.currentTimeframe === 'yearly' ? 'btn-primary' : 'btn-secondary'}" style="font-size:12px; padding:4px 10px;" onclick="window.LedgerViews.analytics.setTimeframe('yearly')">Yearly</button>
            <button class="btn ${this.currentTimeframe === 'daily' ? 'btn-primary' : 'btn-secondary'}" style="font-size:12px; padding:4px 10px;" onclick="window.LedgerViews.analytics.setTimeframe('daily')">Daily</button>
          </div>
        </div>

        <!-- Summary KPIs -->
        <div class="grid-cols-4" style="margin-bottom:20px;">
          <div class="card metric-card">
            <div class="metric-label">Total Inflow</div>
            <div class="metric-value privacy-mask" style="color:var(--brand-teal);">${curr}${s.total_income.toLocaleString()}</div>
          </div>
          <div class="card metric-card">
            <div class="metric-label">Total Outflow</div>
            <div class="metric-value privacy-mask" style="color:var(--brand-danger);">${curr}${s.total_expense.toLocaleString()}</div>
          </div>
          <div class="card metric-card">
            <div class="metric-label">Net Cash Flow</div>
            <div class="metric-value privacy-mask">${curr}${s.net_cashflow.toLocaleString()}</div>
          </div>
          <div class="card metric-card">
            <div class="metric-label">Savings Velocity</div>
            <div class="metric-value">${s.overall_savings_rate}%</div>
          </div>
        </div>

        <!-- Cash Flow Chart Container -->
        <div class="card" style="margin-bottom:20px;">
          <div id="analytics-cashflow-chart" class="chart-container" style="height:260px;"></div>
        </div>

        <!-- Breakdown Tables -->
        <div class="grid-cols-2" style="gap:20px;">
          <div class="card">
            <h3 style="font-size:15px; margin-bottom:12px;">Category Distribution</h3>
            <div class="data-table-wrapper" style="border:none;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Count</th>
                    <th style="text-align:right;">Total</th>
                    <th style="text-align:right;">Share</th>
                  </tr>
                </thead>
                <tbody>
                  ${cats.map(c => `
                    <tr>
                      <td style="display:flex; align-items:center; gap:8px;">
                        <span style="width:8px; height:8px; border-radius:50%; background:${c.color};"></span>
                        <strong>${c.category}</strong>
                      </td>
                      <td style="color:var(--text-muted);">${c.count}</td>
                      <td style="text-align:right;" class="privacy-mask">${curr}${c.total.toLocaleString()}</td>
                      <td style="text-align:right;">${c.percent}%</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <div class="card">
            <h3 style="font-size:15px; margin-bottom:12px;">Income Sources</h3>
            <div class="data-table-wrapper" style="border:none;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Count</th>
                    <th style="text-align:right;">Total</th>
                    <th style="text-align:right;">Share</th>
                  </tr>
                </thead>
                <tbody>
                  ${incs.map(inc => `
                    <tr>
                      <td><strong>${inc.source}</strong></td>
                      <td style="color:var(--text-muted);">${inc.count}</td>
                      <td style="text-align:right; color:var(--brand-teal);" class="privacy-mask">${curr}${inc.total.toLocaleString()}</td>
                      <td style="text-align:right;">${inc.percent}%</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      if (window.LedgerCharts && data.spending_trend.length > 0) {
        window.LedgerCharts.renderLineChart('analytics-cashflow-chart', data.spending_trend, curr);
      }
    } catch (err) {
      container.innerHTML = `<div class="card" style="color:var(--brand-danger);">${err.message}</div>`;
    }
  },

  setTimeframe(tf) {
    this.currentTimeframe = tf;
    this.loadActiveTab();
  },

  // 2. Expense DNA
  async renderExpenseDNA(container) {
    try {
      const res = await window.LedgerAPI.getExpenseDNA();
      const curr = res.currency || '₹';

      if (!res.has_data) {
        container.innerHTML = `
          <div class="empty-state-card">
            <h3 class="empty-state-title">Add Transactions to Unlock Expense DNA</h3>
            <p class="empty-state-desc">Expense DNA automatically detects behavioral habits, weekend biases, and merchant loyalties without judgment.</p>
          </div>
        `;
        return;
      }

      const patterns = res.dna_patterns || [];
      const ww = res.weekday_weekend || {};
      const merchants = res.merchant_patterns || [];
      const trends = res.category_trends || [];

      container.innerHTML = `
        <div style="margin-bottom:20px;">
          <h2 style="font-size:18px; margin:0 0 4px 0;">Behavioral Expense DNA</h2>
          <p style="font-size:13px; color:var(--text-secondary);">Objective patterns synthesized across ${res.total_analyzed_transactions} recorded transactions.</p>
        </div>

        <!-- Synthesized Behavioral Pattern Cards -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:16px; margin-bottom:24px;">
          ${patterns.map(p => `
            <div class="card" style="border-top:3px solid var(--brand-teal);">
              <div style="display:flex; justify-content:space-between; font-size:11px; text-transform:uppercase; color:var(--text-muted); margin-bottom:6px;">
                <span>${p.category}</span>
                <span style="color:var(--brand-teal); font-weight:600;">${p.frequency}</span>
              </div>
              <h3 style="font-size:15px; margin:0 0 8px 0;">${p.pattern}</h3>
              <p style="font-size:12px; color:var(--text-secondary); margin-bottom:8px;">${p.observation}</p>
              <div style="font-size:11px; background:rgba(255,255,255,0.03); padding:6px 10px; border-radius:4px; color:var(--text-muted);">
                ${p.neutral_insight}
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Weekday vs Weekend Analysis -->
        <div class="card" style="margin-bottom:24px;">
          <h3 style="font-size:15px; margin-bottom:12px;">Temporal Rhythm: Weekday vs Weekend</h3>
          <p style="font-size:13px; color:var(--text-secondary); margin-bottom:16px;">${ww.observation}</p>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
            <div style="background:rgba(255,255,255,0.02); padding:14px; border-radius:8px; border:1px solid var(--brand-border-subtle);">
              <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                <strong>Monday – Friday</strong>
                <span class="privacy-mask" style="color:var(--brand-teal); font-weight:700;">${curr}${ww.weekday_total?.toLocaleString()}</span>
              </div>
              <div style="font-size:12px; color:var(--text-muted);">${ww.weekday_count} transactions • Avg ${curr}${ww.weekday_average} • ${ww.weekday_percent}% of outflow</div>
            </div>

            <div style="background:rgba(255,255,255,0.02); padding:14px; border-radius:8px; border:1px solid var(--brand-border-subtle);">
              <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                <strong>Saturday – Sunday</strong>
                <span class="privacy-mask" style="color:var(--brand-blue); font-weight:700;">${curr}${ww.weekend_total?.toLocaleString()}</span>
              </div>
              <div style="font-size:12px; color:var(--text-muted);">${ww.weekend_count} transactions • Avg ${curr}${ww.weekend_average} • ${ww.weekend_percent}% of outflow</div>
            </div>
          </div>
        </div>

        <!-- Merchant Frequency Patterns -->
        <div class="card">
          <h3 style="font-size:15px; margin-bottom:12px;">Frequent Merchant Patterns</h3>
          <div class="data-table-wrapper" style="border:none;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Merchant</th>
                  <th>Category</th>
                  <th>Frequency</th>
                  <th>Average Ticket</th>
                  <th style="text-align:right;">Total Spend</th>
                  <th>Trend</th>
                </tr>
              </thead>
              <tbody>
                ${merchants.map(m => `
                  <tr>
                    <td><strong>${m.merchant}</strong></td>
                    <td style="color:var(--text-muted); font-size:12px;">${m.category}</td>
                    <td>${m.count} visits</td>
                    <td class="privacy-mask">${curr}${m.average.toLocaleString()}</td>
                    <td style="text-align:right;" class="privacy-mask"><strong>${curr}${m.total.toLocaleString()}</strong></td>
                    <td><span class="badge">${m.trend}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="card" style="color:var(--brand-danger);">${err.message}</div>`;
    }
  },

  // 3. Money Leak Map
  async renderMoneyLeakMap(container) {
    try {
      const res = await window.LedgerAPI.getExpenseDNA();
      const leaks = res.money_leaks || [];
      const curr = res.currency || '₹';

      if (leaks.length === 0) {
        container.innerHTML = `
          <div class="empty-state-card">
            <h3 class="empty-state-title">No Repeated Micro-Expenses Detected</h3>
            <p class="empty-state-desc">The Money Leak Map scans for small repeated outflows (under ${curr}500) to help you visualize cumulative impact neutrally.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div style="margin-bottom:20px;">
          <h2 style="font-size:18px; margin:0 0 4px 0;">Money Leak Map</h2>
          <p style="font-size:13px; color:var(--text-secondary);">Repeated small-ticket expenses aggregated to reveal monthly and yearly cumulative weight.</p>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:16px;">
          ${leaks.map((leak, idx) => `
            <div class="card" style="display:flex; flex-direction:column; justify-content:space-between;">
              <div>
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                  <div>
                    <h3 style="font-size:15px; margin:0 0 2px 0;">${leak.merchant}</h3>
                    <span style="font-size:11px; color:var(--text-muted);">${leak.category} • ${leak.frequency_label}</span>
                  </div>
                  <span class="badge" style="background:rgba(255,255,255,0.06);">${leak.transaction_count} txs</span>
                </div>

                <div style="background:rgba(255,255,255,0.02); border:1px solid var(--brand-border-subtle); border-radius:6px; padding:10px; margin:12px 0;">
                  <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
                    <span style="color:var(--text-muted);">Monthly Run-Rate:</span>
                    <strong class="privacy-mask" style="color:var(--brand-warning);">${curr}${leak.monthly_total.toLocaleString()}</strong>
                  </div>
                  <div style="display:flex; justify-content:space-between; font-size:12px;">
                    <span style="color:var(--text-muted);">Yearly Projected:</span>
                    <strong class="privacy-mask" style="color:var(--brand-teal);">${curr}${leak.estimated_yearly_total.toLocaleString()}</strong>
                  </div>
                </div>
              </div>

              <div style="display:flex; justify-content:space-between; align-items:center; padding-top:8px; border-top:1px solid var(--brand-border-subtle);">
                <span style="font-size:12px; color:var(--text-muted);">Avg ticket: <span class="privacy-mask">${curr}${leak.average_amount}</span></span>
                <button class="btn btn-secondary" style="font-size:11px; padding:3px 8px;" onclick="window.LedgerViews.analytics.viewLeakTransactions(${idx})">
                  Inspect Transactions (${leak.underlying_transactions.length})
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      this._currentLeaks = leaks;
    } catch (err) {
      container.innerHTML = `<div class="card" style="color:var(--brand-danger);">${err.message}</div>`;
    }
  },

  viewLeakTransactions(idx) {
    const leak = (this._currentLeaks || [])[idx];
    if (!leak) return;

    let modal = document.getElementById('leak-inspect-modal');
    if (modal) modal.remove();

    const curr = window.LedgerApp.currentUser?.currency || '₹';
    modal = document.createElement('div');
    modal.id = 'leak-inspect-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content" style="max-width:540px;">
        <div class="modal-header">
          <h3 class="modal-title">${leak.merchant} Transactions</h3>
          <button class="modal-close" onclick="document.getElementById('leak-inspect-modal').remove()">✕</button>
        </div>
        <div class="modal-body">
          <p style="font-size:12px; color:var(--text-muted); margin-bottom:14px;">
            ${leak.transaction_count} recorded expenses totaling ${curr}${leak.total_amount.toLocaleString()}.
          </p>
          <div style="max-height:300px; overflow-y:auto; display:flex; flex-direction:column; gap:8px;">
            ${leak.underlying_transactions.map(t => `
              <div style="display:flex; justify-content:space-between; padding:8px 12px; background:rgba(255,255,255,0.02); border-radius:6px; font-size:13px;">
                <div>
                  <strong>${t.date}</strong>
                  <div style="font-size:11px; color:var(--text-muted);">${t.payment_method || 'Card'} • ${t.notes || 'No note'}</div>
                </div>
                <strong class="privacy-mask" style="color:var(--brand-danger);">${curr}${t.amount}</strong>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },

  // 4. Financial Time Machine
  async renderTimeMachine(container) {
    const todayMonth = new Date().toISOString().slice(0, 7);
    container.innerHTML = `
      <div class="card" style="margin-bottom:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <h2 style="font-size:18px; margin:0 0 4px 0;">Financial Time Machine</h2>
            <p style="font-size:13px; color:var(--text-secondary);">Reconstruct your exact financial state and compare THEN vs NOW.</p>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            <label style="font-size:12px; color:var(--text-muted);">Historical Period:</label>
            <input type="month" id="tm-month-select" class="form-input" style="width:160px;" value="${todayMonth}" onchange="window.LedgerViews.analytics.fetchTimeMachine(this.value)">
          </div>
        </div>
      </div>

      <div id="time-machine-snapshot-content">
        <div style="text-align:center; padding:30px; color:var(--text-muted);">Loading snapshot...</div>
      </div>
    `;

    this.fetchTimeMachine(todayMonth);
  },

  async fetchTimeMachine(monthStr) {
    const stream = document.getElementById('time-machine-snapshot-content');
    if (!stream) return;

    try {
      const res = await window.LedgerAPI.getTimeMachineSnapshot(monthStr);
      const curr = res.currency || '₹';
      const tvn = res.then_vs_now || {};

      stream.innerHTML = `
        <!-- THEN vs NOW Comparative Grid -->
        <div class="card" style="margin-bottom:20px;">
          <h3 style="font-size:15px; margin-bottom:14px;">THEN (${monthStr}) vs NOW Comparison</h3>
          <div class="data-table-wrapper" style="border:none;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Financial Metric</th>
                  <th>Then (${monthStr})</th>
                  <th>Current State</th>
                  <th style="text-align:right;">Net Change</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Liquid Balance</strong></td>
                  <td class="privacy-mask">${curr}${tvn.balance?.then.toLocaleString()}</td>
                  <td class="privacy-mask">${curr}${tvn.balance?.now.toLocaleString()}</td>
                  <td style="text-align:right; font-weight:700; color:${tvn.balance?.delta>=0?'var(--brand-teal)':'var(--brand-danger)'};" class="privacy-mask">
                    ${tvn.balance?.delta>=0?'+':''}${curr}${tvn.balance?.delta.toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <td><strong>Net Worth</strong></td>
                  <td class="privacy-mask">${curr}${tvn.net_worth?.then.toLocaleString()}</td>
                  <td class="privacy-mask">${curr}${tvn.net_worth?.now.toLocaleString()}</td>
                  <td style="text-align:right; font-weight:700; color:${tvn.net_worth?.delta>=0?'var(--brand-teal)':'var(--brand-danger)'};" class="privacy-mask">
                    ${tvn.net_worth?.delta>=0?'+':''}${curr}${tvn.net_worth?.delta.toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <td><strong>Monthly Outflows</strong></td>
                  <td class="privacy-mask">${curr}${tvn.monthly_expenses?.then.toLocaleString()}</td>
                  <td class="privacy-mask">${curr}${tvn.monthly_expenses?.now.toLocaleString()}</td>
                  <td style="text-align:right; font-weight:700;" class="privacy-mask">
                    ${tvn.monthly_expenses?.delta>=0?'+':''}${curr}${tvn.monthly_expenses?.delta.toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <td><strong>Savings Rate</strong></td>
                  <td>${tvn.savings_rate?.then}%</td>
                  <td>${tvn.savings_rate?.now}%</td>
                  <td style="text-align:right;">${(tvn.savings_rate?.now - tvn.savings_rate?.then).toFixed(1)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Top Expenses That Period -->
        <div class="card">
          <h3 style="font-size:15px; margin-bottom:12px;">Top Outflows in ${monthStr}</h3>
          ${res.top_expenses.length === 0 ? `
            <div style="color:var(--text-muted); font-size:13px;">No expenses recorded during ${monthStr}.</div>
          ` : `
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${res.top_expenses.map(t => `
                <div style="display:flex; justify-content:space-between; padding:8px 12px; background:rgba(255,255,255,0.02); border-radius:6px; font-size:13px;">
                  <div>
                    <strong>${t.merchant || 'Expense'}</strong>
                    <span style="font-size:11px; color:var(--text-muted); margin-left:8px;">${t.date} • ${t.category_name}</span>
                  </div>
                  <strong class="privacy-mask" style="color:var(--brand-danger);">${curr}${t.amount.toLocaleString()}</strong>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      `;
    } catch (err) {
      stream.innerHTML = `<div class="card" style="color:var(--brand-danger);">${err.message}</div>`;
    }
  },

  // 5. What Changed?
  async renderWhatChanged(container) {
    const d = new Date();
    const currMonth = d.toISOString().slice(0, 7);
    d.setMonth(d.getMonth() - 1);
    const prevMonth = d.toISOString().slice(0, 7);

    container.innerHTML = `
      <div class="card" style="margin-bottom:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <h2 style="font-size:18px; margin:0 0 4px 0;">What Changed?</h2>
            <p style="font-size:13px; color:var(--text-secondary);">Comparative delta analysis with automated data-grounded explanations.</p>
          </div>
          <div style="display:flex; align-items:center; gap:8px; font-size:12px;">
            <input type="month" id="wc-period-a" class="form-input" style="width:140px;" value="${prevMonth}">
            <span>vs</span>
            <input type="month" id="wc-period-b" class="form-input" style="width:140px;" value="${currMonth}">
            <button class="btn btn-primary" onclick="window.LedgerViews.analytics.comparePeriods()">Compare</button>
          </div>
        </div>
      </div>

      <div id="what-changed-content">
        <div style="text-align:center; padding:30px; color:var(--text-muted);">Comparing periods...</div>
      </div>
    `;

    this.comparePeriods();
  },

  async comparePeriods() {
    const stream = document.getElementById('what-changed-content');
    if (!stream) return;

    const pA = document.getElementById('wc-period-a')?.value || '';
    const pB = document.getElementById('wc-period-b')?.value || '';

    try {
      const res = await window.LedgerAPI.getWhatChanged(pA, pB);
      const curr = res.currency || '₹';
      const s = res.summary || {};
      const shifts = res.category_shifts || [];

      stream.innerHTML = `
        <!-- AI Grounded Narrative Explanation -->
        <div class="card" style="background:rgba(6,214,160,0.06); border:1px solid rgba(6,214,160,0.2); margin-bottom:20px;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand-teal)" stroke-width="2"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/></svg>
            <h4 style="font-size:13px; font-weight:700; color:var(--brand-teal); margin:0;">AI Financial Shift Explanation</h4>
          </div>
          <p style="font-size:13px; line-height:1.5; color:var(--text-primary); margin:0;">
            ${res.ai_explanation}
          </p>
        </div>

        <!-- High-Level Change Metrics -->
        <div class="grid-cols-4" style="margin-bottom:20px;">
          <div class="card metric-card">
            <div class="metric-label">Inflow Delta</div>
            <div class="metric-value privacy-mask" style="color:${s.income?.diff>=0?'var(--brand-teal)':'var(--brand-danger)'};">
              ${s.income?.diff>=0?'+':''}${curr}${s.income?.diff.toLocaleString()}
            </div>
            <span style="font-size:11px; color:var(--text-muted);">${s.income?.percent_change}%</span>
          </div>

          <div class="card metric-card">
            <div class="metric-label">Outflow Delta</div>
            <div class="metric-value privacy-mask" style="color:${s.expenses?.diff<=0?'var(--brand-teal)':'var(--brand-danger)'};">
              ${s.expenses?.diff>=0?'+':''}${curr}${s.expenses?.diff.toLocaleString()}
            </div>
            <span style="font-size:11px; color:var(--text-muted);">${s.expenses?.percent_change}%</span>
          </div>

          <div class="card metric-card">
            <div class="metric-label">Net Savings Shift</div>
            <div class="metric-value privacy-mask" style="color:${s.net_savings?.diff>=0?'var(--brand-teal)':'var(--brand-danger)'};">
              ${s.net_savings?.diff>=0?'+':''}${curr}${s.net_savings?.diff.toLocaleString()}
            </div>
          </div>

          <div class="card metric-card">
            <div class="metric-label">Savings Rate Shift</div>
            <div class="metric-value">${s.savings_rate?.diff>=0?'+':''}${s.savings_rate?.diff}%</div>
          </div>
        </div>

        <!-- Category Shifts Table -->
        <div class="card">
          <h3 style="font-size:15px; margin-bottom:12px;">Category Shift Breakdown</h3>
          <div class="data-table-wrapper" style="border:none;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>${pA}</th>
                  <th>${pB}</th>
                  <th style="text-align:right;">Difference</th>
                  <th style="text-align:right;">% Change</th>
                </tr>
              </thead>
              <tbody>
                ${shifts.map(c => `
                  <tr>
                    <td><strong>${c.category}</strong></td>
                    <td class="privacy-mask">${curr}${c.a.toLocaleString()}</td>
                    <td class="privacy-mask">${curr}${c.b.toLocaleString()}</td>
                    <td style="text-align:right; font-weight:600; color:${c.diff>0?'var(--brand-danger)':'var(--brand-teal)'};" class="privacy-mask">
                      ${c.diff>0?'+':''}${curr}${c.diff.toLocaleString()}
                    </td>
                    <td style="text-align:right;">${c.percent_change}%</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (err) {
      stream.innerHTML = `<div class="card" style="color:var(--brand-danger);">${err.message}</div>`;
    }
  }
};
