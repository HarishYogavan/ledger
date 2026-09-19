/**
 * LEDGER TRANSACTIONS MANAGEMENT VIEW
 */

window.LedgerViews = window.LedgerViews || {};

window.LedgerViews.transactions = {
  currentFilters: {
    search: '',
    type: '',
    category_id: '',
    sort_by: 'date',
    sort_dir: 'desc',
    limit: 50,
    offset: 0
  },

  async render(container) {
    container.innerHTML = `
      <div style="display:flex; justify-content:center; padding:60px;">
        <div style="color:var(--brand-teal); font-weight:600;">Loading Transactions...</div>
      </div>
    `;

    try {
      const [txData, catData] = await Promise.all([
        window.LedgerAPI.getTransactions(this.currentFilters),
        window.LedgerAPI.getCategories()
      ]);

      const user = window.LedgerApp.currentUser || {};
      const curr = user.currency || '₹';
      const txs = txData.transactions || [];
      const categories = catData.categories || [];

      container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; flex-wrap:wrap; gap:16px;">
          <div>
            <h1 style="font-size:24px; margin-bottom:4px;">Transaction Records</h1>
            <p style="font-size:13px; color:var(--text-secondary);">Manage, search, and categorize your complete personal cashflow</p>
          </div>
          <button class="btn btn-primary" onclick="window.LedgerViews.quickAdd.open()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
            + Add Transaction
          </button>
        </div>

        <!-- Filter Bar -->
        <div class="card" style="padding:16px 20px; margin-bottom:20px;">
          <div class="filter-bar" style="margin-bottom:0;">
            <div style="flex:1; min-width:200px;">
              <input type="text" id="tx-search-input" class="form-control" placeholder="Search merchant, notes, tags..." value="${this.currentFilters.search}">
            </div>

            <div style="min-width:140px;">
              <select id="tx-type-filter" class="form-control" onchange="window.LedgerViews.transactions.applyFilter('type', this.value)">
                <option value="">All Types</option>
                <option value="expense" ${this.currentFilters.type === 'expense' ? 'selected' : ''}>Expenses Only</option>
                <option value="income" ${this.currentFilters.type === 'income' ? 'selected' : ''}>Income Only</option>
              </select>
            </div>

            <div style="min-width:160px;">
              <select id="tx-category-filter" class="form-control" onchange="window.LedgerViews.transactions.applyFilter('category_id', this.value)">
                <option value="">All Categories</option>
                ${categories.map(c => `<option value="${c.id}" ${this.currentFilters.category_id == c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
              </select>
            </div>

            <div style="min-width:140px;">
              <select id="tx-sort-filter" class="form-control" onchange="window.LedgerViews.transactions.applyFilter('sort_by', this.value)">
                <option value="date" ${this.currentFilters.sort_by === 'date' ? 'selected' : ''}>Sort by Date</option>
                <option value="amount" ${this.currentFilters.sort_by === 'amount' ? 'selected' : ''}>Sort by Amount</option>
                <option value="merchant" ${this.currentFilters.sort_by === 'merchant' ? 'selected' : ''}>Sort by Merchant</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Transactions Table Card -->
        <div class="card" style="padding:0; overflow:hidden;">
          <div class="data-table-wrapper" style="border:none;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Merchant / Title</th>
                  <th>Category</th>
                  <th>Method</th>
                  <th>Notes & Tags</th>
                  <th style="text-align:right;">Amount</th>
                  <th style="text-align:center;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${txs.length > 0 ? txs.map(t => `
                  <tr>
                    <td style="color:var(--text-secondary); white-space:nowrap;">${t.date}</td>
                    <td>
                      <strong style="font-weight:600;">${t.merchant || 'General Transaction'}</strong>
                      ${t.is_recurring ? '<span class="badge badge-info" style="margin-left:6px; font-size:9px;">Recurring</span>' : ''}
                      ${t.receipt_id ? '<span class="badge badge-success" style="margin-left:6px; font-size:9px;">Receipt</span>' : ''}
                    </td>
                    <td>
                      <span class="category-pill">
                        <span class="cat-dot" style="background:${t.category_color};"></span>
                        ${t.category_name}
                      </span>
                    </td>
                    <td style="color:var(--text-secondary);">${t.payment_method}</td>
                    <td style="color:var(--text-secondary); font-size:12px;">
                      ${t.notes || ''}
                      ${t.tags && t.tags.length > 0 ? t.tags.map(tag => `<span style="display:inline-block; font-size:10px; background:var(--brand-surface); padding:1px 6px; border-radius:4px; margin-left:4px;">#${tag}</span>`).join('') : ''}
                    </td>
                    <td style="text-align:right; font-weight:700; color:${t.type === 'income' ? 'var(--brand-teal)' : 'var(--text-primary)'}; white-space:nowrap;" class="privacy-mask">
                      ${t.type === 'income' ? '+' : '-'}${curr}${t.amount.toLocaleString(undefined, {minimumFractionDigits:2})}
                    </td>
                    <td style="text-align:center; white-space:nowrap;">
                      <button class="btn-icon" title="Edit" onclick='window.LedgerViews.transactions.openEditModal(${JSON.stringify(t).replace(/'/g, "&apos;")})'>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button class="btn-icon" title="Delete" style="color:var(--brand-danger);" onclick="window.LedgerViews.transactions.confirmDelete(${t.id}, '${t.merchant}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </td>
                  </tr>
                `).join('') : `
                  <tr>
                    <td colspan="7" style="text-align:center; padding:48px 24px;">
                      <div class="empty-state" style="border:none; padding:0;">
                        <p class="empty-state-title">No transactions found</p>
                        <p class="empty-state-desc">Try clearing your filters or add your first transaction.</p>
                      </div>
                    </td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      `;

      // Attach search debounce
      const searchInput = document.getElementById('tx-search-input');
      if (searchInput) {
        let timer;
        searchInput.oninput = (e) => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            this.currentFilters.search = e.target.value.trim();
            this.render(container);
          }, 350);
        };
      }

    } catch (err) {
      container.innerHTML = `<div class="card" style="border-color:var(--brand-danger);">${err.message}</div>`;
    }
  },

  applyFilter(key, val) {
    this.currentFilters[key] = val;
    this.render(document.getElementById('view-container'));
  },

  openEditModal(t) {
    let modal = document.getElementById('edit-tx-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'edit-tx-modal';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title">Edit Transaction #${t.id}</h3>
          <button class="modal-close" onclick="document.getElementById('edit-tx-modal').remove()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <form id="edit-tx-form" onsubmit="window.LedgerViews.transactions.handleEditSubmit(event, ${t.id})">
            <div class="form-group">
              <label class="form-label">Merchant / Title</label>
              <input type="text" id="edit-tx-merchant" class="form-control" value="${t.merchant || ''}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Amount</label>
              <input type="number" step="0.01" id="edit-tx-amount" class="form-control" value="${t.amount}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Date</label>
              <input type="date" id="edit-tx-date" class="form-control" value="${t.date}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Notes</label>
              <textarea id="edit-tx-notes" class="form-control" rows="2">${t.notes || ''}</textarea>
            </div>
            <div class="modal-footer" style="padding:12px 0 0 0;">
              <button type="button" class="btn btn-secondary" onclick="document.getElementById('edit-tx-modal').remove()">Cancel</button>
              <button type="submit" class="btn btn-primary">Update Transaction</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  async handleEditSubmit(e, txId) {
    e.preventDefault();
    const merchant = document.getElementById('edit-tx-merchant').value.trim();
    const amount = parseFloat(document.getElementById('edit-tx-amount').value);
    const date = document.getElementById('edit-tx-date').value;
    const notes = document.getElementById('edit-tx-notes').value;

    try {
      await window.LedgerAPI.updateTransaction(txId, { merchant, amount, date, notes });
      document.getElementById('edit-tx-modal').remove();
      this.render(document.getElementById('view-container'));
    } catch (err) {
      alert(err.message || 'Failed to update transaction');
    }
  },

  async confirmDelete(id, title) {
    if (confirm(`Are you sure you want to delete transaction "${title || id}"? This action cannot be undone.`)) {
      try {
        await window.LedgerAPI.deleteTransaction(id);
        this.render(document.getElementById('view-container'));
      } catch (err) {
        alert(err.message || 'Failed to delete transaction');
      }
    }
  }
};
