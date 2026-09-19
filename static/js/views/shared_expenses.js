/**
 * SHARED EXPENSES WORKSPACES VIEW
 */

window.LedgerViews = window.LedgerViews || {};

window.LedgerViews.sharedExpenses = {
  activeWorkspaceId: null,

  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Shared Expenses</h1>
          <p class="page-subtitle">Collaborative expense workspaces for families, roommates, trips, and group projects.</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-secondary" onclick="window.LedgerViews.sharedExpenses.openCreateWorkspaceModal()">
            + New Workspace
          </button>
        </div>
      </div>

      <div id="shared-workspaces-content">
        <div style="text-align: center; padding: 40px; color: var(--text-muted);">Loading workspaces...</div>
      </div>
    `;

    this.loadWorkspaces();
  },

  async loadWorkspaces() {
    const container = document.getElementById('shared-workspaces-content');
    if (!container) return;

    try {
      const res = await window.LedgerAPI.getWorkspaces();
      const workspaces = res.workspaces || [];

      if (workspaces.length === 0) {
        container.innerHTML = `
          <div class="empty-state-card">
            <div class="empty-state-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--brand-teal)" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <h3 class="empty-state-title">No Shared Workspaces Yet</h3>
            <p class="empty-state-desc">Create a workspace for your flatmates, vacation crew, or family. Split bills fairly without exposing private finances.</p>
            <button class="btn btn-primary" onclick="window.LedgerViews.sharedExpenses.openCreateWorkspaceModal()">+ Create Workspace</button>
          </div>
        `;
        return;
      }

      if (!this.activeWorkspaceId || !workspaces.some(w => w.id === this.activeWorkspaceId)) {
        this.activeWorkspaceId = workspaces[0].id;
      }

      this.renderWorkspace(container, workspaces);
    } catch (err) {
      container.innerHTML = `<div class="card" style="color:var(--brand-danger);">Failed to load workspaces: ${err.message}</div>`;
    }
  },

  async renderWorkspace(container, workspaces) {
    const activeWs = workspaces.find(w => w.id === this.activeWorkspaceId) || workspaces[0];

    // Fetch full workspace details
    let details = null;
    try {
      details = await window.LedgerAPI.getWorkspaceDetails(activeWs.id);
    } catch (e) {
      container.innerHTML = `<div class="card" style="color:var(--brand-danger);">${e.message}</div>`;
      return;
    }

    const ws = details.workspace;
    const balances = details.balances || [];
    const expenses = details.expenses || [];
    const settlements = details.settlements || [];
    const curr = ws.currency || '₹';

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: 280px 1fr; gap: 20px;">
        <!-- Left: Workspace Switcher -->
        <div>
          <div class="card" style="margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <h4 style="font-size: 12px; text-transform: uppercase; color: var(--text-muted); margin: 0;">Workspaces</h4>
              <button class="btn-icon" title="New Workspace" onclick="window.LedgerViews.sharedExpenses.openCreateWorkspaceModal()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              ${workspaces.map(w => `
                <button class="btn ${w.id === activeWs.id ? 'btn-primary' : 'btn-secondary'}" style="text-align: left; justify-content: space-between; font-size: 13px;" onclick="window.LedgerViews.sharedExpenses.selectWorkspace(${w.id})">
                  <span>${w.name}</span>
                  <span style="font-size: 11px; opacity: 0.8;">${w.members.length} members</span>
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Members List Card -->
          <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <h4 style="font-size: 12px; text-transform: uppercase; color: var(--text-muted); margin: 0;">Members</h4>
              <button class="btn-icon" title="Invite Member" onclick="window.LedgerViews.sharedExpenses.openInviteModal(${ws.id})">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
              </button>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${ws.members.map(m => `
                <div style="display: flex; align-items: center; justify-content: space-between; font-size: 13px;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 26px; height: 26px; border-radius: 50%; background: var(--brand-teal); color: #070D1E; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 11px;">
                      ${m.display_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div>${m.display_name}</div>
                      <div style="font-size: 10px; color: var(--text-muted);">${m.email}</div>
                    </div>
                  </div>
                  ${m.role === 'owner' ? '<span class="badge" style="font-size: 9px;">Owner</span>' : ''}
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Right: Balances, Action Bar, and Expenses Stream -->
        <div>
          <!-- Workspace Overview Banner -->
          <div class="card" style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 16px;">
              <div>
                <h2 style="font-size: 20px; margin: 0 0 4px 0;">${ws.name}</h2>
                <div style="font-size: 13px; color: var(--text-secondary);">${ws.description || 'No description'} • Invite Code: <code style="color:var(--brand-teal);">${ws.invite_code}</code></div>
              </div>
              <div style="display: flex; gap: 10px;">
                <button class="btn btn-secondary" onclick="window.LedgerViews.sharedExpenses.openSettleModal(${ws.id}, ${JSON.stringify(ws.members).replace(/"/g, '&quot;')})">
                  Settle Balance
                </button>
                <button class="btn btn-primary" onclick="window.LedgerViews.sharedExpenses.openAddExpenseModal(${ws.id}, ${JSON.stringify(ws.members).replace(/"/g, '&quot;')})">
                  + Add Shared Expense
                </button>
              </div>
            </div>

            <!-- Net Settlement Matrix -->
            <h4 style="font-size: 12px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 10px;">Current Settlement Balances</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
              ${balances.map(b => {
                const isPositive = b.net_balance > 0;
                const isNegative = b.net_balance < 0;
                const statusColor = isPositive ? 'var(--brand-teal)' : (isNegative ? 'var(--brand-danger)' : 'var(--text-muted)');
                return `
                  <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--brand-border-subtle); border-radius: 8px; padding: 10px 14px;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">${b.display_name}</div>
                    <div class="privacy-mask" style="font-size: 16px; font-weight: 700; color: ${statusColor};">
                      ${isPositive ? '+' : ''}${curr}${Math.abs(b.net_balance).toLocaleString()}
                    </div>
                    <div style="font-size: 10px; color: ${statusColor}; text-transform: uppercase; font-weight: 600; margin-top: 2px;">
                      ${b.status}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Expenses List -->
          <div class="card">
            <h3 style="font-size: 15px; margin-bottom: 14px;">Recorded Expenses (${expenses.length})</h3>
            ${expenses.length === 0 ? `
              <div style="text-align: center; padding: 30px; color: var(--text-muted); font-size: 13px;">
                No shared expenses logged in this workspace yet.
              </div>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 10px;">
                ${expenses.map(e => `
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: rgba(255,255,255,0.02); border: 1px solid var(--brand-border-subtle); border-radius: 8px; font-size: 13px;">
                    <div>
                      <strong style="font-size: 14px;">${e.description}</strong>
                      <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                        Paid by <strong>${e.paid_by_name}</strong> on ${e.date} • Split: ${e.split_method}
                      </div>
                    </div>
                    <div style="text-align: right;">
                      <strong class="privacy-mask" style="font-size: 15px; color: var(--text-primary);">${curr}${e.amount.toLocaleString()}</strong>
                      <div style="font-size: 11px; color: var(--brand-teal);">
                        ${curr}${(e.amount / (e.splits.length || 1)).toFixed(2)}/person
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  },

  selectWorkspace(id) {
    this.activeWorkspaceId = id;
    this.loadWorkspaces();
  },

  openCreateWorkspaceModal() {
    let modal = document.getElementById('ws-create-modal');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'ws-create-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 440px;">
        <div class="modal-header">
          <h3 class="modal-title">Create Shared Workspace</h3>
          <button class="modal-close" onclick="document.getElementById('ws-create-modal').remove()">✕</button>
        </div>
        <form onsubmit="window.LedgerViews.sharedExpenses.handleCreateWorkspace(event)">
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Workspace Name *</label>
              <input type="text" id="ws-name" class="form-input" placeholder="e.g. Goa Trip 2026, Apartment 402" required>
            </div>
            <div class="form-group">
              <label class="form-label">Description</label>
              <input type="text" id="ws-desc" class="form-input" placeholder="e.g. Group vacation budget">
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('ws-create-modal').remove()">Cancel</button>
            <button type="submit" class="btn btn-primary">Create Workspace</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  },

  async handleCreateWorkspace(e) {
    e.preventDefault();
    const payload = {
      name: document.getElementById('ws-name').value.trim(),
      description: document.getElementById('ws-desc').value.trim(),
    };
    try {
      const res = await window.LedgerAPI.createWorkspace(payload);
      document.getElementById('ws-create-modal').remove();
      this.activeWorkspaceId = res.workspace.id;
      this.loadWorkspaces();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  },

  openInviteModal(workspaceId) {
    let modal = document.getElementById('ws-invite-modal');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'ws-invite-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 400px;">
        <div class="modal-header">
          <h3 class="modal-title">Invite to Workspace</h3>
          <button class="modal-close" onclick="document.getElementById('ws-invite-modal').remove()">✕</button>
        </div>
        <form onsubmit="window.LedgerViews.sharedExpenses.handleInviteMember(event, ${workspaceId})">
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Member Email *</label>
              <input type="email" id="invite-email" class="form-input" placeholder="user@domain.com" required>
            </div>
            <div class="form-group">
              <label class="form-label">Display Name</label>
              <input type="text" id="invite-name" class="form-input" placeholder="e.g. Priya or Alex">
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('ws-invite-modal').remove()">Cancel</button>
            <button type="submit" class="btn btn-primary">Send Invite</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  },

  async handleInviteMember(e, wsId) {
    e.preventDefault();
    const payload = {
      email: document.getElementById('invite-email').value.trim(),
      display_name: document.getElementById('invite-name').value.trim(),
    };
    try {
      await window.LedgerAPI.inviteWorkspaceMember(wsId, payload);
      document.getElementById('ws-invite-modal').remove();
      this.loadWorkspaces();
    } catch (err) {
      alert('Invite failed: ' + err.message);
    }
  },

  openAddExpenseModal(workspaceId, members) {
    let modal = document.getElementById('ws-add-expense-modal');
    if (modal) modal.remove();

    const today = new Date().toISOString().split('T')[0];
    modal = document.createElement('div');
    modal.id = 'ws-add-expense-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 480px;">
        <div class="modal-header">
          <h3 class="modal-title">Add Shared Expense</h3>
          <button class="modal-close" onclick="document.getElementById('ws-add-expense-modal').remove()">✕</button>
        </div>
        <form onsubmit="window.LedgerViews.sharedExpenses.handleAddExpense(event, ${workspaceId})">
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Expense Description *</label>
              <input type="text" id="se-desc" class="form-input" placeholder="e.g. Airbnb, Dinner, Groceries" required>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="form-group">
                <label class="form-label">Total Amount *</label>
                <input type="number" step="any" id="se-amount" class="form-input" placeholder="0.00" required>
              </div>
              <div class="form-group">
                <label class="form-label">Date *</label>
                <input type="date" id="se-date" class="form-input" value="${today}" required>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Paid By *</label>
              <select id="se-paid-by" class="form-select">
                ${members.map(m => `<option value="${m.id}">${m.display_name} (${m.email})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Split Method</label>
              <select id="se-split" class="form-select">
                <option value="equal">Split Equally among all members</option>
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('ws-add-expense-modal').remove()">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Shared Expense</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  },

  async handleAddExpense(e, wsId) {
    e.preventDefault();
    const payload = {
      description: document.getElementById('se-desc').value.trim(),
      amount: parseFloat(document.getElementById('se-amount').value),
      date: document.getElementById('se-date').value,
      paid_by_member_id: parseInt(document.getElementById('se-paid-by').value),
      split_method: document.getElementById('se-split').value,
    };
    try {
      await window.LedgerAPI.addSharedExpense(wsId, payload);
      document.getElementById('ws-add-expense-modal').remove();
      this.loadWorkspaces();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  },

  openSettleModal(workspaceId, members) {
    let modal = document.getElementById('ws-settle-modal');
    if (modal) modal.remove();

    const today = new Date().toISOString().split('T')[0];
    modal = document.createElement('div');
    modal.id = 'ws-settle-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 440px;">
        <div class="modal-header">
          <h3 class="modal-title">Record Settlement</h3>
          <button class="modal-close" onclick="document.getElementById('ws-settle-modal').remove()">✕</button>
        </div>
        <form onsubmit="window.LedgerViews.sharedExpenses.handleSettle(event, ${workspaceId})">
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Payer (Who Paid) *</label>
              <select id="st-from" class="form-select">
                ${members.map(m => `<option value="${m.id}">${m.display_name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Recipient (Who Received) *</label>
              <select id="st-to" class="form-select">
                ${members.map((m, i) => `<option value="${m.id}" ${i===1?'selected':''}>${m.display_name}</option>`).join('')}
              </select>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="form-group">
                <label class="form-label">Settlement Amount *</label>
                <input type="number" step="any" id="st-amount" class="form-input" placeholder="0.00" required>
              </div>
              <div class="form-group">
                <label class="form-label">Date *</label>
                <input type="date" id="st-date" class="form-input" value="${today}" required>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Notes</label>
              <input type="text" id="st-notes" class="form-input" placeholder="e.g. Paid via Google Pay">
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('ws-settle-modal').remove()">Cancel</button>
            <button type="submit" class="btn btn-primary">Record Settlement</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  },

  async handleSettle(e, wsId) {
    e.preventDefault();
    const payload = {
      from_member_id: parseInt(document.getElementById('st-from').value),
      to_member_id: parseInt(document.getElementById('st-to').value),
      amount: parseFloat(document.getElementById('st-amount').value),
      date: document.getElementById('st-date').value,
      notes: document.getElementById('st-notes').value.trim(),
    };
    if (payload.from_member_id === payload.to_member_id) {
      alert('Payer and recipient cannot be the same member');
      return;
    }
    try {
      await window.LedgerAPI.recordSettlement(wsId, payload);
      document.getElementById('ws-settle-modal').remove();
      this.loadWorkspaces();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }
};
