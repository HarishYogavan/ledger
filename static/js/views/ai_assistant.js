/**
 * LEDGER AI ASSISTANT, FINANCIAL MEMORY & MONTHLY STORY
 */

window.LedgerViews = window.LedgerViews || {};

window.LedgerViews.aiAssistant = {
  activeTab: 'chat', // 'chat' | 'memory' | 'story'

  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <div style="display:flex; align-items:center; gap:8px;">
            <h1 class="page-title">Ledger AI Intelligence</h1>
            <span class="badge" style="background:rgba(6,214,160,0.1); color:var(--brand-teal); border:1px solid rgba(6,214,160,0.3);">Strictly Data-Grounded</span>
          </div>
          <p class="page-subtitle">Your personal financial assistant, memory repository, and visual monthly recaps.</p>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="tab-pills" style="margin-bottom: 20px;">
        <button class="tab-pill ${this.activeTab==='chat'?'active':''}" onclick="window.LedgerViews.aiAssistant.switchTab('chat')">
          Ask Ledger AI
        </button>
        <button class="tab-pill ${this.activeTab==='memory'?'active':''}" onclick="window.LedgerViews.aiAssistant.switchTab('memory')">
          AI Financial Memory
        </button>
        <button class="tab-pill ${this.activeTab==='story'?'active':''}" onclick="window.LedgerViews.aiAssistant.switchTab('story')">
          Monthly Financial Story
        </button>
      </div>

      <div id="ai-view-body">
        <div style="text-align:center; padding: 40px; color: var(--brand-teal);">Loading AI service...</div>
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
    const container = document.getElementById('ai-view-body');
    if (!container) return;

    if (this.activeTab === 'chat') {
      this.renderChat(container);
    } else if (this.activeTab === 'memory') {
      this.renderMemory(container);
    } else if (this.activeTab === 'story') {
      this.renderStory(container);
    }
  },

  // 1. Ask Ledger AI Chat
  async renderChat(container) {
    try {
      const data = await window.LedgerAPI.getAIChats();
      const messages = data.messages || [];

      container.innerHTML = `
        <div class="card" style="padding:16px; margin-bottom:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size:13px; color:var(--text-secondary);">
              Answers are computed strictly from your actual recorded transactions, goals, and assets.
            </div>
            <button class="btn btn-secondary" style="font-size:11px; padding:4px 10px;" onclick="window.LedgerViews.aiAssistant.clearChat()">
              Clear History
            </button>
          </div>
        </div>

        <div class="ai-chat-container">
          <!-- Suggested Prompt Chips -->
          <div class="ai-prompt-chips">
            <div class="prompt-chip" onclick="window.LedgerViews.aiAssistant.sendPrompt('Where did most of my money go?')">
              💸 Where did most of my money go?
            </div>
            <div class="prompt-chip" onclick="window.LedgerViews.aiAssistant.sendPrompt('Show my Expense DNA.')">
              🧬 Show my Expense DNA.
            </div>
            <div class="prompt-chip" onclick="window.LedgerViews.aiAssistant.sendPrompt('When does my warranty expire?')">
              🛡️ When does my warranty expire?
            </div>
            <div class="prompt-chip" onclick="window.LedgerViews.aiAssistant.sendPrompt('Show my saved financial memories.')">
              🧠 Show my saved financial memories.
            </div>
            <div class="prompt-chip" onclick="window.LedgerViews.aiAssistant.sendPrompt('What recurring payments do I have?')">
              🔄 What recurring payments do I have?
            </div>
          </div>

          <!-- Message Stream -->
          <div class="ai-chat-messages" id="ai-chat-stream">
            ${messages.length === 0 ? `
              <div style="text-align:center; padding:50px 20px; color:var(--text-muted);">
                <img src="/static/icons/logo-192.png" alt="AI" style="width:48px; height:48px; opacity:0.8; margin-bottom:12px;">
                <h3 style="font-size:16px; color:var(--text-primary); margin-bottom:4px;">Ask Ledger AI</h3>
                <p style="font-size:13px; max-width:440px; margin:0 auto; line-height:1.5;">
                  Ask about your spending habits, upcoming bills, warranty expirations, or goal progress.
                </p>
              </div>
            ` : messages.map(m => `
              <div class="chat-bubble ${m.role === 'user' ? 'bubble-user' : 'bubble-assistant'}">
                ${m.message.replace(/\n/g, '<br>')}
                ${m.role === 'assistant' ? `<span class="bubble-source-tag">Verified by Ledger Intelligence Engine</span>` : ''}
              </div>
            `).join('')}
          </div>

          <!-- Input Bar -->
          <div class="ai-chat-input-bar">
            <input type="text" id="ai-query-input" class="form-control" placeholder="Ask anything about your money..." onkeydown="if(event.key==='Enter') window.LedgerViews.aiAssistant.handleSend()">
            <button class="btn btn-primary" onclick="window.LedgerViews.aiAssistant.handleSend()">
              Send
            </button>
          </div>
        </div>
      `;

      const stream = document.getElementById('ai-chat-stream');
      if (stream) stream.scrollTop = stream.scrollHeight;
    } catch (err) {
      container.innerHTML = `<div class="card" style="color:var(--brand-danger);">${err.message}</div>`;
    }
  },

  async handleSend() {
    const input = document.getElementById('ai-query-input');
    const query = input.value.trim();
    if (!query) return;

    input.value = '';
    const stream = document.getElementById('ai-chat-stream');

    stream.innerHTML += `<div class="chat-bubble bubble-user">${query}</div>`;
    const loaderId = 'ai-typing-' + Date.now();
    stream.innerHTML += `<div id="${loaderId}" class="chat-bubble bubble-assistant" style="opacity:0.7;">Thinking...</div>`;
    stream.scrollTop = stream.scrollHeight;

    try {
      const res = await window.LedgerAPI.askAI(query);
      const loader = document.getElementById(loaderId);
      if (loader) {
        loader.innerHTML = `
          ${res.response.replace(/\n/g, '<br>')}
          <span class="bubble-source-tag">Source: ${res.source === 'gemini' ? 'Gemini 1.5 Flash' : 'Ledger Deterministic Engine'}</span>
        `;
        loader.style.opacity = '1';
      }
    } catch (e) {
      const loader = document.getElementById(loaderId);
      if (loader) loader.innerHTML = `<span style="color:var(--brand-danger);">Unable to calculate response: ${e.message}</span>`;
    }

    stream.scrollTop = stream.scrollHeight;
  },

  sendPrompt(text) {
    const input = document.getElementById('ai-query-input');
    if (input) {
      input.value = text;
      this.handleSend();
    }
  },

  async clearChat() {
    if (!confirm('Clear all conversation history?')) return;
    try {
      await window.LedgerAPI.clearAIChats();
      this.loadActiveTab();
    } catch (err) {
      alert('Error clearing chat: ' + err.message);
    }
  },

  // 2. AI Financial Memory
  async renderMemory(container) {
    try {
      const res = await window.LedgerAPI.getMemories();
      const memories = res.memories || [];

      container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <div>
            <h2 style="font-size:18px; margin:0 0 4px 0;">AI Financial Memory</h2>
            <p style="font-size:13px; color:var(--text-secondary);">
              Notes and personal intentions saved here are referenced by Ask Ledger AI during conversations.
            </p>
          </div>
          <button class="btn btn-primary" onclick="window.LedgerViews.aiAssistant.openCreateMemoryModal()">
            + Save Memory
          </button>
        </div>

        ${memories.length === 0 ? `
          <div class="empty-state-card">
            <h3 class="empty-state-title">No Financial Memories Yet</h3>
            <p class="empty-state-desc">Store intentional guidelines like "I want to save ₹1 lakh for education" or "I plan to buy a laptop next year".</p>
            <button class="btn btn-primary" onclick="window.LedgerViews.aiAssistant.openCreateMemoryModal()">+ Create First Memory</button>
          </div>
        ` : `
          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:16px;">
            ${memories.map(m => `
              <div class="card" style="display:flex; flex-direction:column; justify-content:space-between;">
                <div>
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                    <h3 style="font-size:15px; margin:0;">${m.title}</h3>
                    <button class="btn-icon" style="color:var(--brand-danger);" onclick="window.LedgerViews.aiAssistant.deleteMemory(${m.id})">✕</button>
                  </div>
                  <p style="font-size:13px; color:var(--text-secondary); line-height:1.4; margin-bottom:12px;">
                    ${m.content}
                  </p>
                </div>
                <div style="font-size:11px; color:var(--text-muted); border-top:1px solid var(--brand-border-subtle); padding-top:8px;">
                  Logged: ${m.created_at ? m.created_at.split('T')[0] : ''}
                </div>
              </div>
            `).join('')}
          </div>
        `}
      `;
    } catch (err) {
      container.innerHTML = `<div class="card" style="color:var(--brand-danger);">${err.message}</div>`;
    }
  },

  openCreateMemoryModal() {
    let modal = document.getElementById('memory-modal');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'memory-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content" style="max-width:440px;">
        <div class="modal-header">
          <h3 class="modal-title">Record Financial Memory</h3>
          <button class="modal-close" onclick="document.getElementById('memory-modal').remove()">✕</button>
        </div>
        <form onsubmit="window.LedgerViews.aiAssistant.handleCreateMemory(event)">
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Title / Topic *</label>
              <input type="text" id="mem-title" class="form-input" placeholder="e.g. Vacation Budget, Vehicle Plan" required>
            </div>
            <div class="form-group">
              <label class="form-label">Note / Intention *</label>
              <textarea id="mem-content" class="form-input" rows="3" placeholder="e.g. I plan to maintain a liquid reserve of ₹2 lakh and avoid personal loans." required></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('memory-modal').remove()">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Memory</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  },

  async handleCreateMemory(e) {
    e.preventDefault();
    const payload = {
      title: document.getElementById('mem-title').value.trim(),
      content: document.getElementById('mem-content').value.trim(),
    };
    try {
      await window.LedgerAPI.createMemory(payload);
      document.getElementById('memory-modal').remove();
      this.loadActiveTab();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  },

  async deleteMemory(id) {
    if (!confirm('Remove this financial memory?')) return;
    try {
      await window.LedgerAPI.deleteMemory(id);
      this.loadActiveTab();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  },

  // 3. Monthly Financial Story
  async renderStory(container) {
    const todayMonth = new Date().toISOString().slice(0, 7);
    container.innerHTML = `
      <div class="card" style="margin-bottom:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <h2 style="font-size:18px; margin:0 0 4px 0;">Monthly Financial Story</h2>
            <p style="font-size:13px; color:var(--text-secondary);">A visual editorial narrative of your monthly financial trajectory.</p>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <input type="month" id="story-month-input" class="form-input" style="width:150px;" value="${todayMonth}" onchange="window.LedgerViews.aiAssistant.fetchStory(this.value)">
          </div>
        </div>
      </div>

      <div id="monthly-story-stream">
        <div style="text-align:center; padding:30px; color:var(--text-muted);">Crafting your financial story...</div>
      </div>
    `;

    this.fetchStory(todayMonth);
  },

  async fetchStory(monthStr) {
    const stream = document.getElementById('monthly-story-stream');
    if (!stream) return;

    try {
      const story = await window.LedgerAPI.getMonthlyStory(monthStr);
      const curr = story.currency || '₹';
      const m = story.metrics || {};
      const cats = story.top_categories || [];

      stream.innerHTML = `
        <!-- Story Headline Card -->
        <div class="card" style="background:linear-gradient(135deg, rgba(6,214,160,0.08) 0%, rgba(7,13,30,0.9) 100%); border:1px solid rgba(6,214,160,0.25); margin-bottom:20px; padding:24px;">
          <span style="font-size:11px; text-transform:uppercase; color:var(--brand-teal); font-weight:700;">Monthly Chapter Recap</span>
          <h2 style="font-size:22px; margin:8px 0 12px 0;">${story.headline}</h2>
          <p style="font-size:14px; line-height:1.6; color:var(--text-primary); margin:0;">
            ${story.narrative}
          </p>
        </div>

        <!-- Metrics Grid -->
        <div class="grid-cols-4" style="margin-bottom:20px;">
          <div class="card metric-card">
            <div class="metric-label">Total Inflow</div>
            <div class="metric-value privacy-mask" style="color:var(--brand-teal);">${curr}${m.income.toLocaleString()}</div>
          </div>
          <div class="card metric-card">
            <div class="metric-label">Total Outflow</div>
            <div class="metric-value privacy-mask" style="color:var(--brand-danger);">${curr}${m.expenses.toLocaleString()}</div>
          </div>
          <div class="card metric-card">
            <div class="metric-label">Net Surplus</div>
            <div class="metric-value privacy-mask">${curr}${m.net_savings.toLocaleString()}</div>
          </div>
          <div class="card metric-card">
            <div class="metric-label">Savings Velocity</div>
            <div class="metric-value">${m.savings_rate}%</div>
          </div>
        </div>

        <!-- Top Categories & Major Transactions -->
        <div class="grid-cols-2" style="gap:20px;">
          <div class="card">
            <h3 style="font-size:15px; margin-bottom:12px;">Top Spending Drivers</h3>
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${cats.map(c => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; background:rgba(255,255,255,0.02); border-radius:6px; font-size:13px;">
                  <span>${c.category}</span>
                  <div>
                    <strong class="privacy-mask">${curr}${c.amount.toLocaleString()}</strong>
                    <span style="font-size:11px; color:var(--text-muted); margin-left:6px;">(${c.percent}%)</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="card">
            <h3 style="font-size:15px; margin-bottom:12px;">Major Transactions</h3>
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${(story.top_transactions || []).map(t => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; background:rgba(255,255,255,0.02); border-radius:6px; font-size:13px;">
                  <div>
                    <strong>${t.merchant || 'Expense'}</strong>
                    <div style="font-size:11px; color:var(--text-muted);">${t.date} • ${t.category_name}</div>
                  </div>
                  <strong class="privacy-mask" style="color:var(--brand-danger);">${curr}${t.amount.toLocaleString()}</strong>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      stream.innerHTML = `<div class="card" style="color:var(--brand-danger);">${err.message}</div>`;
    }
  }
};
