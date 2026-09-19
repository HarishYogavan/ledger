/**
 * LEDGER FINANCIAL CALENDAR VIEW
 * Month, Week, and Day views showing income, bills, recurring subscriptions,
 * savings goal milestones, planned purchases, and warranty expirations.
 */

window.LedgerViews = window.LedgerViews || {};

window.LedgerViews.calendar = {
  currentDate: new Date(),
  activeView: 'month', // 'month' | 'week' | 'day'
  filterType: 'all',   // 'all' | 'income' | 'bills' | 'expenses' | 'warranties'
  selectedDateStr: null,
  cachedData: null,

  async render(container) {
    if (!container) container = document.getElementById('view-container');
    if (!container) return;

    container.innerHTML = `
      <div style="display:flex; justify-content:center; padding:60px;">
        <div style="color:var(--brand-teal); font-weight:600;">Loading Financial Calendar...</div>
      </div>
    `;

    try {
      const [txRes, billRes, recRes, goalRes, purchRes] = await Promise.all([
        window.LedgerAPI.getTransactions({ limit: 400 }),
        window.LedgerAPI.getBills(),
        window.LedgerAPI.getRecurring(),
        window.LedgerAPI.getGoals(),
        window.LedgerAPI.request('/api/purchases').catch(() => ({ purchases: [] }))
      ]);

      this.cachedData = {
        transactions: txRes.transactions || [],
        bills: billRes.bills || [],
        recurring: recRes.recurring_payments || [],
        goals: goalRes.goals || [],
        purchases: purchRes.purchases || []
      };

      this.renderCurrentView(container);
    } catch (err) {
      container.innerHTML = `<div class="card" style="border-color:var(--brand-danger);">${err.message}</div>`;
    }
  },

  renderCurrentView(container) {
    if (!container) container = document.getElementById('view-container');
    if (!container) return;

    const user = window.LedgerApp.currentUser || {};
    const curr = user.currency || '₹';
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const currentMonthName = monthNames[month];

    const todayStr = new Date().toISOString().split('T')[0];
    if (!this.selectedDateStr) {
      this.selectedDateStr = todayStr;
    }

    // Build event map
    const eventsMap = {};
    const addEvent = (dateStr, ev) => {
      if (!dateStr) return;
      if (!eventsMap[dateStr]) eventsMap[dateStr] = [];
      eventsMap[dateStr].push(ev);
    };

    // 1. Transactions
    this.cachedData.transactions.forEach(t => {
      addEvent(t.date, {
        id: t.id,
        category: t.type === 'income' ? 'income' : 'expenses',
        type: t.type,
        title: t.merchant || 'Transaction',
        amount: t.amount,
        pillClass: t.type === 'income' ? 'event-income' : 'event-expense',
        details: `${t.category_name || 'General'} • ${curr}${t.amount}`
      });
    });

    // 2. Bills
    this.cachedData.bills.forEach(b => {
      const isOverdue = !b.is_paid && b.due_date < todayStr;
      addEvent(b.due_date, {
        id: b.id,
        category: 'bills',
        type: 'bill',
        isBill: true,
        isPaid: b.is_paid,
        isOverdue: isOverdue,
        title: `Bill: ${b.title}`,
        amount: b.amount,
        pillClass: b.is_paid ? 'event-income' : (isOverdue ? 'event-expense' : 'event-bill'),
        details: `${b.category || 'Bill'} • ${curr}${b.amount} ${b.is_paid ? '(Paid)' : (isOverdue ? '(OVERDUE)' : '')}`
      });
    });

    // 3. Recurring
    this.cachedData.recurring.forEach(r => {
      if (r.next_due_date) {
        addEvent(r.next_due_date, {
          id: r.id,
          category: 'bills',
          type: 'recurring',
          title: `Sub: ${r.name}`,
          amount: r.amount,
          pillClass: 'event-bill',
          details: `Subscription • ${curr}${r.amount}`
        });
      }
    });

    // 4. Goals target dates
    this.cachedData.goals.forEach(g => {
      if (g.target_date) {
        addEvent(g.target_date, {
          id: g.id,
          category: 'warranties',
          type: 'goal',
          title: `🎯 Goal: ${g.name}`,
          amount: g.target_amount,
          pillClass: 'event-income',
          details: `Target: ${curr}${g.target_amount} (Current: ${curr}${g.current_amount})`
        });
      }
    });

    // 5. Purchases & Warranties
    this.cachedData.purchases.forEach(p => {
      if (p.lifecycle_status === 'planned' && p.purchase_date) {
        addEvent(p.purchase_date, {
          id: p.id,
          category: 'warranties',
          type: 'purchase_plan',
          title: `🛒 Plan: ${p.product_name}`,
          amount: p.price,
          pillClass: 'event-bill',
          details: `Planned Purchase: ${curr}${p.price}`
        });
      }
      if (p.warranty_expiry_date) {
        const isExpiring = p.warranty_expiry_date <= todayStr;
        addEvent(p.warranty_expiry_date, {
          id: p.id,
          category: 'warranties',
          type: 'warranty',
          title: `🛡️ Exp: ${p.product_name}`,
          amount: 0,
          pillClass: isExpiring ? 'event-expense' : 'event-bill',
          details: `Warranty Expiration for ${p.product_name}`
        });
      }
    });

    // Filtering helper
    const filterEvent = (ev) => {
      if (this.filterType === 'all') return true;
      if (this.filterType === 'income') return ev.category === 'income';
      if (this.filterType === 'bills') return ev.category === 'bills';
      if (this.filterType === 'expenses') return ev.category === 'expenses';
      if (this.filterType === 'warranties') return ev.category === 'warranties';
      return true;
    };

    // Header HTML
    let viewContentHtml = '';

    if (this.activeView === 'month') {
      // Month calculation
      const firstDayOfMonth = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      let dayCellsHtml = '';
      for (let i = 0; i < firstDayOfMonth; i++) {
        dayCellsHtml += `<div class="calendar-cell" style="opacity:0.25; background:none;"></div>`;
      }

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = dateStr === todayStr;
        const isSelected = dateStr === this.selectedDateStr;
        const rawEvents = eventsMap[dateStr] || [];
        const dayEvents = rawEvents.filter(filterEvent);

        dayCellsHtml += `
          <div class="calendar-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" 
               style="${isSelected ? 'border-color:var(--brand-teal); box-shadow:0 0 10px rgba(6,214,160,0.25);' : ''}"
               onclick="window.LedgerViews.calendar.selectDate('${dateStr}')">
            <div class="cal-date-number" style="display:flex; justify-content:space-between; align-items:center;">
              <span>${day}</span>
              ${dayEvents.some(e => e.isOverdue) ? '<span style="font-size:10px; color:var(--brand-danger);" title="Overdue bill">⚠️</span>' : ''}
            </div>
            ${dayEvents.slice(0, 3).map(ev => `
              <div class="cal-event-pill ${ev.pillClass}" title="${ev.title}: ${ev.amount ? curr + ev.amount : ''}">
                ${ev.title}
              </div>
            `).join('')}
            ${dayEvents.length > 3 ? `<div style="font-size:9px; color:var(--brand-teal); font-weight:600;">+${dayEvents.length - 3} more</div>` : ''}
          </div>
        `;
      }

      viewContentHtml = `
        <div class="card" style="padding:20px;">
          <div class="calendar-grid" style="margin-bottom:8px;">
            <div class="calendar-day-header">Sun</div>
            <div class="calendar-day-header">Mon</div>
            <div class="calendar-day-header">Tue</div>
            <div class="calendar-day-header">Wed</div>
            <div class="calendar-day-header">Thu</div>
            <div class="calendar-day-header">Fri</div>
            <div class="calendar-day-header">Sat</div>
          </div>
          <div class="calendar-grid">
            ${dayCellsHtml}
          </div>
        </div>
      `;
    } else if (this.activeView === 'week') {
      // 7-day view starting from current date's Sunday
      const currD = new Date(this.currentDate);
      const dayOfWeek = currD.getDay();
      const sunday = new Date(currD);
      sunday.setDate(currD.getDate() - dayOfWeek);

      const days = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(sunday);
        d.setDate(sunday.getDate() + i);
        days.push(d);
      }

      let weekColsHtml = '';
      days.forEach(d => {
        const dStr = d.toISOString().split('T')[0];
        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
        const isToday = dStr === todayStr;
        const isSelected = dStr === this.selectedDateStr;
        const rawEvents = eventsMap[dStr] || [];
        const dayEvents = rawEvents.filter(filterEvent);

        weekColsHtml += `
          <div class="card" style="min-height:260px; padding:12px; cursor:pointer; ${isSelected ? 'border-color:var(--brand-teal);' : ''} ${isToday ? 'background:rgba(6,214,160,0.04);' : ''}" onclick="window.LedgerViews.calendar.selectDate('${dStr}')">
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
              <strong style="color:${isToday ? 'var(--brand-teal)' : 'var(--text-primary)'};">${dayName}</strong>
              <span style="font-size:13px; color:var(--text-secondary);">${d.getDate()}</span>
            </div>
            <div style="display:flex; flex-direction:column; gap:6px;">
              ${dayEvents.length === 0 ? '<div style="font-size:11px; color:var(--text-muted); font-style:italic;">No events</div>' : ''}
              ${dayEvents.map(ev => `
                <div class="cal-event-pill ${ev.pillClass}" style="padding:4px 6px; font-size:11px;" title="${ev.title}">
                  <div><strong>${ev.title}</strong></div>
                  ${ev.amount ? `<div style="font-size:10px;">${curr}${ev.amount}</div>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        `;
      });

      viewContentHtml = `
        <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:10px;">
          ${weekColsHtml}
        </div>
      `;
    } else if (this.activeView === 'day') {
      const dStr = this.selectedDateStr || todayStr;
      const rawEvents = eventsMap[dStr] || [];
      const dayEvents = rawEvents.filter(filterEvent);

      viewContentHtml = `
        <div class="card" style="padding:24px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
            <div>
              <h3 style="font-size:18px; margin-bottom:4px;">Events for ${dStr}</h3>
              <p style="font-size:13px; color:var(--text-secondary);">${dayEvents.length} scheduled item(s) found</p>
            </div>
            <button class="btn btn-primary" onclick="window.LedgerViews.quickAdd.open('${dStr}')">+ Log on this Date</button>
          </div>

          <div style="display:flex; flex-direction:column; gap:10px;">
            ${dayEvents.length === 0 ? '<div style="padding:40px; text-align:center; color:var(--text-muted);">No transactions, bills, or warranty milestones on this date.</div>' : ''}
            ${dayEvents.map(ev => `
              <div style="display:flex; justify-content:space-between; align-items:center; padding:14px; background:var(--brand-surface); border-radius:var(--radius-md); border-left:4px solid ${ev.pillClass==='event-income'?'var(--brand-teal)':(ev.isOverdue?'var(--brand-danger)':'var(--brand-blue)')};">
                <div>
                  <div style="font-weight:600; font-size:14px; margin-bottom:2px;">${ev.title}</div>
                  <div style="font-size:12px; color:var(--text-secondary);">${ev.details}</div>
                </div>
                <div style="display:flex; align-items:center; gap:12px;">
                  ${ev.amount ? `<span class="privacy-mask" style="font-weight:700; font-size:15px; color:${ev.type==='income'?'var(--brand-teal)':'var(--text-primary)'};">${curr}${ev.amount}</span>` : ''}
                  ${ev.isBill ? `
                    <button class="btn ${ev.isPaid ? 'btn-secondary' : 'btn-primary'}" style="font-size:11px; padding:6px 10px;" onclick="window.LedgerViews.calendar.toggleBill('${ev.id}')">
                      ${ev.isPaid ? 'Mark Unpaid' : 'Mark as Paid'}
                    </button>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Daily inspector card (shown in month and week view below calendar)
    let selectedDayInspectorHtml = '';
    if (this.activeView !== 'day') {
      const selStr = this.selectedDateStr || todayStr;
      const selEvents = (eventsMap[selStr] || []).filter(filterEvent);
      let dayNet = 0;
      selEvents.forEach(e => {
        if (e.type === 'income') dayNet += (e.amount || 0);
        else if (e.amount) dayNet -= e.amount;
      });

      selectedDayInspectorHtml = `
        <div class="card" style="margin-top:20px; padding:20px; border-color:var(--brand-border-subtle);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:12px;">
            <div>
              <h4 style="font-size:15px; margin-bottom:2px;">Detailed Agenda: ${selStr}</h4>
              <span style="font-size:12px; color:${dayNet >= 0 ? 'var(--brand-teal)' : 'var(--brand-danger)'};">
                Net Cashflow: ${dayNet >= 0 ? '+' : ''}${curr}${dayNet.toFixed(2)}
              </span>
            </div>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-secondary" style="font-size:12px; padding:6px 12px;" onclick="window.LedgerViews.calendar.setView('day')">
                Open Day View
              </button>
              <button class="btn btn-primary" style="font-size:12px; padding:6px 12px;" onclick="window.LedgerViews.quickAdd.open('${selStr}')">
                + Add Transaction
              </button>
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:8px;">
            ${selEvents.length === 0 ? '<div style="color:var(--text-muted); font-size:13px; padding:12px 0;">No events scheduled for this date.</div>' : ''}
            ${selEvents.map(ev => `
              <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:var(--brand-surface); border-radius:var(--radius-sm);">
                <div>
                  <strong style="font-size:13px;">${ev.title}</strong>
                  <div style="font-size:11px; color:var(--text-secondary);">${ev.details}</div>
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                  ${ev.amount ? `<span class="privacy-mask" style="font-weight:600; font-size:13px; color:${ev.type==='income'?'var(--brand-teal)':'var(--text-primary)'};">${curr}${ev.amount}</span>` : ''}
                  ${ev.isBill ? `
                    <button class="btn ${ev.isPaid ? 'btn-secondary' : 'btn-primary'}" style="font-size:11px; padding:4px 8px;" onclick="window.LedgerViews.calendar.toggleBill('${ev.id}')">
                      ${ev.isPaid ? 'Paid' : 'Mark Paid'}
                    </button>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <!-- Calendar Header -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:16px;">
        <div>
          <h1 style="font-size:24px; margin-bottom:4px;">Financial Calendar</h1>
          <p style="font-size:13px; color:var(--text-secondary);">Track income cycles, bill due dates, warranties, and cashflow schedules</p>
        </div>

        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <!-- View switcher -->
          <div style="display:flex; background:var(--brand-surface); padding:3px; border-radius:var(--radius-md); border:1px solid var(--brand-border-subtle);">
            <button class="tab-pill ${this.activeView === 'month' ? 'active' : ''}" style="padding:6px 12px; font-size:12px;" onclick="window.LedgerViews.calendar.setView('month')">Month</button>
            <button class="tab-pill ${this.activeView === 'week' ? 'active' : ''}" style="padding:6px 12px; font-size:12px;" onclick="window.LedgerViews.calendar.setView('week')">Week</button>
            <button class="tab-pill ${this.activeView === 'day' ? 'active' : ''}" style="padding:6px 12px; font-size:12px;" onclick="window.LedgerViews.calendar.setView('day')">Day</button>
          </div>

          <!-- Navigation buttons -->
          <div style="display:flex; align-items:center; gap:6px;">
            <button class="btn btn-secondary" style="padding:6px 10px;" onclick="window.LedgerViews.calendar.changePeriod(-1)">◀</button>
            <strong style="font-size:14px; min-width:130px; text-align:center;">${currentMonthName} ${year}</strong>
            <button class="btn btn-secondary" style="padding:6px 10px;" onclick="window.LedgerViews.calendar.changePeriod(1)">▶</button>
            <button class="btn btn-secondary" style="padding:6px 12px; font-size:12px;" onclick="window.LedgerViews.calendar.goToday()">Today</button>
          </div>
        </div>
      </div>

      <!-- Filter chips -->
      <div style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap;">
        <button class="btn ${this.filterType === 'all' ? 'btn-primary' : 'btn-secondary'}" style="font-size:12px; padding:4px 10px;" onclick="window.LedgerViews.calendar.setFilter('all')">All Events</button>
        <button class="btn ${this.filterType === 'bills' ? 'btn-primary' : 'btn-secondary'}" style="font-size:12px; padding:4px 10px;" onclick="window.LedgerViews.calendar.setFilter('bills')">Bills & Subs</button>
        <button class="btn ${this.filterType === 'income' ? 'btn-primary' : 'btn-secondary'}" style="font-size:12px; padding:4px 10px;" onclick="window.LedgerViews.calendar.setFilter('income')">Income</button>
        <button class="btn ${this.filterType === 'expenses' ? 'btn-primary' : 'btn-secondary'}" style="font-size:12px; padding:4px 10px;" onclick="window.LedgerViews.calendar.setFilter('expenses')">Expenses</button>
        <button class="btn ${this.filterType === 'warranties' ? 'btn-primary' : 'btn-secondary'}" style="font-size:12px; padding:4px 10px;" onclick="window.LedgerViews.calendar.setFilter('warranties')">Warranties & Goals</button>
      </div>

      <!-- Main View Content -->
      ${viewContentHtml}

      <!-- Day Inspector -->
      ${selectedDayInspectorHtml}
    `;
  },

  setView(viewName) {
    this.activeView = viewName;
    this.renderCurrentView();
  },

  setFilter(type) {
    this.filterType = type;
    this.renderCurrentView();
  },

  selectDate(dateStr) {
    this.selectedDateStr = dateStr;
    this.renderCurrentView();
  },

  changePeriod(delta) {
    if (this.activeView === 'month') {
      this.currentDate.setMonth(this.currentDate.getMonth() + delta);
    } else if (this.activeView === 'week') {
      this.currentDate.setDate(this.currentDate.getDate() + (delta * 7));
    } else if (this.activeView === 'day') {
      this.currentDate.setDate(this.currentDate.getDate() + delta);
      this.selectedDateStr = this.currentDate.toISOString().split('T')[0];
    }
    this.renderCurrentView();
  },

  goToday() {
    this.currentDate = new Date();
    this.selectedDateStr = new Date().toISOString().split('T')[0];
    this.renderCurrentView();
  },

  async toggleBill(billId) {
    try {
      await window.LedgerAPI.toggleBillPaid(billId);
      // Reload calendar
      const container = document.getElementById('view-container');
      this.render(container);
    } catch (err) {
      alert(err.message);
    }
  }
};
