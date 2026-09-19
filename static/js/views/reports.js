/**
 * LEDGER REPORTS VIEW
 */

window.LedgerViews = window.LedgerViews || {};

window.LedgerViews.reports = {
  currentType: 'monthly',

  async render(container) {
    container.innerHTML = `
      <div style="display:flex; justify-content:center; padding:60px;">
        <div style="color:var(--brand-teal); font-weight:600;">Generating Financial Report...</div>
      </div>
    `;

    try {
      const data = await window.LedgerAPI.getReportData(this.currentType);
      const curr = data.currency || '₹';
      const sum = data.summary || {};
      const cats = data.categories || [];
      const txs = data.transactions || [];

      container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; flex-wrap:wrap; gap:16px;">
          <div>
            <h1 style="font-size:24px; margin-bottom:4px;">Financial Reports</h1>
            <p style="font-size:13px; color:var(--text-secondary);">${data.period_title} — Generated ${data.generated_at}</p>
          </div>
          <div style="display:flex; gap:10px;">
            <button class="btn btn-secondary" onclick="window.LedgerViews.reports.downloadPDF()">
              📄 Export Branded PDF
            </button>
            <button class="btn btn-primary" onclick="window.LedgerViews.reports.downloadCSV()">
              📥 Export CSV
            </button>
          </div>
        </div>

        <!-- Report Type Tabs -->
        <div class="quick-add-tabs" style="margin-bottom:24px;">
          ${['monthly', 'yearly', 'income', 'expense', 'category', 'savings', 'net_worth'].map(t => `
            <button class="tab-btn ${this.currentType === t ? 'active' : ''}" onclick="window.LedgerViews.reports.setType('${t}')">
              ${t.replace('_', ' ').toUpperCase()}
            </button>
          `).join('')}
        </div>

        <!-- Executive Summary Card -->
        <div class="card" style="margin-bottom:24px;">
          <h3 style="font-size:16px; margin-bottom:14px;">Executive Summary (${data.period_title})</h3>
          <div class="grid-cols-4" style="gap:16px;">
            <div style="background:var(--brand-surface); padding:12px 16px; border-radius:var(--radius-md);">
              <span style="font-size:11px; text-transform:uppercase; color:var(--text-muted);">Total Income</span>
              <div style="font-size:20px; font-weight:700; color:var(--brand-teal);" class="privacy-mask">${curr}${sum.total_income.toLocaleString()}</div>
            </div>
            <div style="background:var(--brand-surface); padding:12px 16px; border-radius:var(--radius-md);">
              <span style="font-size:11px; text-transform:uppercase; color:var(--text-muted);">Total Expenses</span>
              <div style="font-size:20px; font-weight:700; color:var(--brand-danger);" class="privacy-mask">${curr}${sum.total_expenses.toLocaleString()}</div>
            </div>
            <div style="background:var(--brand-surface); padding:12px 16px; border-radius:var(--radius-md);">
              <span style="font-size:11px; text-transform:uppercase; color:var(--text-muted);">Net Savings</span>
              <div style="font-size:20px; font-weight:700;" class="privacy-mask">${curr}${sum.net_savings.toLocaleString()}</div>
            </div>
            <div style="background:var(--brand-surface); padding:12px 16px; border-radius:var(--radius-md);">
              <span style="font-size:11px; text-transform:uppercase; color:var(--text-muted);">Savings Rate</span>
              <div style="font-size:20px; font-weight:700;">${sum.savings_rate}%</div>
            </div>
          </div>
        </div>

        <!-- Categories & Transactions Tables -->
        <div class="card">
          <h3 style="font-size:16px; margin-bottom:14px;">Detailed Category Breakdown</h3>
          <div class="data-table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Transaction Count</th>
                  <th style="text-align:right;">Total Volume</th>
                </tr>
              </thead>
              <tbody>
                ${cats.length > 0 ? cats.map(c => `
                  <tr>
                    <td>
                      <span class="category-pill">
                        <span class="cat-dot" style="background:${c.color};"></span>
                        ${c.name}
                      </span>
                    </td>
                    <td style="text-transform:capitalize; color:var(--text-secondary);">${c.type}</td>
                    <td>${c.count} transactions</td>
                    <td style="text-align:right; font-weight:700;" class="privacy-mask">${curr}${c.total.toLocaleString()}</td>
                  </tr>
                `).join('') : `
                  <tr><td colspan="4" style="text-align:center; color:var(--text-muted);">No records in this report window</td></tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="card" style="border-color:var(--brand-danger);">${err.message}</div>`;
    }
  },

  setType(t) {
    this.currentType = t;
    this.render(document.getElementById('view-container'));
  },

  async downloadCSV() {
    try {
      const blob = await window.LedgerAPI.request(`/api/reports/export-csv?type=${this.currentType}`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ledger_${this.currentType}_report.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert('Failed to download CSV: ' + err.message);
    }
  },

  async downloadPDF() {
    try {
      const response = await fetch(`/api/reports/export-pdf?type=${this.currentType}`, {
        headers: {
          'Authorization': `Bearer ${window.LedgerAPI.getToken()}`
        }
      });
      if (!response.ok) throw new Error('PDF generation failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ledger_${this.currentType}_report.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert('Failed to download PDF: ' + err.message);
    }
  }
};
