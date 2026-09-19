/**
 * LEDGER QUICK ADD MODAL (Manual + Natural Language AI + Receipt Scanner)
 * Optimized for Mobile-First Bottom-Sheet & Desktop Dialog Ergonomics
 */

window.LedgerViews = window.LedgerViews || {};

window.LedgerViews.quickAdd = {
  activeTab: 'manual',
  activeType: 'expense',
  pendingTransaction: null,

  open(defaultTab = 'manual') {
    this.activeTab = defaultTab;
    this.activeType = 'expense';
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
        <div class="modal-drag-handle mobile-only"></div>
        <div class="modal-header">
          <div style="display:flex; align-items:center; gap:10px;">
            <img src="/static/icons/logo-32.png" alt="Ledger" style="width:24px; height:24px;">
            <h3 class="modal-title" style="margin:0; font-size:18px; font-weight:700;">+ Add Transaction</h3>
          </div>
          <button class="modal-close" onclick="window.LedgerViews.quickAdd.close()" aria-label="Close modal" style="min-width:44px; min-height:44px; display:flex; align-items:center; justify-content:center;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="modal-body" style="padding:16px 20px;">
          <!-- Mode Tabs -->
          <div class="quick-add-tabs tabs-scrollable" style="margin-bottom:16px;">
            <button class="tab-btn ${this.activeTab === 'manual' ? 'active' : ''}" onclick="window.LedgerViews.quickAdd.switchTab('manual')" style="min-height:44px;">
              Manual Entry
            </button>
            <button class="tab-btn ${this.activeTab === 'nlp' ? 'active' : ''}" onclick="window.LedgerViews.quickAdd.switchTab('nlp')" style="min-height:44px;">
              ✨ Natural Language AI
            </button>
            <button class="tab-btn ${this.activeTab === 'receipt' ? 'active' : ''}" onclick="window.LedgerViews.quickAdd.switchTab('receipt')" style="min-height:44px;">
              📄 Scan Receipt
            </button>
          </div>

          <!-- Tab 1: Manual Entry -->
          <div id="qa-tab-manual" style="display:${this.activeTab === 'manual' ? 'block' : 'none'};">
            <form id="qa-manual-form" onsubmit="window.LedgerViews.quickAdd.handleManualSubmit(event)">
              
              <!-- Segmented Type Selector -->
              <div class="type-segmented-control" role="radiogroup">
                <label id="qa-lbl-expense" class="${this.activeType === 'expense' ? 'active-expense' : ''}" onclick="window.LedgerViews.quickAdd.onTypeChange('expense')">
                  <input type="radio" name="qa_type" value="expense" ${this.activeType === 'expense' ? 'checked' : ''}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
                  <span>Expense</span>
                </label>
                <label id="qa-lbl-income" class="${this.activeType === 'income' ? 'active-income' : ''}" onclick="window.LedgerViews.quickAdd.onTypeChange('income')">
                  <input type="radio" name="qa_type" value="income" ${this.activeType === 'income' ? 'checked' : ''}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                  <span>Income</span>
                </label>
              </div>

              <!-- Large Numeric Amount Input -->
              <div class="form-group" style="margin-bottom:14px;">
                <label class="form-label" style="font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em;">Amount (${curr}) *</label>
                <div style="position:relative; display:flex; align-items:center;">
                  <span style="position:absolute; left:16px; font-size:24px; font-weight:800; color:var(--brand-teal); pointer-events:none;">${curr}</span>
                  <input type="number" step="0.01" min="0.01" id="qa-amount" class="form-control" placeholder="0.00" required inputmode="decimal"
                    style="font-size:26px; font-weight:800; padding-left:42px; min-height:56px; border-color:var(--brand-teal); letter-spacing:-0.02em;">
                </div>
              </div>

              <div class="form-group" style="margin-bottom:14px;">
                <label class="form-label">Merchant / Description *</label>
                <input type="text" id="qa-merchant" class="form-control" placeholder="e.g. Starbucks, Amazon, Corporate Salary" required minlength="1">
              </div>

              <div class="qa-grid-responsive" style="margin-bottom:14px;">
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label">Category</label>
                  <select id="qa-category" class="form-control">
                    ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label">Date</label>
                  <input type="date" id="qa-date" class="form-control" value="${new Date().toISOString().split('T')[0]}">
                </div>
              </div>

              <div class="qa-grid-responsive" style="margin-bottom:14px;">
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label">Payment Method</label>
                  <select id="qa-payment-method" class="form-control">
                    <option value="Card">Card</option>
                    <option value="UPI">UPI</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div class="form-group" style="margin-bottom:0;">
                  <label class="form-label">Tags (comma-separated)</label>
                  <input type="text" id="qa-tags" class="form-control" placeholder="e.g. food, weekend">
                </div>
              </div>

              <div class="form-group" style="margin-bottom:18px;">
                <label style="display:flex; align-items:center; gap:10px; font-size:14px; cursor:pointer; min-height:36px;">
                  <input type="checkbox" id="qa-is-recurring" style="width:18px; height:18px; accent-color:var(--brand-teal);">
                  <span>Mark as Recurring Transaction</span>
                </label>
              </div>

              <div style="display:flex; gap:10px; padding-top:6px;">
                <button type="button" class="btn btn-secondary" onclick="window.LedgerViews.quickAdd.close()" style="flex:1; min-height:48px; font-weight:600;">Cancel</button>
                <button type="submit" class="btn btn-primary" style="flex:2; min-height:48px; font-weight:700;">Save Transaction</button>
              </div>
            </form>
          </div>

          <!-- Tab 2: Natural Language AI -->
          <div id="qa-tab-nlp" style="display:${this.activeTab === 'nlp' ? 'block' : 'none'};">
            <p style="font-size:13px; color:var(--text-secondary); margin-bottom:12px; line-height:1.4;">
              Type or paste your expense in natural language. Ledger AI extracts merchant, category, and amount for your review.
            </p>
            <div class="form-group" style="margin-bottom:12px;">
              <textarea id="qa-nlp-input" class="form-control" rows="3" placeholder="e.g. 'Spent ₹450 at Cafe Coffee Day today' or 'Received salary ₹65,000 today'" style="font-size:15px; line-height:1.4;"></textarea>
            </div>
            
            <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:14px;">
              <span class="prompt-chip" onclick="document.getElementById('qa-nlp-input').value=this.innerText">Spent ₹1,200 at Whole Foods</span>
              <span class="prompt-chip" onclick="document.getElementById('qa-nlp-input').value=this.innerText">Uber ride ₹380 today</span>
              <span class="prompt-chip" onclick="document.getElementById('qa-nlp-input').value=this.innerText">Received ₹75,000 salary</span>
            </div>

            <button class="btn btn-secondary" style="width:100%; min-height:46px; font-weight:600;" onclick="window.LedgerViews.quickAdd.handleNLPParse()">
              ✨ Parse with Ledger AI
            </button>

            <!-- NLP Preview Confirmation Card -->
            <div id="qa-nlp-preview" style="display:none; margin-top:16px;"></div>
          </div>

          <!-- Tab 3: Receipt Scanner -->
          <div id="qa-tab-receipt" style="display:${this.activeTab === 'receipt' ? 'block' : 'none'};">
            <p style="font-size:13px; color:var(--text-secondary); margin-bottom:14px; line-height:1.4;">
              Snap a photo with your device camera or upload a receipt file. Ledger AI extracts the merchant, total, date, and items.
            </p>

            <!-- Dual Mobile-Friendly Upload Options -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px;">
              <label class="btn btn-secondary" style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:14px 10px; gap:6px; min-height:72px; cursor:pointer; text-align:center;">
                <input type="file" id="qa-receipt-camera" accept="image/*" capture="environment" style="display:none;" onchange="window.LedgerViews.quickAdd.handleReceiptUpload(event)">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--brand-teal)" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                <span style="font-size:12px; font-weight:600;">📸 Camera</span>
              </label>

              <label class="btn btn-secondary" style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:14px 10px; gap:6px; min-height:72px; cursor:pointer; text-align:center;">
                <input type="file" id="qa-receipt-file" accept="image/*" style="display:none;" onchange="window.LedgerViews.quickAdd.handleReceiptUpload(event)">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--brand-blue)" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                <span style="font-size:12px; font-weight:600;">📁 Upload File</span>
              </label>
            </div>

            <!-- Drag & Drop Zone for Desktop -->
            <div class="dropzone desktop-only" id="qa-receipt-dropzone" onclick="document.getElementById('qa-receipt-file').click()" style="margin-bottom:14px;">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--brand-teal)" stroke-width="2" style="margin-bottom:6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
              <div style="font-weight:600; font-size:13px; color:var(--text-primary);">Click or Drag Receipt Image Here</div>
              <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">Supports PNG, JPG, JPEG, WebP</div>
            </div>

            <div id="qa-receipt-preview" style="display:none; margin-top:14px;"></div>
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
    this.activeType = type;
    const expLabel = document.getElementById('qa-lbl-expense');
    const incLabel = document.getElementById('qa-lbl-income');
    if (expLabel && incLabel) {
      if (type === 'expense') {
        expLabel.className = 'active-expense';
        incLabel.className = '';
      } else {
        expLabel.className = '';
        incLabel.className = 'active-income';
      }
    }
  },

  async handleManualSubmit(e) {
    e.preventDefault();
    const type = this.activeType;
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
    preview.innerHTML = `<div style="text-align:center; padding:16px; color:var(--brand-teal);"><div class="spinner" style="margin:0 auto 8px auto;"></div>Analyzing transaction details...</div>`;

    try {
      const res = await window.LedgerAPI.parseNLP(text);
      const p = res.parsed;
      this.pendingTransaction = p;

      preview.innerHTML = `
        <div class="card" style="background:var(--brand-surface-elevated); border-color:var(--brand-teal); padding:14px;">
          <div style="font-size:11px; font-weight:700; text-transform:uppercase; color:var(--brand-teal); margin-bottom:10px;">
            Confirmation Required: Extracted Fields
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:13px; margin-bottom:14px;">
            <div><span style="color:var(--text-muted);">Type:</span> <strong style="text-transform:capitalize; color:${p.type==='income'?'var(--brand-teal)':'var(--brand-danger)'};">${p.type}</strong></div>
            <div><span style="color:var(--text-muted);">Amount:</span> <strong>${p.currency || '₹'}${p.amount}</strong></div>
            <div><span style="color:var(--text-muted);">Merchant:</span> <strong>${p.merchant}</strong></div>
            <div><span style="color:var(--text-muted);">Category:</span> <strong>${p.category_name}</strong></div>
            <div><span style="color:var(--text-muted);">Date:</span> <strong>${p.date}</strong></div>
            <div><span style="color:var(--text-muted);">Payment:</span> <strong>${p.payment_method}</strong></div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:8px;">
            <button class="btn btn-secondary" onclick="document.getElementById('qa-nlp-preview').style.display='none'" style="min-height:44px;">Edit Text</button>
            <button class="btn btn-primary" onclick="window.LedgerViews.quickAdd.confirmPendingTransaction()" style="min-height:44px; font-weight:700;">Confirm & Save</button>
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

    // Show image preview thumbnail immediately
    const imgUrl = URL.createObjectURL(file);
    preview.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:10px;">
        <img src="${imgUrl}" alt="Receipt Preview" class="receipt-preview-img" style="max-height:180px; object-fit:contain; border-radius:var(--radius-md); border:1px solid var(--brand-border);">
        <div style="text-align:center; padding:12px; color:var(--brand-teal); font-size:13px;">
          <div class="spinner" style="margin:0 auto 8px auto;"></div>
          Scanning receipt & extracting line items...
        </div>
      </div>
    `;

    const formData = new FormData();
    formData.append('receipt', file);

    try {
      const res = await window.LedgerAPI.scanReceipt(formData);
      const ex = res.extracted;
      this.pendingTransaction = {
        type: 'expense',
        amount: ex.total || 0,
        merchant: ex.merchant || 'Receipt Merchant',
        category_id: ex.category_id,
        date: ex.date || new Date().toISOString().split('T')[0],
        receipt_id: res.receipt_id,
        notes: `Receipt upload [Tax: ${ex.currency || '₹'}${ex.tax || 0}]`
      };

      const itemsHtml = (ex.line_items && ex.line_items.length > 0) ? `
        <div style="margin:10px 0; padding:8px; background:var(--brand-navy); border-radius:var(--radius-sm); font-size:12px; max-height:120px; overflow-y:auto;">
          <strong style="display:block; margin-bottom:4px;">Line Items:</strong>
          ${ex.line_items.map(i => `<div style="display:flex; justify-content:space-between; padding:2px 0;"><span>${i.description || 'Item'}</span><span>${ex.currency || '₹'}${i.amount}</span></div>`).join('')}
        </div>
      ` : '';

      preview.innerHTML = `
        <div class="card" style="background:var(--brand-surface-elevated); border-color:var(--brand-teal); padding:14px;">
          <div style="display:flex; gap:12px; align-items:center; margin-bottom:10px;">
            <img src="${imgUrl}" alt="Receipt" style="width:50px; height:50px; object-fit:cover; border-radius:var(--radius-sm); border:1px solid var(--brand-border);">
            <div>
              <div style="font-size:11px; font-weight:700; text-transform:uppercase; color:var(--brand-teal);">Receipt OCR Extracted</div>
              <div style="font-size:13px; font-weight:700;">${ex.merchant || 'Receipt'}</div>
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:13px; margin-bottom:8px;">
            <div><span style="color:var(--text-muted);">Total:</span> <strong>${ex.currency || '₹'}${ex.total}</strong></div>
            <div><span style="color:var(--text-muted);">Date:</span> <strong>${ex.date}</strong></div>
            <div><span style="color:var(--text-muted);">Tax:</span> <strong>${ex.currency || '₹'}${ex.tax || 0}</strong></div>
            <div><span style="color:var(--text-muted);">Confidence:</span> <strong>${ex.confidence || '95%'}</strong></div>
          </div>
          ${itemsHtml}
          ${ex.needs_review ? `<div class="badge badge-warning" style="margin-bottom:10px; font-size:11px;">Confidence: ${ex.confidence} - Please confirm details</div>` : ''}
          <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:10px;">
            <button class="btn btn-secondary" onclick="document.getElementById('qa-receipt-preview').style.display='none'" style="min-height:44px;">Retake / Cancel</button>
            <button class="btn btn-primary" onclick="window.LedgerViews.quickAdd.confirmPendingTransaction()" style="min-height:44px; font-weight:700;">Confirm & Save</button>
          </div>
        </div>
      `;
    } catch (err) {
      preview.innerHTML = `
        <div style="color:var(--brand-danger); padding:12px; text-align:center;">
          <div>Failed to scan receipt: ${err.message}</div>
          <button class="btn btn-secondary" onclick="document.getElementById('qa-receipt-preview').style.display='none'" style="margin-top:8px; min-height:40px;">Try Again</button>
        </div>
      `;
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
