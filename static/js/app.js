/**
 * LEDGER MASTER APPLICATION CONTROLLER
 * Single-Page Fintech Operating System Controller
 */

window.LedgerApp = {
  currentRoute: 'dashboard',
  currentUser: null,

  async init() {
    try {
      // 1. Authenticate session
      const meRes = await window.LedgerAPI.getMe();
      if (!meRes.authenticated) {
        window.location.href = '/login';
        return;
      }
      this.currentUser = meRes.user;

      // 2. Initialize Theme
      this.setTheme(this.currentUser.theme || 'dark');

      // 3. Initialize Privacy Mode
      if (this.currentUser.privacy_mode) {
        document.body.classList.add('privacy-active');
        const eyeBtn = document.getElementById('privacy-toggle-btn');
        if (eyeBtn) eyeBtn.classList.add('active');
      }

      // 4. Render User Info in sidebar
      const nameEl = document.getElementById('sidebar-user-name');
      const emailEl = document.getElementById('sidebar-user-email');
      const avatarEl = document.getElementById('sidebar-user-avatar');
      if (nameEl) nameEl.textContent = this.currentUser.full_name;
      if (emailEl) emailEl.textContent = this.currentUser.email;
      if (avatarEl) avatarEl.textContent = (this.currentUser.full_name || 'U').charAt(0).toUpperCase();

      // 5. Setup Hash Routing
      window.addEventListener('hashchange', () => this.handleRouting());
      const initialRoute = window.location.hash.replace('#', '') || 'dashboard';
      this.navigate(initialRoute);

      // 6. First-time onboarding check
      if (!this.currentUser.onboarding_completed) {
        window.LedgerViews.onboarding.checkAndPrompt();
      }

      // 7. Global search listener
      const searchInput = document.getElementById('global-search-bar');
      if (searchInput) {
        let debounceTimer;
        searchInput.oninput = (e) => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            this.handleGlobalSearch(e.target.value.trim());
          }, 300);
        };
      }

      // 8. Register Service Worker for PWA
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/static/sw.js').catch(() => {});
      }

    } catch (err) {
      console.error('Ledger Init Failure:', err);
    }
  },

  navigate(route) {
    window.location.hash = route;
  },

  handleRouting() {
    const route = window.location.hash.replace('#', '') || 'dashboard';
    this.currentRoute = route;

    // Update active nav links (sidebar & mobile)
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.getAttribute('data-route') === route);
    });
    document.querySelectorAll('.mobile-nav-item').forEach(link => {
      link.classList.toggle('active', link.getAttribute('data-route') === route);
    });

    // Update dynamic header title for mobile view
    const titleMap = {
      'dashboard': 'Dashboard',
      'transactions': 'Transactions',
      'budgets': 'Budgets',
      'analytics': 'Analytics',
      'goals': 'Goals',
      'calendar': 'Financial Calendar',
      'purchases': 'Purchases Vault',
      'documents': 'Document Vault',
      'shared-expenses': 'Shared Expenses',
      'twin': 'Financial Twin',
      'health': 'Health Center',
      'net-worth': 'Net Worth',
      'ai': 'Ask Ledger AI',
      'reports': 'Reports & Export',
      'settings': 'Settings',
      'more': 'More Hub'
    };
    const titleEl = document.getElementById('mobile-header-active-title');
    if (titleEl) {
      titleEl.textContent = titleMap[route] || 'Ledger';
    }

    const container = document.getElementById('view-container');
    if (!container) return;

    // Scroll to top on navigation
    window.scrollTo(0, 0);

    // Route dispatch
    switch (route) {
      case 'dashboard':
        window.LedgerViews.dashboard.render(container);
        break;
      case 'transactions':
        window.LedgerViews.transactions.render(container);
        break;
      case 'analytics':
        window.LedgerViews.analytics.render(container);
        break;
      case 'goals':
        window.LedgerViews.goals.render(container);
        break;
      case 'calendar':
        window.LedgerViews.calendar.render(container);
        break;
      case 'budgets':
        window.LedgerViews.budgets.render(container);
        break;
      case 'purchases':
        window.LedgerViews.purchases.render(container);
        break;
      case 'documents':
        window.LedgerViews.documents.render(container);
        break;
      case 'shared-expenses':
        window.LedgerViews.sharedExpenses.render(container);
        break;
      case 'twin':
        window.LedgerViews.financialTwin.render(container);
        break;
      case 'health':
        window.LedgerViews.health.render(container);
        break;
      case 'net-worth':
        window.LedgerViews.netWorth.render(container);
        break;
      case 'ai':
        window.LedgerViews.aiAssistant.render(container);
        break;
      case 'reports':
        window.LedgerViews.reports.render(container);
        break;
      case 'settings':
        window.LedgerViews.settings.render(container);
        break;
      case 'more':
        window.LedgerViews.more.render(container);
        break;
      default:
        window.LedgerViews.dashboard.render(container);
    }

    // Close mobile sidebar if open
    const sidebar = document.getElementById('app-sidebar');
    if (sidebar) sidebar.classList.remove('open');
  },

  refreshCurrentView() {
    this.handleRouting();
  },

  toggleSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    if (sidebar) sidebar.classList.toggle('open');
  },

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  },

  async togglePrivacyMode() {
    try {
      const res = await window.LedgerAPI.togglePrivacy();
      const isActive = res.privacy_mode;
      document.body.classList.toggle('privacy-active', isActive);

      const btn = document.getElementById('privacy-toggle-btn');
      if (btn) btn.classList.toggle('active', isActive);

      if (this.currentUser) this.currentUser.privacy_mode = isActive;
    } catch (e) {
      document.body.classList.toggle('privacy-active');
    }
  },

  openSearchModal() {
    this.handleGlobalSearch(' ');
    setTimeout(() => {
      const inp = document.getElementById('modal-search-input');
      if (inp) inp.focus();
    }, 100);
  },

  async handleGlobalSearch(q) {
    let modal = document.getElementById('global-search-modal');
    if (q === null || q === undefined) {
      if (modal) modal.remove();
      return;
    }

    const trimmed = (q || '').trim();

    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'global-search-modal';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-content" style="max-width:680px; max-height:85vh; max-height:85dvh; overflow-y:auto;">
        <span class="modal-drag-handle"></span>
        <div class="modal-header" style="flex-direction:column; align-items:stretch; gap:12px; padding-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:8px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <h3 class="modal-title">Search Records</h3>
            </div>
            <button class="modal-close" onclick="document.getElementById('global-search-modal').remove()">✕</button>
          </div>
          <div style="position:relative;">
            <input type="text" id="modal-search-input" class="form-control" style="padding-left:36px;" placeholder="Search transactions, bills, goals, documents..." value="${trimmed}">
            <svg style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-muted);" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </div>
        </div>
        <div class="modal-body" id="search-results-stream" style="padding-top:0;">
          <div style="text-align:center; padding:20px; color:var(--brand-teal); font-size:13px;">${trimmed ? 'Searching your records across Ledger...' : 'Type above to search transactions, bills, goals, and vault...'}</div>
        </div>
      </div>
    `;

    // Hook up real-time search on modal input
    const modalInp = document.getElementById('modal-search-input');
    if (modalInp) {
      let debounce;
      modalInp.oninput = (e) => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          this.executeSearchQuery(e.target.value.trim());
        }, 300);
      };
    }

    if (trimmed) {
      this.executeSearchQuery(trimmed);
    }
  },

  async executeSearchQuery(q) {
    const stream = document.getElementById('search-results-stream');
    if (!stream) return;
    if (!q) {
      stream.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:13px;">Type above to search across Ledger records...</div>';
      return;
    }
    stream.innerHTML = '<div style="text-align:center; padding:20px; color:var(--brand-teal); font-size:13px;">Searching your records...</div>';

    try {
      const res = await window.LedgerAPI.search(q);
      const curr = this.currentUser?.currency || '₹';
      const stream = document.getElementById('search-results-stream');

      if (res.total_results === 0) {
        stream.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted);">No records found matching "${q}".</div>`;
        return;
      }

      let html = '';

      if (res.transactions && res.transactions.length > 0) {
        html += `<h4 style="font-size:12px; text-transform:uppercase; color:var(--brand-teal); margin-bottom:8px;">Transactions (${res.transactions.length})</h4>`;
        html += res.transactions.map(t => `
          <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--brand-border-subtle); font-size:13px;">
            <div>
              <strong>${t.merchant || 'Transaction'}</strong>
              <div style="font-size:11px; color:var(--text-muted);">${t.date} • ${t.category_name} ${t.location_name ? '📍 ' + t.location_name : ''}</div>
            </div>
            <strong class="privacy-mask" style="color:${t.type==='income'?'var(--brand-teal)':'var(--text-primary)'};">${curr}${t.amount}</strong>
          </div>
        `).join('');
      }

      if (res.purchases && res.purchases.length > 0) {
        html += `<h4 style="font-size:12px; text-transform:uppercase; color:#E36414; margin:14px 0 8px 0;">Purchases & Vault (${res.purchases.length})</h4>`;
        html += res.purchases.map(p => `
          <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--brand-border-subtle); font-size:13px;">
            <div>
              <strong>${p.product_name}</strong>
              <div style="font-size:11px; color:var(--text-muted);">${p.purchase_date} • ${p.merchant} • Status: ${p.lifecycle_status}</div>
            </div>
            <strong class="privacy-mask">${curr}${p.price}</strong>
          </div>
        `).join('');
      }

      if (res.documents && res.documents.length > 0) {
        html += `<h4 style="font-size:12px; text-transform:uppercase; color:#06D6A0; margin:14px 0 8px 0;">Document Vault (${res.documents.length})</h4>`;
        html += res.documents.map(d => `
          <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--brand-border-subtle); font-size:13px;">
            <div>
              <strong>📄 ${d.title}</strong>
              <div style="font-size:11px; color:var(--text-muted);">${d.category} • ${d.file_name}</div>
            </div>
            <a href="/api/documents/${d.id}/download" class="btn btn-secondary" style="font-size:11px; padding:3px 8px;" download>Download</a>
          </div>
        `).join('');
      }

      if (res.goals && res.goals.length > 0) {
        html += `<h4 style="font-size:12px; text-transform:uppercase; color:var(--brand-blue); margin:14px 0 8px 0;">Goals (${res.goals.length})</h4>`;
        html += res.goals.map(g => `
          <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--brand-border-subtle); font-size:13px;">
            <div><strong>${g.name}</strong></div>
            <div>${curr}${g.current_amount} / ${curr}${g.target_amount}</div>
          </div>
        `).join('');
      }

      if (res.bills && res.bills.length > 0) {
        html += `<h4 style="font-size:12px; text-transform:uppercase; color:var(--brand-danger); margin:14px 0 8px 0;">Bills (${res.bills.length})</h4>`;
        html += res.bills.map(b => `
          <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--brand-border-subtle); font-size:13px;">
            <div><strong>${b.title}</strong> (Due: ${b.due_date})</div>
            <div>${curr}${b.amount}</div>
          </div>
        `).join('');
      }

      if (res.memories && res.memories.length > 0) {
        html += `<h4 style="font-size:12px; text-transform:uppercase; color:#A855F7; margin:14px 0 8px 0;">AI Financial Memories (${res.memories.length})</h4>`;
        html += res.memories.map(m => `
          <div style="padding:8px 0; border-bottom:1px solid var(--brand-border-subtle); font-size:13px;">
            <strong style="color:var(--text-primary);">🧠 ${m.title}</strong>
            <div style="font-size:12px; color:var(--text-secondary);">${m.content}</div>
          </div>
        `).join('');
      }

      if (res.workspaces && res.workspaces.length > 0) {
        html += `<h4 style="font-size:12px; text-transform:uppercase; color:#F59E0B; margin:14px 0 8px 0;">Shared Workspaces (${res.workspaces.length})</h4>`;
        html += res.workspaces.map(w => `
          <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--brand-border-subtle); font-size:13px;">
            <div><strong>👥 ${w.name}</strong></div>
            <a href="#shared-expenses" onclick="document.getElementById('global-search-modal').remove()" style="font-size:12px; color:var(--brand-teal);">View Workspace</a>
          </div>
        `).join('');
      }

      stream.innerHTML = html;
    } catch (e) {
      document.getElementById('search-results-stream').innerHTML = `<div style="color:var(--brand-danger);">${e.message}</div>`;
    }
  }
};

// Bootstrap application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.LedgerApp.init();
});
