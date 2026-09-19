/**
 * LEDGER INTERACTIVE CHARTS
 * Pure HTML5 Canvas & SVG high-performance fintech charts with responsive scaling,
 * touch ergonomics, ResizeObserver adaptation, and zero third-party dependencies.
 */

window.LedgerCharts = {
  /**
   * Draws a multi-line or area cashflow trend chart with touch support and auto-resize
   */
  renderCashflowChart(containerId, data, currency = '₹') {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!data || data.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 30px 10px;">
          <p class="empty-state-desc">No transaction records available to render cashflow trends.</p>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div style="position:relative; width:100%; height:100%; min-height:220px;">
        <canvas id="${containerId}-canvas" style="width:100%; height:100%; display:block;"></canvas>
        <div id="${containerId}-tooltip" class="chart-tooltip"></div>
      </div>
    `;

    const canvas = document.getElementById(`${containerId}-canvas`);
    const tooltip = document.getElementById(`${containerId}-tooltip`);
    if (!canvas || !tooltip) return;
    const ctx = canvas.getContext('2d');

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const width = (rect.width > 20 ? rect.width : (container.clientWidth || 320));
    const height = (rect.height > 20 ? rect.height : (container.clientHeight || 220));

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Padding responsive for mobile vs desktop
    const isMobile = width < 480;
    const padding = {
      top: 20,
      right: isMobile ? 12 : 24,
      bottom: 36,
      left: isMobile ? 38 : 50
    };

    const maxVal = Math.max(...data.map(d => Math.max(d.income || 0, d.expense || 0, 1000)));
    const plotW = Math.max(width - padding.left - padding.right, 20);
    const plotH = Math.max(height - padding.top - padding.bottom, 20);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw Grid Lines
    ctx.strokeStyle = 'rgba(45, 68, 108, 0.3)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748B';
    ctx.font = `${isMobile ? '9px' : '10px'} Inter, sans-serif`;

    const ySteps = 4;
    for (let i = 0; i <= ySteps; i++) {
      const y = padding.top + (plotH / ySteps) * i;
      const val = Math.round(maxVal - (maxVal / ySteps) * i);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      const labelStr = `${currency}${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`;
      ctx.fillText(labelStr, 4, y + 3);
    }

    // Coordinates calculation
    const pointsIncome = [];
    const pointsExpense = [];
    const stepX = data.length > 1 ? plotW / (data.length - 1) : plotW / 2;

    data.forEach((d, idx) => {
      const x = padding.left + (data.length > 1 ? stepX * idx : plotW / 2);
      const yInc = padding.top + plotH - ((d.income || 0) / maxVal) * plotH;
      const yExp = padding.top + plotH - ((d.expense || 0) / maxVal) * plotH;

      pointsIncome.push({ x, y: yInc, val: d.income, label: d.month || d.label });
      pointsExpense.push({ x, y: yExp, val: d.expense, label: d.month || d.label });

      // X-axis label (stagger if on very small screen)
      if (!isMobile || idx % 2 === 0 || idx === data.length - 1) {
        ctx.fillStyle = '#94A3B8';
        ctx.textAlign = 'center';
        ctx.fillText(d.month || d.label, x, height - 10);
      }
    });

    // Draw Series Line & Gradient Area
    function drawSeries(points, strokeColor, fillColor) {
      if (points.length === 0) return;
      const grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + plotH);
      grad.addColorStop(0, fillColor);
      grad.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.beginPath();
      ctx.moveTo(points[0].x, padding.top + plotH);
      points.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.lineTo(points[points.length - 1].x, padding.top + plotH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Line
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Point dots
      points.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, isMobile ? 3 : 4, 0, Math.PI * 2);
        ctx.fillStyle = strokeColor;
        ctx.fill();
        ctx.strokeStyle = '#070D1E';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }

    // Draw Income (Teal) and Expense (Red)
    drawSeries(pointsIncome, '#06D6A0', 'rgba(6, 214, 160, 0.18)');
    drawSeries(pointsExpense, '#EF476F', 'rgba(239, 71, 111, 0.15)');

    // Hover & Touch Tooltip Interaction
    const showTooltipAt = (clientX) => {
      const cRect = canvas.getBoundingClientRect();
      const mouseX = clientX - cRect.left;

      let closestIdx = 0;
      let closestDist = 9999;
      pointsIncome.forEach((p, idx) => {
        const dist = Math.abs(p.x - mouseX);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = idx;
        }
      });

      if (closestDist < (isMobile ? 50 : 40)) {
        const inc = pointsIncome[closestIdx];
        const exp = pointsExpense[closestIdx];
        tooltip.style.display = 'block';
        tooltip.style.left = `${Math.min(Math.max(inc.x, 80), width - 80)}px`;
        tooltip.style.top = `${Math.max(Math.min(inc.y, exp.y) - 10, 10)}px`;
        tooltip.innerHTML = `
          <strong>${inc.label}</strong><br>
          <span style="color:#06D6A0">● Income: ${currency}${(inc.val || 0).toLocaleString()}</span><br>
          <span style="color:#EF476F">● Expense: ${currency}${(exp.val || 0).toLocaleString()}</span><br>
          <span style="color:#F8FAFC">Net: ${currency}${((inc.val || 0) - (exp.val || 0)).toLocaleString()}</span>
        `;
      } else {
        tooltip.style.display = 'none';
      }
    };

    canvas.onmousemove = (e) => showTooltipAt(e.clientX);
    canvas.ontouchstart = (e) => {
      if (e.touches.length > 0) showTooltipAt(e.touches[0].clientX);
    };
    canvas.ontouchmove = (e) => {
      if (e.touches.length > 0) showTooltipAt(e.touches[0].clientX);
    };
    canvas.onmouseleave = () => { tooltip.style.display = 'none'; };
    canvas.ontouchend = () => {
      setTimeout(() => { tooltip.style.display = 'none'; }, 2500);
    };

    // Auto-re-render on container resize
    if (!container._resizeBound && window.ResizeObserver) {
      container._resizeBound = true;
      let resizeTimer;
      const ro = new ResizeObserver(() => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          if (container.offsetWidth > 20) {
            window.LedgerCharts.renderCashflowChart(containerId, data, currency);
          }
        }, 150);
      });
      ro.observe(container);
    }
  },

  /**
   * Renders a category donut chart with legend and percentages
   */
  renderDonutChart(containerId, categories, currency = '₹') {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!categories || categories.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 24px 10px;">
          <p class="empty-state-desc">No category spending recorded for this period.</p>
        </div>`;
      return;
    }

    const total = categories.reduce((sum, c) => sum + (c.amount || c.total || 0), 0);

    let currentAngle = 0;
    const slices = categories.map(cat => {
      const val = cat.amount || cat.total || 0;
      const angle = total > 0 ? (val / total) * 360 : 0;
      const slice = {
        name: cat.name || cat.category,
        color: cat.color || '#06D6A0',
        val: val,
        percent: total > 0 ? ((val / total) * 100).toFixed(1) : 0,
        startAngle: currentAngle,
        endAngle: currentAngle + angle
      };
      currentAngle += angle;
      return slice;
    });

    const svgSlices = slices.map(s => {
      const r = 40;
      const cx = 50;
      const cy = 50;
      const startRad = (s.startAngle - 90) * Math.PI / 180;
      const endRad = (s.endAngle - 90) * Math.PI / 180;

      const x1 = cx + r * Math.cos(startRad);
      const y1 = cy + r * Math.sin(startRad);
      const x2 = cx + r * Math.cos(endRad);
      const y2 = cy + r * Math.sin(endRad);

      const largeArc = (s.endAngle - s.startAngle) > 180 ? 1 : 0;
      const pathData = (s.endAngle - s.startAngle) >= 359.9
        ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`
        : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;

      return `<path d="${pathData}" fill="${s.color}" opacity="0.9" style="transition: opacity 0.2s;" title="${s.name}: ${currency}${s.val.toLocaleString()} (${s.percent}%)"/>`;
    }).join('');

    const legendItems = slices.slice(0, 5).map(s => `
      <div style="display:flex; align-items:center; justify-content:space-between; font-size:12px; margin-bottom:6px;">
        <span style="display:flex; align-items:center; gap:6px; color:var(--text-secondary);">
          <span style="width:8px; height:8px; border-radius:50%; background:${s.color}; flex-shrink:0;"></span>
          <span style="max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${s.name}</span>
        </span>
        <strong style="color:var(--text-primary); font-size:12px;">${s.percent}%</strong>
      </div>
    `).join('');

    container.innerHTML = `
      <div style="display:flex; align-items:center; gap:16px; justify-content:center; flex-wrap:wrap;">
        <div style="position:relative; width:150px; height:150px; flex-shrink:0;">
          <svg viewBox="0 0 100 100" style="width:100%; height:100%; border-radius:50%;">
            ${svgSlices}
            <circle cx="50" cy="50" r="24" fill="var(--brand-navy)"></circle>
          </svg>
          <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); text-align:center;">
            <span style="font-size:9px; color:var(--text-muted); text-transform:uppercase; display:block;">Total</span>
            <div style="font-size:12px; font-weight:700; color:var(--text-primary);">${currency}${total >= 1000 ? (total/1000).toFixed(1)+'k' : total.toFixed(0)}</div>
          </div>
        </div>
        <div style="flex:1; min-width:140px;">
          ${legendItems}
        </div>
      </div>
    `;
  },

  /**
   * Renders the Financial Twin dual comparison line chart
   */
  renderTwinComparisonChart(containerId, baselineTimeline, simulatedTimeline, currency = '₹') {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div style="position:relative; width:100%; height:100%; min-height:240px;">
        <canvas id="${containerId}-canvas" style="width:100%; height:100%; display:block;"></canvas>
        <div id="${containerId}-tooltip" class="chart-tooltip"></div>
      </div>
    `;

    const canvas = document.getElementById(`${containerId}-canvas`);
    const tooltip = document.getElementById(`${containerId}-tooltip`);
    if (!canvas || !tooltip) return;
    const ctx = canvas.getContext('2d');

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const width = (rect.width > 20 ? rect.width : (container.clientWidth || 320));
    const height = (rect.height > 20 ? rect.height : (container.clientHeight || 240));

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const isMobile = width < 480;
    const padding = {
      top: 20,
      right: isMobile ? 14 : 26,
      bottom: 36,
      left: isMobile ? 40 : 60
    };

    const allBalances = [
      ...baselineTimeline.map(b => b.cumulative_balance),
      ...simulatedTimeline.map(s => s.cumulative_balance)
    ];

    const maxVal = Math.max(...allBalances, 1000);
    const minVal = Math.min(0, ...allBalances);
    const range = (maxVal - minVal) || 1;

    const plotW = Math.max(width - padding.left - padding.right, 20);
    const plotH = Math.max(height - padding.top - padding.bottom, 20);

    ctx.clearRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = 'rgba(45, 68, 108, 0.3)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748B';
    ctx.font = `${isMobile ? '9px' : '10px'} Inter, sans-serif`;

    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (plotH / 4) * i;
      const val = Math.round(maxVal - (range / 4) * i);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      ctx.fillText(`${currency}${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`, 4, y + 3);
    }

    const stepX = plotW / (baselineTimeline.length - 1 || 1);
    const basePts = [];
    const simPts = [];

    baselineTimeline.forEach((b, idx) => {
      const x = padding.left + stepX * idx;
      const yB = padding.top + plotH - ((b.cumulative_balance - minVal) / range) * plotH;
      basePts.push({ x, y: yB, val: b.cumulative_balance, label: b.label });

      const s = simulatedTimeline[idx] || b;
      const yS = padding.top + plotH - ((s.cumulative_balance - minVal) / range) * plotH;
      simPts.push({ x, y: yS, val: s.cumulative_balance, label: s.label });

      if (!isMobile || idx % 2 === 0 || idx === baselineTimeline.length - 1) {
        ctx.fillStyle = '#94A3B8';
        ctx.textAlign = 'center';
        ctx.fillText(b.label, x, height - 10);
      }
    });

    // Draw Baseline (Dashed Slate)
    if (basePts.length > 0) {
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(basePts[0].x, basePts[0].y);
      for (let i = 1; i < basePts.length; i++) {
        ctx.lineTo(basePts[i].x, basePts[i].y);
      }
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw Simulated (Solid Glowing Cyan/Teal)
    if (simPts.length > 0) {
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(simPts[0].x, simPts[0].y);
      for (let i = 1; i < simPts.length; i++) {
        ctx.lineTo(simPts[i].x, simPts[i].y);
      }
      ctx.strokeStyle = '#00F5D4';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      simPts.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, isMobile ? 3 : 4, 0, Math.PI * 2);
        ctx.fillStyle = '#00F5D4';
        ctx.fill();
      });
    }

    // Hover & Touch tooltip
    const showTwinTooltip = (clientX) => {
      const cRect = canvas.getBoundingClientRect();
      const mouseX = clientX - cRect.left;

      let closestIdx = 0;
      let closestDist = 9999;
      simPts.forEach((p, idx) => {
        const dist = Math.abs(p.x - mouseX);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = idx;
        }
      });

      if (closestDist < (isMobile ? 50 : 30)) {
        const s = simPts[closestIdx];
        const b = basePts[closestIdx];
        const diff = s.val - b.val;
        tooltip.style.display = 'block';
        tooltip.style.left = `${Math.min(Math.max(s.x, 90), width - 90)}px`;
        tooltip.style.top = `${Math.max(Math.min(s.y, b.y) - 10, 10)}px`;
        tooltip.innerHTML = `
          <strong>${s.label}</strong><br>
          <span style="color:#64748B">Baseline: ${currency}${b.val.toLocaleString()}</span><br>
          <span style="color:#00F5D4">Simulated: ${currency}${s.val.toLocaleString()}</span><br>
          <span style="color:${diff >= 0 ? '#06D6A0' : '#EF476F'}">
            Delta: ${diff >= 0 ? '+' : ''}${currency}${diff.toLocaleString()}
          </span>
        `;
      } else {
        tooltip.style.display = 'none';
      }
    };

    canvas.onmousemove = (e) => showTwinTooltip(e.clientX);
    canvas.ontouchstart = (e) => {
      if (e.touches.length > 0) showTwinTooltip(e.touches[0].clientX);
    };
    canvas.ontouchmove = (e) => {
      if (e.touches.length > 0) showTwinTooltip(e.touches[0].clientX);
    };
    canvas.onmouseleave = () => { tooltip.style.display = 'none'; };
    canvas.ontouchend = () => {
      setTimeout(() => { tooltip.style.display = 'none'; }, 2500);
    };

    if (!container._resizeBound && window.ResizeObserver) {
      container._resizeBound = true;
      let resizeTimer;
      const ro = new ResizeObserver(() => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          if (container.offsetWidth > 20) {
            window.LedgerCharts.renderTwinComparisonChart(containerId, baselineTimeline, simulatedTimeline, currency);
          }
        }, 150);
      });
      ro.observe(container);
    }
  }
};
