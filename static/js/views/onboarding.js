/**
 * LEDGER FIRST-TIME ONBOARDING FLOW
 */

window.LedgerViews = window.LedgerViews || {};

window.LedgerViews.onboarding = {
  checkAndPrompt() {
    const user = window.LedgerApp.currentUser;
    if (user && !user.onboarding_completed) {
      this.open();
    }
  },

  open() {
    let modal = document.getElementById('onboarding-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'onboarding-modal';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }
    this.renderStep1(modal);
  },

  close() {
    const modal = document.getElementById('onboarding-modal');
    if (modal) modal.remove();
  },

  renderStep1(modal) {
    modal.innerHTML = `
      <div class="modal-content" style="max-width:520px; text-align:center;">
        <div class="modal-body" style="padding:36px 28px;">
          <img src="/static/icons/logo-192.png" alt="Ledger" style="width:68px; height:68px; margin-bottom:16px;">
          <h2 style="font-size:22px; margin-bottom:8px;">Welcome to Ledger</h2>
          <p style="font-size:13px; color:var(--text-secondary); margin-bottom:24px; line-height:1.5;">
            Let's configure your personal financial operating system. All answers are optional and you can change them anytime in Settings.
          </p>

          <form onsubmit="window.LedgerViews.onboarding.submitOnboarding(event)" style="text-align:left;">
            <div class="form-group">
              <label class="form-label">Primary Currency</label>
              <select id="onb-currency" class="form-control">
                <option value="₹">₹ - Indian Rupee (INR)</option>
                <option value="$">$ - US Dollar (USD)</option>
                <option value="€">€ - Euro (EUR)</option>
                <option value="£">£ - British Pound (GBP)</option>
                <option value="¥">¥ - Japanese Yen (JPY)</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Estimated Monthly Income (Optional)</label>
              <input type="number" id="onb-income" class="form-control" placeholder="e.g. 50000">
            </div>

            <div class="form-group">
              <label class="form-label">Monthly Savings Target (Optional)</label>
              <input type="number" id="onb-target" class="form-control" placeholder="e.g. 15000">
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:24px;">
              <button type="button" class="btn btn-secondary" onclick="window.LedgerViews.onboarding.skip()">
                Skip for Now
              </button>
              <button type="submit" class="btn btn-primary">
                Get Started with Ledger
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  async submitOnboarding(e) {
    e.preventDefault();
    const currency = document.getElementById('onb-currency').value;
    const monthly_income = parseFloat(document.getElementById('onb-income').value) || 0;
    const savings_target = parseFloat(document.getElementById('onb-target').value) || 0;

    try {
      await window.LedgerAPI.completeOnboarding({ currency, monthly_income, savings_target });
      this.close();
      window.LedgerApp.currentUser.onboarding_completed = true;
      window.LedgerApp.currentUser.currency = currency;
      window.LedgerApp.refreshCurrentView();
    } catch (err) {
      alert(err.message);
    }
  },

  async skip() {
    try {
      await window.LedgerAPI.completeOnboarding({});
      this.close();
      window.LedgerApp.currentUser.onboarding_completed = true;
      window.LedgerApp.refreshCurrentView();
    } catch (err) {
      this.close();
    }
  }
};
