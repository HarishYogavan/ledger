/**
 * PURCHASE & WARRANTY VAULT + PURCHASE LIFECYCLE
 */

window.LedgerViews = window.LedgerViews || {};

window.LedgerViews.purchases = {
  currentTab: 'vault', // 'vault' | 'lifecycle'
  selectedPurchaseId: null,

  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Purchases & Warranties</h1>
          <p class="page-subtitle">Track valuable purchases, warranty lifespans, and product service lifecycles.</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-primary" onclick="window.LedgerViews.purchases.openCreateModal()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            + New Purchase
          </button>
        </div>
      </div>

      <!-- Tabbed Navigation -->
      <div class="tab-pills tabs-scrollable" style="margin-bottom: 20px;">
        <button class="tab-pill active" id="tab-btn-vault" onclick="window.LedgerViews.purchases.switchTab('vault')">
          Purchase & Warranty Vault
        </button>
        <button class="tab-pill" id="tab-btn-lifecycle" onclick="window.LedgerViews.purchases.switchTab('lifecycle')">
          Purchase Lifecycle Timeline
        </button>
      </div>

      <div id="purchases-tab-content">
        <div style="text-align:center; padding: 40px; color: var(--text-muted);">Loading purchases...</div>
      </div>
    `;

    this.loadTabContent();
  },

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.tab-pill').forEach(b => b.classList.remove('active'));
    const activeBtn = document.getElementById(`tab-btn-${tab}`);
    if (activeBtn) activeBtn.classList.add('active');
    this.loadTabContent();
  },

  async loadTabContent() {
    const container = document.getElementById('purchases-tab-content');
    if (!container) return;

    try {
      const res = await window.LedgerAPI.getPurchases();
      const purchases = res.purchases || [];
      const curr = res.currency || '₹';

      if (purchases.length === 0) {
        container.innerHTML = `
          <div class="empty-state-card">
            <div class="empty-state-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--brand-teal)" stroke-width="2"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg>
            </div>
            <h3 class="empty-state-title">Your Purchase Vault is Empty</h3>
            <p class="empty-state-desc">Log your electronics, appliances, and major assets to monitor warranty coverage, maintenance history, and replacement schedules.</p>
            <button class="btn btn-primary" onclick="window.LedgerViews.purchases.openCreateModal()">+ Add Your First Purchase</button>
          </div>
        `;
        return;
      }

      if (this.currentTab === 'vault') {
        this.renderVault(container, purchases, curr);
      } else {
        if (!this.selectedPurchaseId) {
          this.selectedPurchaseId = purchases[0].id;
        }
        this.renderLifecycle(container, purchases, curr);
      }
    } catch (e) {
      container.innerHTML = `<div class="card" style="color:var(--brand-danger);">Failed to load purchases: ${e.message}</div>`;
    }
  },

  renderVault(container, purchases, curr) {
    // Check warranty alert banner
    const expiringSoon = purchases.filter(p => p.is_warranty_active && p.days_until_warranty_expiry !== null && p.days_until_warranty_expiry <= 30);

    let bannerHtml = '';
    if (expiringSoon.length > 0) {
      bannerHtml = `
        <div class="card" style="background: rgba(255, 209, 102, 0.08); border: 1px solid rgba(255, 209, 102, 0.3); margin-bottom: 20px; display: flex; align-items: center; gap: 12px;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFD166" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <div style="font-size: 13px;">
            <strong style="color: #FFD166;">Warranty Expiration Notice:</strong>
            ${expiringSoon.map(p => `<strong>${p.product_name}</strong> expires in ${p.days_until_warranty_expiry} day(s)`).join(', ')}.
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      ${bannerHtml}
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); gap: 16px;">
        ${purchases.map(p => {
          let badgeColor = 'var(--text-muted)';
          let badgeText = 'No Warranty';
          if (p.warranty_expiry) {
            if (p.is_warranty_active) {
              if (p.days_until_warranty_expiry !== null && p.days_until_warranty_expiry <= 30) {
                badgeColor = 'var(--brand-warning)';
                badgeText = `Expiring in ${p.days_until_warranty_expiry}d`;
              } else {
                badgeColor = 'var(--brand-teal)';
                badgeText = `Active (${p.days_until_warranty_expiry}d left)`;
              }
            } else {
              badgeColor = 'var(--brand-danger)';
              badgeText = 'Expired';
            }
          }

          return `
            <div class="card" style="display: flex; flex-direction: column; justify-content: space-between; border-left: 3px solid ${p.category_color};">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                  <div>
                    <h3 style="font-size: 16px; font-weight: 600; margin: 0 0 4px 0;">${p.product_name}</h3>
                    <div style="font-size: 12px; color: var(--text-muted);">${p.merchant || 'Merchant unspecified'} • ${p.purchase_date}</div>
                  </div>
                  <div class="privacy-mask" style="font-size: 16px; font-weight: 700; color: var(--text-primary);">${curr}${p.price.toLocaleString()}</div>
                </div>

                <div style="display: flex; gap: 8px; margin: 12px 0; align-items: center; font-size: 12px;">
                  <span class="badge" style="background: rgba(255,255,255,0.06); color: var(--text-secondary);">${p.category_name}</span>
                  <span class="badge" style="background: rgba(6, 214, 160, 0.1); color: ${badgeColor}; border: 1px solid ${badgeColor}40;">
                    ${badgeText}
                  </span>
                </div>

                ${p.notes ? `<p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px;">${p.notes}</p>` : ''}
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid var(--brand-border-subtle); margin-top: 10px;">
                <button class="btn btn-secondary" style="font-size: 12px; padding: 4px 10px;" onclick="window.LedgerViews.purchases.selectForLifecycle(${p.id})">
                  View Lifecycle (${p.events_count})
                </button>
                <div style="display: flex; gap: 6px;">
                  <button class="btn-icon" title="Add Lifecycle Event" onclick="window.LedgerViews.purchases.openEventModal(${p.id})">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                  <button class="btn-icon" title="Delete Purchase" onclick="window.LedgerViews.purchases.deletePurchase(${p.id})">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brand-danger)" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  async renderLifecycle(container, purchases, curr) {
    const activePurchase = purchases.find(p => p.id === this.selectedPurchaseId) || purchases[0];

    let eventsData = [];
    try {
      const detailRes = await window.LedgerAPI.getPurchaseDetails(activePurchase.id);
      eventsData = detailRes.events || [];
    } catch (e) {
      eventsData = [];
    }

    container.innerHTML = `
      <div class="grid-sidebar-sm">
        <!-- Left: Product Switcher -->
        <div class="card" style="padding: 12px;">
          <h4 style="font-size: 12px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 10px;">Select Product</h4>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${purchases.map(p => `
              <button class="btn ${p.id === activePurchase.id ? 'btn-primary' : 'btn-secondary'}" style="text-align: left; justify-content: space-between; font-size: 13px;" onclick="window.LedgerViews.purchases.selectForLifecycle(${p.id})">
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.product_name}</span>
                <span class="privacy-mask" style="font-size: 11px; opacity: 0.8;">${curr}${p.price.toLocaleString()}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Right: Lifecycle Visual Pipeline -->
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <div>
              <h2 style="font-size: 18px; margin: 0 0 4px 0;">${activePurchase.product_name} Lifecycle</h2>
              <div style="font-size: 12px; color: var(--text-muted);">
                Purchased on ${activePurchase.purchase_date} from ${activePurchase.merchant || 'Store'}
              </div>
            </div>
            <button class="btn btn-primary" onclick="window.LedgerViews.purchases.openEventModal(${activePurchase.id})">
              + Log Event
            </button>
          </div>

          <!-- Step Progression Indicator -->
          <div class="lifecycle-pipeline" style="display: flex; justify-content: space-between; margin-bottom: 30px; position: relative; padding: 0 10px;">
            ${['purchase', 'warranty_claim', 'maintenance', 'repair', 'replacement'].map((stage, i) => {
              const stageLabels = {
                purchase: 'Purchased',
                warranty_claim: 'Warranty Claim',
                maintenance: 'Maintenance',
                repair: 'Repair',
                replacement: 'Replacement'
              };
              const hasOccurred = eventsData.some(e => e.event_type === stage);
              return `
                <div style="text-align: center; z-index: 2;">
                  <div style="width: 32px; height: 32px; border-radius: 50%; background: ${hasOccurred ? 'var(--brand-teal)' : 'var(--brand-surface-2)'}; border: 2px solid ${hasOccurred ? 'var(--brand-teal)' : 'var(--brand-border-subtle)'}; display: flex; align-items: center; justify-content: center; margin: 0 auto 6px auto;">
                    <span style="font-size: 12px; font-weight: 700; color: ${hasOccurred ? '#070D1E' : 'var(--text-muted)'};">${i+1}</span>
                  </div>
                  <span style="font-size: 11px; color: ${hasOccurred ? 'var(--text-primary)' : 'var(--text-muted)'}; font-weight: ${hasOccurred ? '600' : '400'};">${stageLabels[stage]}</span>
                </div>
              `;
            }).join('')}
          </div>

          <!-- Chronological Event Stream -->
          <h4 style="font-size: 13px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 14px;">Event History</h4>
          <div class="timeline-stream" style="border-left: 2px solid var(--brand-border-subtle); padding-left: 16px; margin-left: 10px;">
            ${eventsData.map(ev => `
              <div style="position: relative; margin-bottom: 20px;">
                <div style="position: absolute; left: -22px; top: 3px; width: 10px; height: 10px; border-radius: 50%; background: var(--brand-teal);"></div>
                <div style="display: flex; justify-content: space-between; font-size: 13px;">
                  <strong>${ev.description || ev.event_type.replace('_', ' ').toUpperCase()}</strong>
                  <span style="color: var(--text-muted); font-size: 12px;">${ev.event_date}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                  <span>Provider: ${ev.service_provider || 'Self / Standard'}</span>
                  ${ev.cost > 0 ? `<span class="privacy-mask" style="font-weight: 600; color: var(--brand-danger);">${curr}${ev.cost.toLocaleString()}</span>` : '<span style="color:var(--brand-teal);">Covered / Free</span>'}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  },

  selectForLifecycle(id) {
    this.selectedPurchaseId = id;
    this.currentTab = 'lifecycle';
    this.switchTab('lifecycle');
  },

  openCreateModal() {
    let modal = document.getElementById('purchase-create-modal');
    if (modal) modal.remove();

    const today = new Date().toISOString().split('T')[0];
    modal = document.createElement('div');
    modal.id = 'purchase-create-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
          <h3 class="modal-title">Record New Purchase</h3>
          <button class="modal-close" onclick="document.getElementById('purchase-create-modal').remove()">✕</button>
        </div>
        <form id="purchase-create-form" onsubmit="window.LedgerViews.purchases.handleCreate(event)">
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Product / Item Name *</label>
              <input type="text" id="p-product-name" class="form-input" placeholder="e.g. Sony WH-1000XM5 Headphones" required>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="form-group">
                <label class="form-label">Price *</label>
                <input type="number" step="any" id="p-price" class="form-input" placeholder="0.00" required>
              </div>
              <div class="form-group">
                <label class="form-label">Purchase Date *</label>
                <input type="date" id="p-date" class="form-input" value="${today}" required>
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="form-group">
                <label class="form-label">Merchant / Store</label>
                <input type="text" id="p-merchant" class="form-input" placeholder="e.g. Amazon, Croma, Apple">
              </div>
              <div class="form-group">
                <label class="form-label">Warranty (Months)</label>
                <input type="number" id="p-warranty-months" class="form-input" placeholder="e.g. 12 or 24" value="12">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Notes</label>
              <textarea id="p-notes" class="form-input" rows="2" placeholder="Serial number, warranty details, invoice reference..."></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('purchase-create-modal').remove()">Cancel</button>
            <button type="submit" class="btn btn-primary">Save to Vault</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  },

  async handleCreate(e) {
    e.preventDefault();
    const payload = {
      product_name: document.getElementById('p-product-name').value.trim(),
      price: parseFloat(document.getElementById('p-price').value),
      purchase_date: document.getElementById('p-date').value,
      merchant: document.getElementById('p-merchant').value.trim(),
      warranty_months: parseInt(document.getElementById('p-warranty-months').value || 0),
      notes: document.getElementById('p-notes').value.trim(),
    };

    try {
      await window.LedgerAPI.createPurchase(payload);
      const m = document.getElementById('purchase-create-modal');
      if (m) m.remove();
      this.loadTabContent();
    } catch (err) {
      alert('Error saving purchase: ' + err.message);
    }
  },

  openEventModal(purchaseId) {
    let modal = document.getElementById('purchase-event-modal');
    if (modal) modal.remove();

    const today = new Date().toISOString().split('T')[0];
    modal = document.createElement('div');
    modal.id = 'purchase-event-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 440px;">
        <div class="modal-header">
          <h3 class="modal-title">Log Lifecycle Event</h3>
          <button class="modal-close" onclick="document.getElementById('purchase-event-modal').remove()">✕</button>
        </div>
        <form id="purchase-event-form" onsubmit="window.LedgerViews.purchases.handleEventSubmit(event, ${purchaseId})">
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Event Type *</label>
              <select id="pe-type" class="form-select">
                <option value="maintenance">Maintenance / Servicing</option>
                <option value="repair">Repair</option>
                <option value="warranty_claim">Warranty Claim</option>
                <option value="replacement">Replacement / Upgrade</option>
              </select>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="form-group">
                <label class="form-label">Event Date *</label>
                <input type="date" id="pe-date" class="form-input" value="${today}" required>
              </div>
              <div class="form-group">
                <label class="form-label">Cost (Out of Pocket)</label>
                <input type="number" step="any" id="pe-cost" class="form-input" placeholder="0.00" value="0">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Service Provider</label>
              <input type="text" id="pe-provider" class="form-input" placeholder="e.g. Authorized Service Center">
            </div>
            <div class="form-group">
              <label class="form-label">Description / Work Done</label>
              <input type="text" id="pe-desc" class="form-input" placeholder="e.g. Battery replacement under warranty" required>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('purchase-event-modal').remove()">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Event</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  },

  async handleEventSubmit(e, purchaseId) {
    e.preventDefault();
    const payload = {
      event_type: document.getElementById('pe-type').value,
      event_date: document.getElementById('pe-date').value,
      cost: parseFloat(document.getElementById('pe-cost').value || 0),
      service_provider: document.getElementById('pe-provider').value.trim(),
      description: document.getElementById('pe-desc').value.trim(),
    };

    try {
      await window.LedgerAPI.addPurchaseEvent(purchaseId, payload);
      const m = document.getElementById('purchase-event-modal');
      if (m) m.remove();
      this.selectedPurchaseId = purchaseId;
      this.currentTab = 'lifecycle';
      this.switchTab('lifecycle');
    } catch (err) {
      alert('Error recording event: ' + err.message);
    }
  },

  async deletePurchase(id) {
    if (!confirm('Are you sure you want to delete this purchase and all its lifecycle records?')) return;
    try {
      await window.LedgerAPI.deletePurchase(id);
      this.loadTabContent();
    } catch (err) {
      alert('Failed to delete purchase: ' + err.message);
    }
  }
};
