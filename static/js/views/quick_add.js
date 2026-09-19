/**
 * LEDGER QUICK ADD MODAL (Manual + Natural Language AI + Receipt Scanner)
 */

window.LedgerViews = window.LedgerViews || {};

window.LedgerViews.quickAdd = {
  activeTab: 'manual',
  pendingTransaction: null,

  open(defaultTab = 'manual') {
    this.activeTab = defaultTab;
    this.pendingTransaction = null;
    let modal = document.getElementById('quick-add-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'quick-add-modal';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }
    this.renderModal(modal);
  },

  close() {
    const modal = document.getElementById('quick-add-modal');
    if (modal) modal.remove();
  },

  async renderModal(modal) {
    const user = window.LedgerApp.currentUser || {};
    const curr = user.currency || '₹';

    // Fetch categories
    let categories = [];
    try {
      const catRes = await window.LedgerAPI.getCategories();
      categories = catRes.categories || [];
    } catch (e) {
      categories = [];
    }

    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <div style="display:flex; align-items:center; gap:10px;">
            <img src="/static/icons/logo-32.png" alt="Ledger" style="width:24px; height:24px;">
            <h3 class="modal-title">+ Add Transaction</h3>
          </div>
          <button class="modal-close" onclick="window.LedgerViews.quickAdd.close()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="modal-body">
          <!-- Mode Tabs -->
          <div class="quick-add-tabs">
            <button class="tab-btn ${this.activeTab === 'manual' ? 'active' : ''}" onclick="window.LedgerViews.quickAdd.switchTab('manual')">
              Manual Entry
            </button>
            <button class="tab-btn ${this.activeTab === 'nlp' ? 'active' : ''}" onclick="window.LedgerViews.quickAdd.switchTab('nlp')">
              ✨ Natural Language AI
            </button>
            <button class="tab-btn ${this.activeTab === 'receipt' ? 'active' : ''}" onclick="window.LedgerViews.quickAdd.switchTab('receipt')">
              📄 Scan Receipt
            </button>
          </div>

          <!-- Tab 1: Manual Entry -->
          <div id="qa-tab-manual" style="display:${this.activeTab === 'manual' ? 'block' : 'none'};">
            <form id="qa-manual-form" onsubmit="window.LedgerViews.quickAdd.handleManualSubmit(event)">
              <div style="display:flex; gap:12px; margin-bottom:14px;">
                <label style="flex:1; display:flex; align-items:center; justify-content:center; gap:8px; padding:10px; background:var(--brand-surface); border:1px solid var(--brand-border); border-radius:var(--radius-md); cursor:pointer;">
                  <input type="radio" name="qa_type" value="expense" checked onchange="window.LedgerViews.quickAdd.onTypeChange('expense')">
                  <span style="font-weight:600; color:var(--brand-danger);">Expense</span>
                </label>
                <label style="flex:1; display:flex; align-items:center; justify-content:center; gap:8px; padding:10px; background:var(--brand-surface); border:1px solid var(--brand-border); border-radius:var(--radius-md); cursor:pointer;">
                  <input type="radio" name="qa_type" value="income" onchange="window.LedgerViews.quickAdd.onTypeChange('income')">
                  <span style="font-weight:600; color:var(--brand-teal);">Income</span>
                </label>
              </div>

              <div class="form-group">
                <label class="form-label">Amount (${curr}) *</label>
                <input type="number" step="0.01" min="0.01" id="qa-amount" class="form-control" placeholder="0.00" required style="font-size:18px; font-weight:700;">
              </div>

              <div class="form-group">
                <label class="form-label">Merchant / Description *</label>
                <input type="text" id="qa-merchant" class="form-control" placeholder="e.g. Starbucks, Amazon, Corporate Salary" required>
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                <div class="form-group">
                  <label class="form-label">Category</label>
                  <select id="qa-category" class="form-control">
                    ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Date</label>
                  <input type="date" id="qa-date" class="form-control" value="${new Date().toISOString().split('T')[0]}">
                </div>
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                <div class="form-group">
                  <label class="form-label">Payment Method</label>
                  <select id="qa-payment-method" class="form-control">
                    <option value="Card">Card</option>
                    <option value="UPI">UPI</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Tags (comma-separated)</label>
                  <input type="text" id="qa-tags" class="form-control" placeholder="e.g. food, weekend">
                </div>
              </div>

              <div class="form-group">
                <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                  <input type="checkbox" id="qa-is-recurring">
                  <span>Mark as Recurring Transaction</span>
                </label>
              </div>

              <div class="modal-footer" style="padding:14px 0 0 0;">
                <button type="button" class="btn btn-secondary" onclick="window.LedgerViews.quickAdd.close()">Cancel</button>
                <button type="submit" class="btn btn-primary">Save Transaction</button>
              </div>
            </form>
          </div>

          <!-- Tab 2: Natural Language AI -->
          <div id="qa-tab-nlp" style="display:${this.activeTab === 'nlp' ? 'block' : 'none'};">
            <p style="font-size:13px; color:var(--text-secondary); margin-bottom:12px;">
              Enter your transaction in everyday natural language. Ledger will parse the details and ask for your confirmation before saving.
            </p>
            <div class="form-group">
              <textarea id="qa-nlp-input" class="form-control" rows="3" placeholder="e.g. 'Spent ₹450 at Cafe Coffee Day today' or 'Received salary ₹65,000 today'"></textarea>
            </div>
            <button class="btn btn-secondary" style="width:100%;" onclick="window.LedgerViews.quickAdd.handleNLPParse()">
              Parse with Ledger AI
            </button>

            <!-- NLP Preview Confirmation Card -->
            <div id="qa-nlp-preview" style="display:none; margin-top:16px;"></div>
          </div>

          <!-- Tab 3: Receipt Scanner -->
          <div id="qa-tab-receipt" style="display:${this.activeTab === 'receipt' ? 'block' : 'none'};">
            <p style="font-size:13px; color:var(--text-secondary); margin-bottom:12px;">
              Upload or snap a photo of your receipt. Ledger extracts merchant, date, total, and line items for your confirmation.
            </p>
            <div class="dropzone" id="qa-receipt-dropzone" onclick="document.getElementById('qa-receipt-file').click()">
              <input type="file" id="qa-receipt-file" accept="image/*" style="display:none;" onchange="window.LedgerViews.quickAdd.handleReceiptUpload(event)">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--brand-teal)" stroke-width="2" style="margin-bottom:8px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
              <div style="font-weight:600; font-size:14px; color:var(--text-primary);">Click or Drag Receipt Image Here</div>
              <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">Supports PNG, JPG, JPEG, WebP</div>
            </div>

            <div id="qa-receipt-preview" style="display:none; margin-top:16px;"></div>
          </div>
        </div>
      </div>
    `;
  },

  switchTab(tab) {
    this.activeTab = tab;
    ['manual', 'nlp', 'receipt'].forEach(t => {
      const el = document.getElementById(`qa-tab-${t}`);
      if (el) el.style.display = t === tab ? 'block' : 'none';
    });
    document.querySelectorAll('.quick-add-tabs .tab-btn').forEach((btn, idx) => {
      const tabs = ['manual', 'nlp', 'receipt'];
      btn.className = `tab-btn ${tabs[idx] === tab ? 'active' : ''}`;
    });
  },

  onTypeChange(type) {
    // Optionally update category filter
  },

  async handleManualSubmit(e) {
    e.preventDefault();
    const type = document.querySelector('input[name="qa_type"]:checked').value;
    const amount = parseFloat(document.getElementById('qa-amount').value);
    const merchant = document.getElementById('qa-merchant').value.trim();
    const category_id = parseInt(document.getElementById('qa-category').value) || null;
    const date = document.getElementById('qa-date').value;
    const payment_method = document.getElementById('qa-payment-method').value;
    const tagsRaw = document.getElementById('qa-tags').value;
    const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
    const is_recurring = document.getElementById('qa-is-recurring').checked;

    try {
      await window.LedgerAPI.createTransaction({
        type,
        amount,
        merchant,
        category_id,
        date,
        payment_method,
        tags,
        is_recurring
      });
      this.close();
      window.LedgerApp.refreshCurrentView();
    } catch (err) {
      alert(err.message || 'Failed to save transaction');
    }
  },

  async handleNLPParse() {
    const text = document.getElementById('qa-nlp-input').value.trim();
    if (!text) return;

    const preview = document.getElementById('qa-nlp-preview');
    preview.style.display = 'block';
    preview.innerHTML = `<div style="text-align:center; padding:16px; color:var(--brand-teal);">Analyzing text...</div>`;

    try {
      const res = await window.LedgerAPI.parseNLP(text);
      const p = res.parsed;
      this.pendingTransaction = p;

      preview.innerHTML = `
        <div class="card" style="background:var(--brand-surface-elevated); border-color:var(--brand-teal);">
          <div style="font-size:11px; font-weight:700; text-transform:uppercase; color:var(--brand-teal); margin-bottom:8px;">
            Confirmation Required: Extracted Fields
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:13px; margin-bottom:14px;">
            <div><span style="color:var(--text-muted);">Type:</span> <strong style="text-transform:capitalize; color:${p.type==='income'?'var(--brand-teal)':'var(--brand-danger)'};">${p.type}</strong></div>
            <div><span style="color:var(--text-muted);">Amount:</span> <strong>${p.currency}${p.amount}</strong></div>
            <div><span style="color:var(--text-muted);">Merchant:</span> <strong>${p.merchant}</strong></div>
            <div><span style="color:var(--text-muted);">Category:</span> <strong>${p.category_name}</strong></div>
            <div><span style="color:var(--text-muted);">Date:</span> <strong>${p.date}</strong></div>
            <div><span style="color:var(--text-muted);">Payment:</span> <strong>${p.payment_method}</strong></div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:10px;">
            <button class="btn btn-secondary" onclick="document.getElementById('qa-nlp-preview').style.display='none'">Edit Text</button>
            <button class="btn btn-primary" onclick="window.LedgerViews.quickAdd.confirmPendingTransaction()">Confirm & Save</button>
          </div>
        </div>
      `;
    } catch (err) {
      preview.innerHTML = `<div style="color:var(--brand-danger); padding:10px;">${err.message}</div>`;
    }
  },

  async handleReceiptUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const preview = document.getElementById('qa-receipt-preview');
    preview.style.display = 'block';
    preview.innerHTML = `<div style="text-align:center; padding:20px; color:var(--brand-teal);">Scanning receipt image and running OCR extraction...</div>`;

    const formData = new FormData();
    formData.append('receipt', file);

    try {
      const res = await window.LedgerAPI.scanReceipt(formData);
      const ex = res.extracted;
      this.pendingTransaction = {
        type: 'expense',
        amount: ex.total || 0,
        merchant: ex.merchant,
        category_id: ex.category_id,
        date: ex.date,
        receipt_id: res.receipt_id,
        notes: `Receipt upload [Tax: ${ex.currency}${ex.tax || 0}]`
      };

      const itemsHtml = (ex.line_items && ex.line_items.length > 0) ? `
        <div style="margin:10px 0; padding:8px; background:var(--brand-navy); border-radius:var(--radius-sm); font-size:12px;">
          <strong>Line Items:</strong>
          ${ex.line_items.map(i => `<div style="display:flex; justify-content:space-between;"><span>${i.description || 'Item'}</span><span>${ex.currency}${i.amount}</span></div>`).join('')}
        </div>
      ` : '';

      preview.innerHTML = `
        <div class="card" style="background:var(--brand-surface-elevated); border-color:var(--brand-teal);">
          <div style="font-size:11px; font-weight:700; text-transform:uppercase; color:var(--brand-teal); margin-bottom:8px;">
            Confirmation Required: Extracted Receipt Data
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:13px; margin-bottom:10px;">
            <div><span style="color:var(--text-muted);">Merchant:</span> <strong>${ex.merchant}</strong></div>
            <div><span style="color:var(--text-muted);">Total:</span> <strong>${ex.currency}${ex.total}</strong></div>
            <div><span style="color:var(--text-muted);">Date:</span> <strong>${ex.date}</strong></div>
            <div><span style="color:var(--text-muted);">Tax:</span> <strong>${ex.currency}${ex.tax || 0}</strong></div>
          </div>
          ${itemsHtml}
          ${ex.needs_review ? `<div class="badge badge-warning" style="margin-bottom:12px;">Confidence: ${ex.confidence} - Please confirm details</div>` : ''}
          <div style="display:flex; justify-content:flex-end; gap:10px;">
            <button class="btn btn-secondary" onclick="document.getElementById('qa-receipt-preview').style.display='none'">Cancel</button>
            <button class="btn btn-primary" onclick="window.LedgerViews.quickAdd.confirmPendingTransaction()">Confirm & Save Transaction</button>
          </div>
        </div>
      `;
    } catch (err) {
      preview.innerHTML = `<div style="color:var(--brand-danger); padding:10px;">${err.message}</div>`;
    }
  },

  async confirmPendingTransaction() {
    if (!this.pendingTransaction) return;
    try {
      await window.LedgerAPI.createTransaction(this.pendingTransaction);
      this.close();
      window.LedgerApp.refreshCurrentView();
    } catch (err) {
      alert(err.message || 'Failed to save confirmed transaction');
    }
  }
};
