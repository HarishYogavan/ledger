/**
 * FINANCIAL DOCUMENT VAULT VIEW
 */

window.LedgerViews = window.LedgerViews || {};

window.LedgerViews.documents = {
  currentCategory: 'all',
  searchQuery: '',

  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Document Vault</h1>
          <p class="page-subtitle">Encrypted, user-isolated storage for financial statements, receipts, warranties, and reports.</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-primary" onclick="window.LedgerViews.documents.openUploadModal()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            + Upload Document
          </button>
        </div>
      </div>

      <!-- Filter Controls & Search -->
      <div class="card" style="margin-bottom: 20px; padding: 14px 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <!-- Category Pills -->
          <div class="tab-pills" style="margin-bottom: 0;">
            ${['all', 'receipt', 'bill', 'statement', 'warranty', 'report'].map(cat => `
              <button class="tab-pill ${this.currentCategory === cat ? 'active' : ''}" onclick="window.LedgerViews.documents.filterCategory('${cat}')">
                ${cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            `).join('')}
          </div>

          <!-- Document Search Box -->
          <div style="position: relative; min-width: 240px;">
            <input type="text" id="doc-search-input" class="form-input" placeholder="Search filenames & notes..." value="${this.searchQuery}" oninput="window.LedgerViews.documents.handleSearch(event)">
          </div>
        </div>
      </div>

      <!-- Document Grid -->
      <div id="documents-grid-stream">
        <div style="text-align: center; padding: 40px; color: var(--text-muted);">Loading secure documents...</div>
      </div>
    `;

    this.loadDocuments();
  },

  filterCategory(cat) {
    this.currentCategory = cat;
    document.querySelectorAll('.tab-pill').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    this.loadDocuments();
  },

  handleSearch(e) {
    this.searchQuery = e.target.value.trim();
    clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => this.loadDocuments(), 300);
  },

  async loadDocuments() {
    const stream = document.getElementById('documents-grid-stream');
    if (!stream) return;

    try {
      const res = await window.LedgerAPI.getDocuments(this.currentCategory, this.searchQuery);
      const docs = res.documents || [];

      if (docs.length === 0) {
        stream.innerHTML = `
          <div class="empty-state-card">
            <div class="empty-state-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--brand-teal)" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <h3 class="empty-state-title">No Financial Documents Found</h3>
            <p class="empty-state-desc">Securely upload invoices, bank statements, warranties, and insurance policies for instant retrieval.</p>
            <button class="btn btn-primary" onclick="window.LedgerViews.documents.openUploadModal()">+ Upload First Document</button>
          </div>
        `;
        return;
      }

      stream.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">
          ${docs.map(d => {
            const kbSize = Math.round(d.file_size / 1024);
            const isPdf = d.mime_type.includes('pdf');
            const isImg = d.mime_type.includes('image');

            return `
              <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                  <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                    <div style="width: 38px; height: 38px; border-radius: 8px; background: rgba(6, 214, 160, 0.1); border: 1px solid rgba(6, 214, 160, 0.2); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand-teal)" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </div>
                    <div style="overflow: hidden;">
                      <h4 style="font-size: 14px; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${d.original_name}">${d.original_name}</h4>
                      <span style="font-size: 11px; color: var(--text-muted);">${kbSize} KB • ${d.created_at ? d.created_at.split('T')[0] : ''}</span>
                    </div>
                  </div>

                  <div style="display: flex; gap: 6px; margin-bottom: 10px;">
                    <span class="badge" style="background: rgba(255,255,255,0.06); text-transform: uppercase; font-size: 10px;">${d.category}</span>
                  </div>

                  ${d.notes ? `<p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px; line-height: 1.4;">${d.notes}</p>` : ''}
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px solid var(--brand-border-subtle); margin-top: 8px;">
                  <a href="${d.download_url}" target="_blank" class="btn btn-secondary" style="font-size: 12px; padding: 4px 10px; display: inline-flex; align-items: center; gap: 6px; text-decoration: none;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Download
                  </a>
                  <button class="btn-icon" title="Delete Document" onclick="window.LedgerViews.documents.deleteDocument(${d.id})">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brand-danger)" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } catch (err) {
      stream.innerHTML = `<div class="card" style="color:var(--brand-danger);">Failed to load vault documents: ${err.message}</div>`;
    }
  },

  openUploadModal() {
    let modal = document.getElementById('doc-upload-modal');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'doc-upload-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 480px;">
        <div class="modal-header">
          <h3 class="modal-title">Upload Financial Document</h3>
          <button class="modal-close" onclick="document.getElementById('doc-upload-modal').remove()">✕</button>
        </div>
        <form id="doc-upload-form" onsubmit="window.LedgerViews.documents.handleUpload(event)">
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Select File (PDF, Image, Spreadsheet) *</label>
              <input type="file" id="doc-file-input" class="form-input" required>
            </div>
            <div class="form-group">
              <label class="form-label">Document Category *</label>
              <select id="doc-category" class="form-select">
                <option value="statement">Bank / Card Statement</option>
                <option value="receipt">Invoice / Receipt</option>
                <option value="bill">Utility / Regular Bill</option>
                <option value="warranty">Warranty Document</option>
                <option value="report">Tax / Investment Report</option>
                <option value="other">Other Document</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Notes / Description</label>
              <textarea id="doc-notes" class="form-input" rows="2" placeholder="e.g. FY 2025-26 Form 16, HDFC Term Deposit advice..."></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('doc-upload-modal').remove()">Cancel</button>
            <button type="submit" class="btn btn-primary">Upload & Encrypt</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  },

  async handleUpload(e) {
    e.preventDefault();
    const fileInput = document.getElementById('doc-file-input');
    if (!fileInput.files.length) {
      alert('Please select a file to upload');
      return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('category', document.getElementById('doc-category').value);
    formData.append('notes', document.getElementById('doc-notes').value.trim());

    try {
      await window.LedgerAPI.uploadDocument(formData);
      const m = document.getElementById('doc-upload-modal');
      if (m) m.remove();
      this.loadDocuments();
    } catch (err) {
      alert('Upload failed: ' + err.message);
    }
  },

  async deleteDocument(id) {
    if (!confirm('Are you sure you want to permanently delete this document?')) return;
    try {
      await window.LedgerAPI.deleteDocument(id);
      this.loadDocuments();
    } catch (err) {
      alert('Failed to delete document: ' + err.message);
    }
  }
};
