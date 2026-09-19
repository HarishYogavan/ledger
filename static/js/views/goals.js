/**
 * LEDGER FINANCIAL GOALS VIEW
 */

window.LedgerViews = window.LedgerViews || {};

window.LedgerViews.goals = {
  async render(container) {
    container.innerHTML = `
      <div style="display:flex; justify-content:center; padding:60px;">
        <div style="color:var(--brand-teal); font-weight:600;">Loading Goals...</div>
      </div>
    `;

    try {
      const res = await window.LedgerAPI.getGoals();
      const user = window.LedgerApp.currentUser || {};
      const curr = user.currency || '₹';
      const goals = res.goals || [];

      container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; flex-wrap:wrap; gap:16px;">
          <div>
            <h1 style="font-size:24px; margin-bottom:4px;">Financial Goals</h1>
            <p style="font-size:13px; color:var(--text-secondary);">Set targets, monitor progress milestones, and plan your monthly contribution velocity</p>
          </div>
          <button class="btn btn-primary" onclick="window.LedgerViews.goals.openCreateGoalModal()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
            + Create New Goal
          </button>
        </div>

        ${goals.length > 0 ? `
          <div class="grid-cols-3" style="gap:20px;">
            ${goals.map(g => `
              <div class="card" style="display:flex; flex-direction:column; justify-content:space-between;">
                <div>
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                    <div>
                      <span class="badge badge-info" style="margin-bottom:6px; font-size:9px;">${g.category_tag}</span>
                      <h3 style="font-size:17px;">${g.name}</h3>
                    </div>
                    <span class="badge ${g.status === 'completed' ? 'badge-success' : (g.status === 'paused' ? 'badge-warning' : 'badge-info')}">
                      ${g.status}
                    </span>
                  </div>

                  <div style="margin:16px 0;">
                    <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:600; margin-bottom:6px;">
                      <span class="privacy-mask">${curr}${g.current_amount.toLocaleString()}</span>
                      <span style="color:var(--text-muted);">${curr}${g.target_amount.toLocaleString()}</span>
                    </div>
                    <div class="safety-meter">
                      <div class="safety-meter-fill" style="width:${g.progress_percent}%; background:linear-gradient(90deg, var(--brand-teal), var(--brand-blue));"></div>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-secondary); margin-top:6px;">
                      <span>${g.progress_percent}% Funded</span>
                      <span class="privacy-mask">${curr}${g.remaining_amount.toLocaleString()} Remaining</span>
                    </div>
                  </div>

                  <div style="display:flex; flex-direction:column; gap:4px; font-size:12px; color:var(--text-secondary); padding:10px; background:var(--brand-surface); border-radius:var(--radius-sm); margin-bottom:16px;">
                    <div style="display:flex; justify-content:space-between;">
                      <span>Target Date:</span>
                      <strong style="color:var(--text-primary);">${g.target_date}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between;">
                      <span>Planned Contribution:</span>
                      <strong style="color:var(--brand-teal);">${curr}${g.monthly_contribution.toLocaleString()}/mo</strong>
                    </div>
                  </div>
                </div>

                <div style="display:flex; gap:8px;">
                  <button class="btn btn-secondary" style="flex:1; font-size:12px; padding:6px 10px;" onclick="window.LedgerViews.goals.openDepositModal(${g.id}, '${g.name}')">
                    + Deposit
                  </button>
                  <button class="btn btn-secondary" style="font-size:12px; padding:6px 10px;" onclick="window.LedgerViews.goals.toggleStatus(${g.id}, '${g.status}')">
                    ${g.status === 'active' ? 'Pause' : 'Activate'}
                  </button>
                  <button class="btn-icon" style="color:var(--brand-danger);" onclick="window.LedgerViews.goals.confirmDelete(${g.id})">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        ` : `
          <div class="empty-state" style="margin-top:20px; padding:60px 24px;">
            <img src="/static/icons/logo-192.png" alt="Ledger Goals" class="empty-state-logo">
            <h2 class="empty-state-title">No Financial Goals Created</h2>
            <p class="empty-state-desc">
              Whether you are building an emergency fund, saving for a home, laptop, or vacation, define your goals to simulate your target milestones.
            </p>
            <button class="btn btn-primary" onclick="window.LedgerViews.goals.openCreateGoalModal()">
              + Create Your First Goal
            </button>
          </div>
        `}
      `;
    } catch (err) {
      container.innerHTML = `<div class="card" style="border-color:var(--brand-danger);">${err.message}</div>`;
    }
  },

  openCreateGoalModal() {
    let modal = document.getElementById('create-goal-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'create-goal-modal';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }

    const curr = window.LedgerApp.currentUser?.currency || '₹';

    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title">Create Financial Goal</h3>
          <button class="modal-close" onclick="document.getElementById('create-goal-modal').remove()">✕</button>
        </div>
        <div class="modal-body">
          <form onsubmit="window.LedgerViews.goals.handleCreateGoal(event)">
            <div class="form-group">
              <label class="form-label">Goal Name *</label>
              <input type="text" id="goal-name" class="form-control" placeholder="e.g. Emergency Fund, Laptop, Travel" required>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div class="form-group">
                <label class="form-label">Target Amount (${curr}) *</label>
                <input type="number" id="goal-target" class="form-control" placeholder="0.00" required>
              </div>
              <div class="form-group">
                <label class="form-label">Starting / Current Amount (${curr})</label>
                <input type="number" id="goal-current" class="form-control" placeholder="0.00" value="0">
              </div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div class="form-group">
                <label class="form-label">Target Date *</label>
                <input type="date" id="goal-date" class="form-control" required>
              </div>
              <div class="form-group">
                <label class="form-label">Planned Monthly Contribution (${curr})</label>
                <input type="number" id="goal-contrib" class="form-control" placeholder="0.00">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Category / Purpose</label>
              <select id="goal-tag" class="form-control">
                <option value="Savings">Savings & Emergency</option>
                <option value="Electronics">Electronics & Tools</option>
                <option value="Travel">Travel & Vacation</option>
                <option value="Education">Education & Learning</option>
                <option value="Vehicle">Vehicle & Mobility</option>
                <option value="Real Estate">Property & Housing</option>
                <option value="Custom">Custom Target</option>
              </select>
            </div>
            <div class="modal-footer" style="padding:12px 0 0 0;">
              <button type="button" class="btn btn-secondary" onclick="document.getElementById('create-goal-modal').remove()">Cancel</button>
              <button type="submit" class="btn btn-primary">Create Goal</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  async handleCreateGoal(e) {
    e.preventDefault();
    const name = document.getElementById('goal-name').value.trim();
    const target_amount = parseFloat(document.getElementById('goal-target').value);
    const current_amount = parseFloat(document.getElementById('goal-current').value) || 0;
    const target_date = document.getElementById('goal-date').value;
    const monthly_contribution = parseFloat(document.getElementById('goal-contrib').value) || 0;
    const category_tag = document.getElementById('goal-tag').value;

    try {
      await window.LedgerAPI.createGoal({
        name,
        target_amount,
        current_amount,
        target_date,
        monthly_contribution,
        category_tag
      });
      document.getElementById('create-goal-modal').remove();
      this.render(document.getElementById('view-container'));
    } catch (err) {
      alert(err.message || 'Failed to create goal');
    }
  },

  openDepositModal(id, name) {
    const amountStr = prompt(`Enter deposit amount toward "${name}":`);
    if (!amountStr) return;
    const amount = parseFloat(amountStr);
    if (!amount || amount <= 0) return alert('Invalid amount');

    window.LedgerAPI.depositGoal(id, amount).then(() => {
      this.render(document.getElementById('view-container'));
    }).catch(err => alert(err.message));
  },

  async toggleStatus(id, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    try {
      await window.LedgerAPI.updateGoal(id, { status: newStatus });
      this.render(document.getElementById('view-container'));
    } catch (err) {
      alert(err.message);
    }
  },

  async confirmDelete(id) {
    if (confirm('Delete this financial goal?')) {
      await window.LedgerAPI.deleteGoal(id);
      this.render(document.getElementById('view-container'));
    }
  }
};
