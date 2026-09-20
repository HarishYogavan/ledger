/**
 * LEDGER API CLIENT
 * Handles authentication headers, error handling, and JSON/file requests.
 */

window.LedgerAPI = {
  tokenKey: 'ledger_auth_token',

  getToken() {
    return localStorage.getItem(this.tokenKey);
  },

  setToken(token) {
    if (token) localStorage.setItem(this.tokenKey, token);
    else localStorage.removeItem(this.tokenKey);
  },

  async request(endpoint, options = {}) {
    const headers = options.headers || {};
    const token = this.getToken();

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['X-Auth-Token'] = token;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    // Developer-side non-sensitive logging
    console.log(`[LedgerAPI] ${options.method || 'GET'} ${endpoint}`);

    // Setup request timeout via AbortController (default 15s)
    const controller = new AbortController();
    const timeoutMs = options.timeout || 15000;
    const timerId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    const config = {
      credentials: 'same-origin',
      ...options,
      headers,
      signal: controller.signal
    };

    try {
      const response = await fetch(endpoint, config);

      // Check if file download (CSV / ZIP)
      const contentType = response.headers.get('Content-Type') || '';
      if (contentType.includes('text/csv') || contentType.includes('application/zip')) {
        if (!response.ok) {
          throw new Error('File download failed with status ' + response.status);
        }
        return response.blob();
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg = data.error || (response.status === 401 ? 'Authentication required' : 'API request failed');

        // Only trigger session revocation for protected endpoints (not login/register)
        if (response.status === 401 && !endpoint.startsWith('/api/auth/login') && !endpoint.startsWith('/api/auth/register')) {
          this.setToken(null);
          if (window.LedgerAuth) {
            window.LedgerAuth.setState(window.LedgerAuth.STATE_UNAUTHENTICATED, null);
          }
          if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
            window.location.href = '/login';
          }
        }

        const err = new Error(errorMsg);
        err.status = response.status;
        err.data = data;
        throw err;
      }

      return data;
    } catch (err) {
      if (err.name === 'AbortError') {
        const timeoutErr = new Error('Request timed out. Please check your network connection.');
        timeoutErr.status = 408;
        console.error(`[LedgerAPI] Timeout [${endpoint}] after ${timeoutMs}ms`);
        throw timeoutErr;
      }
      console.error(`API Error [${endpoint}]:`, err.message);
      throw err;
    } finally {
      clearTimeout(timerId);
    }
  },

  // Auth endpoints
  async getMe() { return this.request('/api/auth/me'); },
  async login(email, password) {
    const res = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (res && res.token) this.setToken(res.token);
    return res;
  },
  async register(full_name, email, password, currency) {
    const res = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ full_name, email, password, currency })
    });
    if (res && res.token) this.setToken(res.token);
    return res;
  },
  async logout() {
    try { await this.request('/api/auth/logout', { method: 'POST' }); }
    finally {
      this.setToken(null);
      if (window.LedgerAuth) {
        window.LedgerAuth.setState(window.LedgerAuth.STATE_UNAUTHENTICATED, null);
      }
      window.location.replace('/login');
    }
  },
  async getSessions() {
    return this.request('/api/auth/sessions');
  },
  async revokeSession(sessionId) {
    return this.request(`/api/auth/sessions/${sessionId}`, { method: 'DELETE' });
  },
  async revokeOtherSessions() {
    return this.request('/api/auth/sessions/revoke-others', { method: 'POST' });
  },
  async completeOnboarding(payload) {
    return this.request('/api/auth/onboarding', { method: 'POST', body: JSON.stringify(payload) });
  },

  // Dashboard & Analytics
  async getOverview() { return this.request('/api/dashboard/overview'); },
  async getAnalytics(timeframe = 'monthly') { return this.request(`/api/analytics?timeframe=${timeframe}`); },
  async getHealth() { return this.request('/api/health'); },

  // Transactions & Quick Add
  async getTransactions(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/api/transactions?${qs}`);
  },
  async createTransaction(payload) {
    return this.request('/api/transactions', { method: 'POST', body: JSON.stringify(payload) });
  },
  async updateTransaction(id, payload) {
    return this.request(`/api/transactions/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  },
  async deleteTransaction(id) {
    return this.request(`/api/transactions/${id}`, { method: 'DELETE' });
  },
  async parseNLP(text) {
    return this.request('/api/transactions/quick-add/nlp', { method: 'POST', body: JSON.stringify({ text }) });
  },
  async scanReceipt(formData) {
    return this.request('/api/ai/receipt-scan', { method: 'POST', body: formData });
  },

  // Categories & Budgets
  async getCategories() { return this.request('/api/categories'); },
  async createCategory(payload) {
    return this.request('/api/categories', { method: 'POST', body: JSON.stringify(payload) });
  },
  async deleteCategory(id, reassign_to = null) {
    const qs = reassign_to ? `?reassign_to=${reassign_to}` : '';
    return this.request(`/api/categories/${id}${qs}`, { method: 'DELETE' });
  },
  async getBudgets() { return this.request('/api/budgets'); },
  async setBudget(payload) { return this.request('/api/budgets', { method: 'POST', body: JSON.stringify(payload) }); },

  // Goals
  async getGoals() { return this.request('/api/goals'); },
  async createGoal(payload) { return this.request('/api/goals', { method: 'POST', body: JSON.stringify(payload) }); },
  async updateGoal(id, payload) { return this.request(`/api/goals/${id}`, { method: 'PUT', body: JSON.stringify(payload) }); },
  async depositGoal(id, amount) { return this.request(`/api/goals/${id}/deposit`, { method: 'POST', body: JSON.stringify({ amount }) }); },
  async deleteGoal(id) { return this.request(`/api/goals/${id}`, { method: 'DELETE' }); },

  // Recurring & Bills
  async getRecurring() { return this.request('/api/recurring'); },
  async detectRecurring() { return this.request('/api/recurring/detect', { method: 'POST' }); },
  async createRecurring(payload) { return this.request('/api/recurring', { method: 'POST', body: JSON.stringify(payload) }); },
  async getBills() { return this.request('/api/bills'); },
  async createBill(payload) { return this.request('/api/bills', { method: 'POST', body: JSON.stringify(payload) }); },
  async toggleBillPaid(id) { return this.request(`/api/bills/${id}/toggle-paid`, { method: 'POST' }); },
  async deleteBill(id) { return this.request(`/api/bills/${id}`, { method: 'DELETE' }); },

  // Financial Twin & Purchase Analyzer
  async getScenarios() { return this.request('/api/scenarios'); },
  async createScenario(payload) { return this.request('/api/scenarios', { method: 'POST', body: JSON.stringify(payload) }); },
  async deleteScenario(id) { return this.request(`/api/scenarios/${id}`, { method: 'DELETE' }); },
  async simulateChanges(changes, months = 12) {
    return this.request('/api/scenarios/simulate', { method: 'POST', body: JSON.stringify({ changes, months }) });
  },
  async analyzePurchase(item_name, price, planned_date) {
    return this.request('/api/scenarios/purchase-impact', { method: 'POST', body: JSON.stringify({ item_name, price, planned_date }) });
  },

  // Net Worth
  async getNetWorth() { return this.request('/api/net-worth'); },
  async addAsset(payload) { return this.request('/api/net-worth/assets', { method: 'POST', body: JSON.stringify(payload) }); },
  async deleteAsset(id) { return this.request(`/api/net-worth/assets/${id}`, { method: 'DELETE' }); },
  async addLiability(payload) { return this.request('/api/net-worth/liabilities', { method: 'POST', body: JSON.stringify(payload) }); },
  async deleteLiability(id) { return this.request(`/api/net-worth/liabilities/${id}`, { method: 'DELETE' }); },

  // AI Assistant
  async askAI(query) { return this.request('/api/ai/ask', { method: 'POST', body: JSON.stringify({ query }) }); },
  async getAIChats() { return this.request('/api/ai/conversations'); },
  async clearAIChats() { return this.request('/api/ai/conversations', { method: 'DELETE' }); },

  // Reports & Search & Settings
  async getReportData(type, year, month) {
    return this.request(`/api/reports/data?type=${type}&year=${year || ''}&month=${month || ''}`);
  },
  async search(query) { return this.request(`/api/search?q=${encodeURIComponent(query)}`); },
  async getSettings() { return this.request('/api/settings'); },
  async updateSettings(payload) { return this.request('/api/settings', { method: 'PUT', body: JSON.stringify(payload) }); },
  async togglePrivacy() { return this.request('/api/settings/privacy-mode/toggle', { method: 'POST' }); },

  // Advanced Features: Expense DNA & Money Leak Map
  async getExpenseDNA() { return this.request('/api/expense-dna'); },

  // Advanced Features: Time Machine & What Changed
  async getTimeMachineSnapshot(date) { return this.request(`/api/time-machine/snapshot?date=${encodeURIComponent(date || '')}`); },
  async getWhatChanged(periodA, periodB) { return this.request(`/api/time-machine/what-changed?period_a=${encodeURIComponent(periodA)}&period_b=${encodeURIComponent(periodB)}`); },

  // Advanced Features: Purchases & Warranties & Lifecycle
  async getPurchases() { return this.request('/api/purchases'); },
  async createPurchase(payload) { return this.request('/api/purchases', { method: 'POST', body: JSON.stringify(payload) }); },
  async updatePurchase(id, payload) { return this.request(`/api/purchases/${id}`, { method: 'PUT', body: JSON.stringify(payload) }); },
  async deletePurchase(id) { return this.request(`/api/purchases/${id}`, { method: 'DELETE' }); },
  async getPurchaseDetails(id) { return this.request(`/api/purchases/${id}`); },
  async addPurchaseEvent(id, payload) { return this.request(`/api/purchases/${id}/events`, { method: 'POST', body: JSON.stringify(payload) }); },
  async deletePurchaseEvent(eventId) { return this.request(`/api/purchases/events/${eventId}`, { method: 'DELETE' }); },

  // Advanced Features: Financial Document Vault
  async getDocuments(category, q) {
    const qs = new URLSearchParams();
    if (category && category !== 'all') qs.set('category', category);
    if (q) qs.set('q', q);
    return this.request(`/api/documents?${qs.toString()}`);
  },
  async uploadDocument(formData) {
    return this.request('/api/documents/upload', { method: 'POST', body: formData });
  },
  async deleteDocument(id) { return this.request(`/api/documents/${id}`, { method: 'DELETE' }); },

  // Advanced Features: Shared Expenses Workspaces
  async getWorkspaces() { return this.request('/api/shared-expenses/workspaces'); },
  async createWorkspace(payload) { return this.request('/api/shared-expenses/workspaces', { method: 'POST', body: JSON.stringify(payload) }); },
  async getWorkspaceDetails(id) { return this.request(`/api/shared-expenses/workspaces/${id}`); },
  async inviteWorkspaceMember(id, payload) { return this.request(`/api/shared-expenses/workspaces/${id}/invite`, { method: 'POST', body: JSON.stringify(payload) }); },
  async addSharedExpense(id, payload) { return this.request(`/api/shared-expenses/workspaces/${id}/expenses`, { method: 'POST', body: JSON.stringify(payload) }); },
  async recordSettlement(id, payload) { return this.request(`/api/shared-expenses/workspaces/${id}/settle`, { method: 'POST', body: JSON.stringify(payload) }); },

  // Advanced Features: AI Financial Memory
  async getMemories(q = '') { return this.request(`/api/memories?q=${encodeURIComponent(q)}`); },
  async createMemory(payload) { return this.request('/api/memories', { method: 'POST', body: JSON.stringify(payload) }); },
  async updateMemory(id, payload) { return this.request(`/api/memories/${id}`, { method: 'PUT', body: JSON.stringify(payload) }); },
  async deleteMemory(id) { return this.request(`/api/memories/${id}`, { method: 'DELETE' }); },

  // Advanced Features: Spending Location Map
  async getLocationTransactions() { return this.request('/api/locations/transactions'); },
  async toggleLocationTracking(enabled) { return this.request('/api/locations/toggle', { method: 'POST', body: JSON.stringify({ enabled }) }); },
  async clearLocationData() { return this.request('/api/locations/clear', { method: 'POST' }); },

  // Advanced Features: Monthly Financial Story
  async getMonthlyStory(month = '') { return this.request(`/api/monthly-story?month=${encodeURIComponent(month)}`); },

  // Advanced Features: Simulators Suite
  async getForecast(days = 30) { return this.request(`/api/scenarios/forecast?days=${days}`); },
  async simulateEmergencyFund(target_amount, current_amount, tiers) {
    return this.request('/api/scenarios/emergency-fund', { method: 'POST', body: JSON.stringify({ target_amount, current_amount, tiers }) });
  },
  async simulateIncomeChange(income_delta, duration_months = 12, change_label = 'Income Adjustment') {
    return this.request('/api/scenarios/income-change', { method: 'POST', body: JSON.stringify({ income_delta, duration_months, change_label }) });
  },
  async getLifeEvents() { return this.request('/api/scenarios/life-events'); },
  async createLifeEvent(payload) { return this.request('/api/scenarios/life-events', { method: 'POST', body: JSON.stringify(payload) }); },
  async deleteLifeEvent(id) { return this.request(`/api/scenarios/life-events/${id}`, { method: 'DELETE' }); }
};

/**
 * LEDGER GLOBAL AUTHENTICATION STATE MACHINE
 * Explicit 3-State Architecture: 'loading' | 'authenticated' | 'unauthenticated'
 */
window.LedgerAuth = {
  STATE_LOADING: 'loading',
  STATE_AUTHENTICATED: 'authenticated',
  STATE_UNAUTHENTICATED: 'unauthenticated',

  state: 'loading',
  currentUser: null,
  token: null,
  listeners: [],

  subscribe(fn) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  },

  setState(newState, user = null) {
    this.state = newState;
    this.currentUser = user;
    this.token = window.LedgerAPI.getToken();
    this.listeners.forEach(fn => {
      try { fn(this.state, this.currentUser); } catch (e) { console.error('Auth listener error:', e); }
    });
  },

  isAuthenticated() {
    return this.state === this.STATE_AUTHENTICATED;
  },

  isLoading() {
    return this.state === this.STATE_LOADING;
  },

  async checkSession() {
    this.setState(this.STATE_LOADING, null);
    const token = window.LedgerAPI.getToken();

    try {
      // 4-second timeout to prevent UI locking on cold starts
      const res = await window.LedgerAPI.request('/api/auth/me', { timeout: 4000 });
      if (res && res.authenticated && res.user) {
        if (res.token) {
          window.LedgerAPI.setToken(res.token);
        }
        this.setState(this.STATE_AUTHENTICATED, res.user);
        return { authenticated: true, user: res.user, state: this.STATE_AUTHENTICATED };
      } else {
        window.LedgerAPI.setToken(null);
        this.setState(this.STATE_UNAUTHENTICATED, null);
        return { authenticated: false, state: this.STATE_UNAUTHENTICATED };
      }
    } catch (err) {
      console.warn('Session verification check failed:', err.message);
      window.LedgerAPI.setToken(null);
      this.setState(this.STATE_UNAUTHENTICATED, null);
      return { authenticated: false, state: this.STATE_UNAUTHENTICATED, error: err };
    }
  },


  async login(email, password) {
    this.setState(this.STATE_LOADING, null);
    const res = await window.LedgerAPI.login(email, password);
    if (!res || !res.token) {
      this.setState(this.STATE_UNAUTHENTICATED, null);
      throw new Error((res && res.error) || 'Authentication failed');
    }
    window.LedgerAPI.setToken(res.token);
    const user = res.user || (await window.LedgerAPI.getMe()).user;
    this.setState(this.STATE_AUTHENTICATED, user);
    return { user, token: res.token };
  },

  async register(full_name, email, password, currency) {
    console.log('[LedgerAuth] Registering user account for:', email);
    this.setState(this.STATE_LOADING, null);
    try {
      const res = await window.LedgerAPI.register(full_name, email, password, currency);
      if (!res || !res.token) {
        this.setState(this.STATE_UNAUTHENTICATED, null);
        throw new Error((res && res.error) || 'Registration failed');
      }
      console.log('[LedgerAuth] Registration succeeded. Storing token and updating auth state to authenticated.');
      window.LedgerAPI.setToken(res.token);
      const user = res.user || (await window.LedgerAPI.getMe()).user;
      this.setState(this.STATE_AUTHENTICATED, user);
      return { user, token: res.token };
    } catch (err) {
      console.error('[LedgerAuth] Registration error:', err.message);
      this.setState(this.STATE_UNAUTHENTICATED, null);
      throw err;
    }
  },

  async logout() {
    try {
      await window.LedgerAPI.logout();
    } finally {
      this.setState(this.STATE_UNAUTHENTICATED, null);
    }
  }
};

