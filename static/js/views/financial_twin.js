/**
 * LEDGER FINANCIAL TWIN & SIMULATION SUITE
 * Tabs: Scenarios, Purchase Impact, Expense Forecast, Emergency Fund, Income Change, Life Events
 */

window.LedgerViews = window.LedgerViews || {};

window.LedgerViews.financialTwin = {
  activeTab: 'scenarios', // 'scenarios' | 'purchase' | 'forecast' | 'emergency' | 'income' | 'life'
  currentChanges: [],
  selectedScenarioId: null,

  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <div style="display:flex; align-items:center; gap:8px;">
            <h1 class="page-title">Financial Twin Simulator</h1>
            <span class="badge" style="background:rgba(6,214,160,0.1); color:var(--brand-teal); border:1px solid rgba(6,214,160,0.3);">Sandbox Mode</span>
          </div>
          <p class="page-subtitle">Project hypothetical decisions without altering real financial records. Strictly isolated projections.</p>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="tab-pills" style="margin-bottom: 20px; overflow-x: auto;">
        <button class="tab-pill ${this.activeTab==='scenarios'?'active':''}" onclick="window.LedgerViews.financialTwin.switchTab('scenarios')">
          What-If Scenarios
        </button>
        <button class="tab-pill ${this.activeTab==='purchase'?'active':''}" onclick="window.LedgerViews.financialTwin.switchTab('purchase')">
          Purchase Impact Analyzer
        </button>
        <button class="tab-pill ${this.activeTab==='forecast'?'active':''}" onclick="window.LedgerViews.financialTwin.switchTab('forecast')">
          Expense Forecast
        </button>
        <button class="tab-pill ${this.activeTab==='emergency'?'active':''}" onclick="window.LedgerViews.financialTwin.switchTab('emergency')">
          Emergency Fund Simulator
        </button>
        <button class="tab-pill ${this.activeTab==='income'?'active':''}" onclick="window.LedgerViews.financialTwin.switchTab('income')">
          Income Change Simulator
        </button>
        <button class="tab-pill ${this.activeTab==='life'?'active':''}" onclick="window.LedgerViews.financialTwin.switchTab('life')">
          Life Event Simulator
        </button>
      </div>

      <div id="twin-tab-body">
        <div style="text-align:center; padding: 40px; color: var(--brand-teal);">Initializing simulation suite...</div>
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
    const container = document.getElementById('twin-tab-body');
    if (!container) return;

    if (this.activeTab === 'scenarios') {
      this.renderScenarios(container);
    } else if (this.activeTab === 'purchase') {
      this.renderPurchaseAnalyzer(container);
    } else if (this.activeTab === 'forecast') {
      this.renderExpenseForecast(container);
    } else if (this.activeTab === 'emergency') {
      this.renderEmergencyFundSimulator(container);
    } else if (this.activeTab === 'income') {
      this.renderIncomeSimulator(container);
    } else if (this.activeTab === 'life') {
      this.renderLifeEventSimulator(container);
    }
  },

  // 1. Scenarios Sandbox
  async renderScenarios(container) {
    try {
      const data = await window.LedgerAPI.getScenarios();
      const user = window.LedgerApp.currentUser || {};
      const curr = user.currency || '₹';
      const scenarios = data.scenarios || [];

      if (this.currentChanges.length === 0) {
        this.currentChanges = [
          {
            change_type: 'one_off_expense',
            title: 'Hypothetical Purchase (e.g. Laptop)',
            amount: 50000,
            frequency: 'once',
            start_month_offset: 1
          }
        ];
      }

      container.innerHTML = `
        <div id="twin-delta-container"></div>

        <div style="display:grid; grid-template-columns:320px 1fr; gap:20px;">
          <!-- Controls -->
          <div>
            <div class="card" style="margin-bottom:16px;">
              <h3 style="font-size:15px; margin-bottom:12px;">Hypothetical Adjustments</h3>
              <div id="twin-changes-list" style="display:flex; flex-direction:column; gap:10px; margin-bottom:14px;">
                ${this.renderChangesInputs(curr)}
              </div>
              <div style="display:flex; gap:8px;">
                <button class="btn btn-secondary" style="flex:1; font-size:12px;" onclick="window.LedgerViews.financialTwin.addChangeItem()">
                  + Add Item
                </button>
                <button class="btn btn-primary" style="flex:1; font-size:12px;" onclick="window.LedgerViews.financialTwin.runSimulation()">
                  Recalculate
                </button>
              </div>
            </div>

            <!-- Saved Scenarios -->
            <div class="card">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h4 style="font-size:12px; text-transform:uppercase; color:var(--text-muted); margin:0;">Saved Scenarios</h4>
                <button class="btn btn-secondary" style="font-size:11px; padding:3px 8px;" onclick="window.LedgerViews.financialTwin.openSaveScenarioModal()">Save</button>
              </div>
              <div style="display:flex; flex-direction:column; gap:6px;">
                ${scenarios.map(s => `
                  <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; background:rgba(255,255,255,0.02); border-radius:6px; font-size:12px;">
                    <div>
                      <strong>${s.name}</strong>
                      <div style="font-size:10px; color:var(--text-muted);">${s.changes.length} adjustment(s)</div>
                    </div>
                    <button class="btn-icon" style="color:var(--brand-danger);" onclick="window.LedgerViews.financialTwin.deleteScenario(${s.id})">✕</button>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- Chart & Results -->
          <div>
            <div class="card" style="margin-bottom:20px;">
              <h3 style="font-size:15px; margin-bottom:12px;">12-Month Twin Projection</h3>
              <div id="twin-projection-chart" class="chart-container" style="height:280px;"></div>
            </div>

            <div class="card">
              <h3 style="font-size:15px; margin-bottom:12px;">Goal Impact Assessment</h3>
              <div id="twin-goal-impacts-stream"></div>
            </div>
          </div>
        </div>
      `;

      this.runSimulation();
    } catch (err) {
      container.innerHTML = `<div class="card" style="color:var(--brand-danger);">${err.message}</div>`;
    }
  },

  renderChangesInputs(curr) {
    return this.currentChanges.map((ch, idx) => `
      <div style="background:rgba(255,255,255,0.02); border:1px solid var(--brand-border-subtle); border-radius:8px; padding:10px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
          <input type="text" class="form-input" style="font-size:12px; padding:4px 8px;" value="${ch.title}" onchange="window.LedgerViews.financialTwin.updateChange(${idx}, 'title', this.value)">
          <button class="btn-icon" style="color:var(--brand-danger);" onclick="window.LedgerViews.financialTwin.removeChange(${idx})">✕</button>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <select class="form-select" style="font-size:11px; padding:4px 8px;" onchange="window.LedgerViews.financialTwin.updateChange(${idx}, 'change_type', this.value)">
            <option value="one_off_expense" ${ch.change_type==='one_off_expense'?'selected':''}>One-Off Expense</option>
            <option value="income_change" ${ch.change_type==='income_change'?'selected':''}>Income Change</option>
            <option value="recurring_expense" ${ch.change_type==='recurring_expense'?'selected':''}>Recurring Outflow</option>
          </select>
          <input type="number" class="form-input" style="font-size:12px; padding:4px 8px;" value="${ch.amount}" onchange="window.LedgerViews.financialTwin.updateChange(${idx}, 'amount', parseFloat(this.value)||0)">
        </div>
      </div>
    `).join('');
  },

  addChangeItem() {
    this.currentChanges.push({
      change_type: 'one_off_expense',
      title: 'New What-If Item',
      amount: 10000,
      frequency: 'once',
      start_month_offset: 0
    });
    const el = document.getElementById('twin-changes-list');
    if (el) el.innerHTML = this.renderChangesInputs(window.LedgerApp.currentUser?.currency || '₹');
  },

  updateChange(idx, field, val) {
    if (this.currentChanges[idx]) this.currentChanges[idx][field] = val;
  },

  removeChange(idx) {
    this.currentChanges.splice(idx, 1);
    const el = document.getElementById('twin-changes-list');
    if (el) el.innerHTML = this.renderChangesInputs(window.LedgerApp.currentUser?.currency || '₹');
    this.runSimulation();
  },

  async runSimulation() {
    const deltaEl = document.getElementById('twin-delta-container');
    const chartEl = document.getElementById('twin-projection-chart');
    const goalsEl = document.getElementById('twin-goal-impacts-stream');
    if (!deltaEl) return;

    try {
      const res = await window.LedgerAPI.simulateChanges(this.currentChanges, 12);
      const curr = res.baseline_summary?.currency || '₹';
      const netDiff = res.net_difference;
      const isPositive = netDiff >= 0;

      deltaEl.innerHTML = `
        <div class="card" style="margin-bottom:20px; background:rgba(255,255,255,0.02); border-left:4px solid ${isPositive?'var(--brand-teal)':'var(--brand-danger)'};">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
            <div>
              <div style="font-size:12px; text-transform:uppercase; color:var(--text-muted);">12-Month Net Variance vs Current Trajectory</div>
              <div class="privacy-mask" style="font-size:24px; font-weight:700; color:${isPositive?'var(--brand-teal)':'var(--brand-danger)'};">
                ${isPositive?'+':''}${curr}${netDiff.toLocaleString()}
              </div>
            </div>
            <div style="font-size:12px; color:var(--text-secondary); text-align:right;">
              Simulated Final Balance: <strong class="privacy-mask" style="color:var(--text-primary);">${curr}${res.final_simulated_balance.toLocaleString()}</strong><br/>
              Baseline Final Balance: <span class="privacy-mask">${curr}${res.final_baseline_balance.toLocaleString()}</span>
            </div>
          </div>
        </div>
      `;

      if (chartEl && window.LedgerCharts) {
        window.LedgerCharts.renderTwinComparison(chartEl.id, res.baseline_timeline, res.simulated_timeline, curr);
      }

      if (goalsEl) {
        goalsEl.innerHTML = (res.goal_impacts || []).map(g => `
          <div style="display:flex; justify-content:space-between; padding:8px 12px; background:rgba(255,255,255,0.02); border-radius:6px; margin-bottom:6px; font-size:13px;">
            <strong>${g.goal_name}</strong>
            <span class="badge" style="background:${g.simulation_impact.includes('delayed')?'rgba(255,209,102,0.1)':'rgba(6,214,160,0.1)'}; color:${g.simulation_impact.includes('delayed')?'var(--brand-warning)':'var(--brand-teal)'};">
              ${g.simulation_impact}
            </span>
          </div>
        `).join('') || '<div style="color:var(--text-muted); font-size:12px;">No active goals tracked.</div>';
      }
    } catch (e) {
      console.error(e);
    }
  },

  openSaveScenarioModal() {
    let modal = document.getElementById('twin-save-modal');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'twin-save-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content" style="max-width:400px;">
        <div class="modal-header">
          <h3 class="modal-title">Save Scenario</h3>
          <button class="modal-close" onclick="document.getElementById('twin-save-modal').remove()">✕</button>
        </div>
        <form onsubmit="window.LedgerViews.financialTwin.handleSaveScenario(event)">
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Scenario Name *</label>
              <input type="text" id="ts-name" class="form-input" placeholder="e.g. Relocation to Bangalore" required>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('twin-save-modal').remove()">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Scenario</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  },

  async handleSaveScenario(e) {
    e.preventDefault();
    const name = document.getElementById('ts-name').value.trim();
    try {
      await window.LedgerAPI.createScenario({
        name,
        changes: this.currentChanges
      });
      document.getElementById('twin-save-modal').remove();
      this.loadActiveTab();
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  },

  async deleteScenario(id) {
    if (!confirm('Delete this scenario?')) return;
    try {
      await window.LedgerAPI.deleteScenario(id);
      this.loadActiveTab();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  },

  // 2. Purchase Impact Analyzer
  renderPurchaseAnalyzer(container) {
    const today = new Date().toISOString().split('T')[0];
    container.innerHTML = `
      <div style="display:grid; grid-template-columns:360px 1fr; gap:20px;">
        <div class="card">
          <h3 style="font-size:16px; margin-bottom:12px;">Analyze Planned Purchase</h3>
          <form onsubmit="window.LedgerViews.financialTwin.handleAnalyzePurchase(event)">
            <div class="form-group">
              <label class="form-label">Item / Service Name *</label>
              <input type="text" id="pa-name" class="form-input" placeholder="e.g. Herman Miller Chair" required>
            </div>
            <div class="form-group">
              <label class="form-label">Price *</label>
              <input type="number" step="any" id="pa-price" class="form-input" placeholder="0.00" required>
            </div>
            <div class="form-group">
              <label class="form-label">Planned Date</label>
              <input type="date" id="pa-date" class="form-input" value="${today}">
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%;">Evaluate Impact</button>
          </form>
        </div>

        <div id="purchase-analysis-results">
          <div class="empty-state-card">
            <h3 class="empty-state-title">Enter a Purchase to Evaluate</h3>
            <p class="empty-state-desc">Ledger tests planned purchases against your real available reserves and upcoming obligations neutrally, without lecturing you.</p>
          </div>
        </div>
      </div>
    `;
  },

  async handleAnalyzePurchase(e) {
    e.preventDefault();
    const stream = document.getElementById('purchase-analysis-results');
    if (!stream) return;

    const name = document.getElementById('pa-name').value.trim();
    const price = parseFloat(document.getElementById('pa-price').value);
    const date = document.getElementById('pa-date').value;

    try {
      const res = await window.LedgerAPI.analyzePurchase(name, price, date);
      const curr = res.currency || '₹';

      stream.innerHTML = `
        <div class="card" style="border-left:4px solid var(--brand-teal); margin-bottom:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h3 style="font-size:16px; margin:0;">${res.item_name} Evaluation</h3>
            <span class="badge" style="background:rgba(6,214,160,0.1); color:var(--brand-teal);">${res.safety_rating}</span>
          </div>
          <p style="font-size:13px; line-height:1.5; color:var(--text-secondary); margin-bottom:16px;">
            ${res.explanation}
          </p>

          <div class="grid-cols-3" style="gap:12px;">
            <div style="background:rgba(255,255,255,0.02); padding:10px; border-radius:6px;">
              <div style="font-size:11px; color:var(--text-muted);">Current Liquid Reserve</div>
              <div class="privacy-mask" style="font-size:15px; font-weight:700;">${curr}${res.current_available_funds.toLocaleString()}</div>
            </div>
            <div style="background:rgba(255,255,255,0.02); padding:10px; border-radius:6px;">
              <div style="font-size:11px; color:var(--text-muted);">Known Upcoming Bills (30d)</div>
              <div class="privacy-mask" style="font-size:15px; font-weight:700; color:var(--brand-danger);">${curr}${res.upcoming_known_obligations.toLocaleString()}</div>
            </div>
            <div style="background:rgba(255,255,255,0.02); padding:10px; border-radius:6px;">
              <div style="font-size:11px; color:var(--text-muted);">Buffer After Obligations</div>
              <div class="privacy-mask" style="font-size:15px; font-weight:700; color:var(--brand-teal);">${curr}${res.buffer_after_known_obligations.toLocaleString()}</div>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      stream.innerHTML = `<div class="card" style="color:var(--brand-danger);">${err.message}</div>`;
    }
  },

  // 3. Expense Forecast
  async renderExpenseForecast(container) {
    container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted);">Computing forecast...</div>`;
    try {
      const res = await window.LedgerAPI.getForecast(30);
      const curr = res.currency || '₹';
      const items = res.forecast_items || [];

      container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
          <div>
            <h2 style="font-size:18px; margin:0 0 4px 0;">30-Day Expense Forecast</h2>
            <p style="font-size:13px; color:var(--text-secondary);">Projections grounded strictly in historical run-rates, scheduled bills, and active commitments.</p>
          </div>
          <div class="card" style="padding:10px 16px;">
            <div style="font-size:11px; text-transform:uppercase; color:var(--text-muted);">Projected Outflow (Next 30 Days)</div>
            <div class="privacy-mask" style="font-size:18px; font-weight:700; color:var(--brand-warning);">${curr}${res.total_estimated_outflow.toLocaleString()}</div>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:10px;">
          ${items.map(item => `
            <div class="card" style="padding:12px 16px; display:flex; justify-content:space-between; align-items:center; font-size:13px;">
              <div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <strong>${item.title}</strong>
                  <span class="badge" style="background:rgba(255,209,102,0.1); color:var(--brand-warning); font-size:10px;">Estimated</span>
                </div>
                <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
                  ${item.type} • Expected: ${item.expected_date} • Basis: ${item.historical_basis}
                </div>
              </div>
              <div class="privacy-mask" style="font-size:15px; font-weight:700; color:var(--text-primary);">
                ${curr}${item.estimated_amount.toLocaleString()}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="card" style="color:var(--brand-danger);">${err.message}</div>`;
    }
  },

  // 4. Emergency Fund Simulator
  async renderEmergencyFundSimulator(container) {
    container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted);">Initializing simulator...</div>`;
    try {
      const res = await window.LedgerAPI.simulateEmergencyFund();
      const curr = res.currency || '₹';

      container.innerHTML = `
        <div class="card" style="margin-bottom:20px;">
          <h2 style="font-size:18px; margin:0 0 4px 0;">Emergency Fund Safety Simulator</h2>
          <p style="font-size:13px; color:var(--text-secondary); margin-bottom:16px;">
            Compare funding pacing across contribution tiers to secure a 3 to 6-month buffer (${curr}${res.monthly_expense_basis.toLocaleString()}/month run-rate).
          </p>

          <div class="grid-cols-3" style="gap:12px; margin-bottom:20px;">
            <div style="background:rgba(255,255,255,0.02); padding:10px; border-radius:6px;">
              <div style="font-size:11px; color:var(--text-muted);">Current Liquid Reserve</div>
              <div class="privacy-mask" style="font-size:16px; font-weight:700;">${curr}${res.current_amount.toLocaleString()}</div>
            </div>
            <div style="background:rgba(255,255,255,0.02); padding:10px; border-radius:6px;">
              <div style="font-size:11px; color:var(--text-muted);">Recommended 3-Month Target</div>
              <div class="privacy-mask" style="font-size:16px; font-weight:700; color:var(--brand-blue);">${curr}${res.recommended_3_months.toLocaleString()}</div>
            </div>
            <div style="background:rgba(255,255,255,0.02); padding:10px; border-radius:6px;">
              <div style="font-size:11px; color:var(--text-muted);">Recommended 6-Month Target</div>
              <div class="privacy-mask" style="font-size:16px; font-weight:700; color:var(--brand-teal);">${curr}${res.recommended_6_months.toLocaleString()}</div>
            </div>
          </div>

          <h3 style="font-size:15px; margin-bottom:12px;">Contribution Scenarios to Reach Target (${curr}${res.target_amount.toLocaleString()})</h3>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:14px;">
            ${res.scenarios.map(sc => `
              <div class="card" style="border:1px solid var(--brand-border-subtle); padding:14px; background:rgba(255,255,255,0.02);">
                <div style="font-size:11px; color:var(--text-muted);">Monthly Contribution</div>
                <div class="privacy-mask" style="font-size:18px; font-weight:700; color:var(--brand-teal); margin-bottom:6px;">
                  ${curr}${sc.monthly_contribution.toLocaleString()}/mo
                </div>
                <div style="font-size:13px; margin-bottom:4px;">
                  Time: <strong>${sc.months_to_target} months</strong>
                </div>
                <div style="font-size:11px; color:var(--text-muted); margin-bottom:6px;">
                  Est. Completion: <strong>${sc.estimated_completion_date}</strong>
                </div>
                <div style="font-size:10px; color:var(--text-secondary); background:rgba(255,255,255,0.03); padding:4px 6px; border-radius:4px;">
                  ${sc.feasibility_note}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="card" style="color:var(--brand-danger);">${err.message}</div>`;
    }
  },

  // 5. Income Change Simulator
  renderIncomeSimulator(container) {
    const user = window.LedgerApp.currentUser || {};
    const curr = user.currency || '₹';

    container.innerHTML = `
      <div style="display:grid; grid-template-columns:340px 1fr; gap:20px;">
        <div class="card">
          <h3 style="font-size:16px; margin-bottom:12px;">Simulate Income Delta</h3>
          <p style="font-size:12px; color:var(--text-secondary); margin-bottom:14px;">
            Test the impact of a salary hike, freelancing income, or temporary career break.
          </p>
          <form onsubmit="window.LedgerViews.financialTwin.handleIncomeSim(event)">
            <div class="form-group">
              <label class="form-label">Monthly Income Change (${curr}) *</label>
              <input type="number" step="any" id="is-delta" class="form-input" placeholder="e.g. 15000 or -20000" required>
            </div>
            <div class="form-group">
              <label class="form-label">Description / Label</label>
              <input type="text" id="is-label" class="form-input" placeholder="e.g. Promotion, Sabbatical">
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%;">Run Simulation</button>
          </form>
        </div>

        <div id="income-sim-stream">
          <div class="empty-state-card">
            <h3 class="empty-state-title">Income Simulation Results</h3>
            <p class="empty-state-desc">Enter an income delta on the left to observe 12-month trajectory effects without touching real records.</p>
          </div>
        </div>
      </div>
    `;
  },

  async handleIncomeSim(e) {
    e.preventDefault();
    const stream = document.getElementById('income-sim-stream');
    if (!stream) return;

    const delta = parseFloat(document.getElementById('is-delta').value);
    const label = document.getElementById('is-label').value.trim() || 'Income Adjustment';

    try {
      const res = await window.LedgerAPI.simulateIncomeChange(delta, 12, label);
      const curr = res.currency || '₹';

      stream.innerHTML = `
        <div class="card" style="border-left:4px solid var(--brand-teal); margin-bottom:16px;">
          <h3 style="font-size:16px; margin-bottom:10px;">${res.change_label}</h3>
          <div class="grid-cols-3" style="gap:12px; margin-bottom:14px;">
            <div style="background:rgba(255,255,255,0.02); padding:10px; border-radius:6px;">
              <div style="font-size:11px; color:var(--text-muted);">Baseline Income</div>
              <div class="privacy-mask" style="font-size:15px; font-weight:700;">${curr}${res.baseline_monthly_income.toLocaleString()}/mo</div>
            </div>
            <div style="background:rgba(255,255,255,0.02); padding:10px; border-radius:6px;">
              <div style="font-size:11px; color:var(--text-muted);">Simulated Income</div>
              <div class="privacy-mask" style="font-size:15px; font-weight:700; color:var(--brand-teal);">${curr}${res.simulated_monthly_income.toLocaleString()}/mo</div>
            </div>
            <div style="background:rgba(255,255,255,0.02); padding:10px; border-radius:6px;">
              <div style="font-size:11px; color:var(--text-muted);">Simulated Monthly Surplus</div>
              <div class="privacy-mask" style="font-size:15px; font-weight:700;">${curr}${res.simulated_monthly_surplus.toLocaleString()}/mo</div>
            </div>
          </div>
          <div style="font-size:13px; color:var(--text-secondary);">
            12-Month Net Cumulative Balance Shift: <strong class="privacy-mask" style="color:${res.twin_simulation?.net_difference>=0?'var(--brand-teal)':'var(--brand-danger)'};">${curr}${res.twin_simulation?.net_difference.toLocaleString()}</strong>
          </div>
        </div>
      `;
    } catch (err) {
      stream.innerHTML = `<div class="card" style="color:var(--brand-danger);">${err.message}</div>`;
    }
  },

  // 6. Life Event Simulator
  async renderLifeEventSimulator(container) {
    try {
      const res = await window.LedgerAPI.getLifeEvents();
      const events = res.life_events || [];
      const user = window.LedgerApp.currentUser || {};
      const curr = user.currency || '₹';

      container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <div>
            <h2 style="font-size:18px; margin:0 0 4px 0;">Life Event Simulator</h2>
            <p style="font-size:13px; color:var(--text-secondary);">Separate actual financial records from user estimates to model milestone events.</p>
          </div>
          <button class="btn btn-primary" onclick="window.LedgerViews.financialTwin.openAddLifeEventModal()">+ Simulate Life Event</button>
        </div>

        ${events.length === 0 ? `
          <div class="empty-state-card">
            <h3 class="empty-state-title">No Life Events Modeled</h3>
            <p class="empty-state-desc">Model college, vehicle purchases, home relocation, or weddings to see the projected 12-month financial impact.</p>
            <button class="btn btn-primary" onclick="window.LedgerViews.financialTwin.openAddLifeEventModal()">+ Model First Event</button>
          </div>
        ` : `
          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:16px;">
            ${events.map(ev => `
              <div class="card" style="display:flex; flex-direction:column; justify-content:space-between;">
                <div>
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                    <div>
                      <h3 style="font-size:16px; margin:0 0 4px 0;">${ev.name}</h3>
                      <span class="badge" style="background:rgba(255,255,255,0.06); text-transform:uppercase; font-size:10px;">${ev.event_type}</span>
                    </div>
                    <button class="btn-icon" style="color:var(--brand-danger);" onclick="window.LedgerViews.financialTwin.deleteLifeEvent(${ev.id})">✕</button>
                  </div>
                  <div style="font-size:12px; color:var(--text-muted); margin-bottom:10px;">Target Date: ${ev.target_date}</div>

                  <div style="background:rgba(255,255,255,0.02); border:1px solid var(--brand-border-subtle); border-radius:6px; padding:10px; margin-bottom:12px;">
                    <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
                      <span style="color:var(--text-muted);">Estimated Upfront Cost:</span>
                      <strong class="privacy-mask">${curr}${ev.cost.toLocaleString()}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
                      <span style="color:var(--text-muted);">Recurring Monthly Delta:</span>
                      <strong class="privacy-mask">${curr}${ev.recurring_cost_delta.toLocaleString()}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:12px;">
                      <span style="color:var(--text-muted);">Monthly Income Delta:</span>
                      <strong class="privacy-mask">${curr}${ev.income_delta.toLocaleString()}</strong>
                    </div>
                  </div>
                </div>

                ${ev.notes ? `<div style="font-size:12px; color:var(--text-secondary);">${ev.notes}</div>` : ''}
              </div>
            `).join('')}
          </div>
        `}
      `;
    } catch (err) {
      container.innerHTML = `<div class="card" style="color:var(--brand-danger);">${err.message}</div>`;
    }
  },

  openAddLifeEventModal() {
    let modal = document.getElementById('life-event-modal');
    if (modal) modal.remove();

    const today = new Date().toISOString().split('T')[0];
    modal = document.createElement('div');
    modal.id = 'life-event-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content" style="max-width:460px;">
        <div class="modal-header">
          <h3 class="modal-title">Model Life Event</h3>
          <button class="modal-close" onclick="document.getElementById('life-event-modal').remove()">✕</button>
        </div>
        <form onsubmit="window.LedgerViews.financialTwin.handleCreateLifeEvent(event)">
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Event Name *</label>
              <input type="text" id="le-name" class="form-input" placeholder="e.g. Master's Degree, Relocation to Pune" required>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div class="form-group">
                <label class="form-label">Event Type</label>
                <select id="le-type" class="form-select">
                  <option value="education">Education / College</option>
                  <option value="travel">Extended Travel</option>
                  <option value="relocation">Relocation / Moving</option>
                  <option value="vehicle">Vehicle Purchase</option>
                  <option value="large_purchase">Major Asset</option>
                  <option value="custom">Custom Milestone</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Target Date *</label>
                <input type="date" id="le-date" class="form-input" value="${today}" required>
              </div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div class="form-group">
                <label class="form-label">Upfront Cost</label>
                <input type="number" step="any" id="le-cost" class="form-input" placeholder="0.00" value="0">
              </div>
              <div class="form-group">
                <label class="form-label">Monthly Expense Delta</label>
                <input type="number" step="any" id="le-rec-cost" class="form-input" placeholder="0.00" value="0">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Monthly Income Delta</label>
              <input type="number" step="any" id="le-inc-delta" class="form-input" placeholder="0.00" value="0">
            </div>
            <div class="form-group">
              <label class="form-label">Notes</label>
              <textarea id="le-notes" class="form-input" rows="2" placeholder="Assumptions, financing options..."></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('life-event-modal').remove()">Cancel</button>
            <button type="submit" class="btn btn-primary">Simulate & Save</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  },

  async handleCreateLifeEvent(e) {
    e.preventDefault();
    const payload = {
      name: document.getElementById('le-name').value.trim(),
      event_type: document.getElementById('le-type').value,
      target_date: document.getElementById('le-date').value,
      cost: parseFloat(document.getElementById('le-cost').value || 0),
      recurring_cost_delta: parseFloat(document.getElementById('le-rec-cost').value || 0),
      income_delta: parseFloat(document.getElementById('le-inc-delta').value || 0),
      notes: document.getElementById('le-notes').value.trim(),
    };
    try {
      await window.LedgerAPI.createLifeEvent(payload);
      document.getElementById('life-event-modal').remove();
      this.loadActiveTab();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  },

  async deleteLifeEvent(id) {
    if (!confirm('Delete this life event?')) return;
    try {
      await window.LedgerAPI.deleteLifeEvent(id);
      this.loadActiveTab();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  }
};
