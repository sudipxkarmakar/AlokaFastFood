// AutoBrix Real-Time Operations Monitor Dashboard

class OperationsPanel {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
  }

  init() {
    this.render();
    
    // Subscribe to store updates
    window.AutoBrixStore.subscribe(() => {
      this.updateOperations();
    });

    // Refresh timers and alerts every 3 seconds
    this.alertInterval = setInterval(() => {
      this.updateOperations();
    }, 3000);

    this.updateOperations();
  }

  destroy() {
    if (this.alertInterval) clearInterval(this.alertInterval);
  }

  render() {
    // If the wrapper is already statically defined in HTML, don't overwrite it
    if (this.container.querySelector(".ops-grid")) {
      return;
    }
    this.container.innerHTML = `
      <div class="ops-grid">
        <!-- Left Panel: Status Feed & KPIs -->
        <div class="ops-sidebar">
          <div class="ops-summary-mini">
            <div class="ops-mini-stat glass-card">
              <span class="form-label-xs">Active Alerts</span>
              <span class="ops-mini-val" id="ops-alert-count" style="color:var(--color-critical);">0</span>
            </div>
            <div class="ops-mini-stat glass-card">
              <span class="form-label-xs">Total Active Orders</span>
              <span class="ops-mini-val" id="ops-active-count">0</span>
            </div>
            <div class="ops-mini-stat glass-card">
              <span class="form-label-xs">Staff Checked-In</span>
              <span class="ops-mini-val" id="ops-staff-count" style="color:var(--color-success);">0</span>
            </div>
          </div>
          
          <div class="glass-card" style="flex-grow:1; display:flex; flex-direction:column; overflow:hidden;">
            <h4 class="modal-section-title" style="margin-bottom:0.75rem;">Live Alerts Feed</h4>
            <div class="ops-live-alerts-list" id="ops-alerts-list"></div>
          </div>
        </div>
        
        <!-- Right Panel: Grid of Station Timelines & Active Orders -->
        <div class="ops-main-panel">
          <!-- Station Workload Vis -->
          <div class="glass-card">
            <h4 class="modal-section-title" style="margin-bottom:0.75rem;">Kitchen Station Occupancy</h4>
            <div class="station-ops-grid" id="ops-stations-grid"></div>
          </div>
          
          <!-- Live Active Orders List -->
          <div class="glass-card" style="flex-grow:1;">
            <h4 class="modal-section-title" style="margin-bottom:0.75rem;">Live Orders Monitor</h4>
            <div class="owner-table-wrapper" style="border:none;">
              <table class="owner-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Customer</th>
                    <th>Source</th>
                    <th>ETA</th>
                    <th>Fulfillment</th>
                    <th>Payment</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody id="ops-orders-list"></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  updateOperations() {
    const state = window.AutoBrixStore.state;
    if (!state) return;

    // 1. Scan and generate live alerts
    const alerts = this.scanAlerts(state);
    
    // Update KPI UI
    const alertCountEl = document.getElementById("ops-alert-count");
    if (alertCountEl) {
      alertCountEl.innerText = alerts.length;
      alertCountEl.style.color = alerts.some(a => a.severity === "CRITICAL") ? "var(--color-critical)" : "var(--color-warning)";
    }

    const activeOrders = state.orders.filter(o => ["ACCEPTED", "COOKING", "READY"].includes(o.fulfillmentStatus));
    const activeCountEl = document.getElementById("ops-active-count");
    if (activeCountEl) activeCountEl.innerText = activeOrders.length;

    const checkedInStaff = state.config.workers.filter(w => w.active).length;
    const staffCountEl = document.getElementById("ops-staff-count");
    if (staffCountEl) staffCountEl.innerText = checkedInStaff;

    // Render Alerts Feed
    const alertsListEl = document.getElementById("ops-alerts-list");
    if (alertsListEl) {
      if (alerts.length === 0) {
        alertsListEl.innerHTML = `<div style="font-size:0.8rem; color:var(--text-muted); text-align:center; padding-top:2rem;">All systems operational. No warnings.</div>`;
      } else {
        alertsListEl.innerHTML = alerts.map(alert => `
          <div class="ops-alert-card ${alert.severity}">
            <div style="display:flex; justify-content:space-between; font-weight:700;">
              <span>${alert.title}</span>
              <span class="alert-pill alert-${alert.severity.toLowerCase()}">${alert.severity}</span>
            </div>
            <div style="margin-top:0.25rem;">${alert.message}</div>
            <div class="ops-alert-time">${new Date(alert.timestamp).toLocaleTimeString()}</div>
          </div>
        `).join("");
      }
    }

    // Render Stations Grid
    const stationsGridEl = document.getElementById("ops-stations-grid");
    if (stationsGridEl) {
      stationsGridEl.innerHTML = Object.values(state.config.stations).map(station => {
        const queueTime = window.AutoBrixStore.getStationQueueTime(station.id);
        const workers = state.config.workers.filter(w => w.stations && w.stations.includes(station.id) && w.active);
        const capacity = window.AutoBrixStore.getStationEffectiveCapacity(station.id);
        
        // Calculate occupancy percentage based on 15 minutes wait threshold
        const occupancyPct = Math.min(100, Math.round((queueTime / 15) * 100));
        
        // Color based on occupancy
        let progressClass = "";
        if (occupancyPct >= 80) progressClass = "critical";
        else if (occupancyPct >= 50) progressClass = "warning";

        // Expected Free Time calculation
        const now = new Date();
        const freeTime = new Date(now.getTime() + queueTime * 60000);
        const freeTimeText = queueTime > 0 
          ? freeTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
          : "Idle";

        // Queue order tags
        const ordersInQueue = state.orders
          .filter(o => ["ACCEPTED", "COOKING"].includes(o.fulfillmentStatus) && o.items.some(it => it.station === station.id && it.status !== "READY"))
          .map(o => `#${o.id}`);

        return `
          <div class="station-ops-card glass-card">
            <div class="station-ops-header">
              <span class="station-ops-name">${station.name}</span>
              <span class="station-ops-capacity-badge">Staff: ${workers.length} (Speed: ${capacity.toFixed(1)}x)</span>
            </div>
            <div class="station-ops-progress-bar-container">
              <div class="station-ops-progress-bar ${progressClass}" style="width: ${occupancyPct}%;"></div>
            </div>
            <div class="station-ops-meta">
              <span>Load: ${occupancyPct}% (${Math.round(queueTime)}m)</span>
              <span>Free Time: ${freeTimeText}</span>
            </div>
            <div class="station-ops-workers">
              Queue: ${ordersInQueue.length > 0 ? ordersInQueue.join(", ") : "None"}
            </div>
          </div>
        `;
      }).join("");
    }

    // Render Orders list
    const ordersListEl = document.getElementById("ops-orders-list");
    if (ordersListEl) {
      if (activeOrders.length === 0) {
        ordersListEl.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:2rem;">No active orders cooking or served.</td></tr>`;
      } else {
        ordersListEl.innerHTML = activeOrders.map(order => {
          const badgeClass = `badge-${order.priority.toLowerCase()}`;
          const isFulfillReady = order.fulfillmentStatus === "READY";
          
          let paymentBtn = "";
          if (order.paymentStatus === "UNPAID") {
            paymentBtn = `<button class="k-item-btn cooking" onclick="opsPanel.collectPayment('${order.id}')" style="margin:0 2px;">Pay</button>`;
          }
          
          let serveBtn = "";
          if (isFulfillReady || order.fulfillmentStatus === "COOKING" || order.fulfillmentStatus === "ACCEPTED") {
            serveBtn = `<button class="k-item-btn ready" onclick="opsPanel.serveOrder('${order.id}')" style="margin:0 2px;">Serve</button>`;
          }

          const itemsSummary = order.items.map(it => `${it.quantity}x ${it.name}`).join(", ");

          return `
            <tr>
              <td>
                <strong style="font-family:var(--font-mono); font-size:0.95rem;">#${order.id}</strong>
                <div style="font-size:0.7rem; color:var(--text-muted); max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${itemsSummary}">${itemsSummary}</div>
              </td>
              <td>${order.customerName}</td>
              <td><span class="badge ${badgeClass}">${order.source}</span></td>
              <td style="font-family:var(--font-mono); font-weight:600;">${order.eta}m</td>
              <td>
                <span class="alert-pill alert-${order.fulfillmentStatus === "READY" ? "success" : (order.fulfillmentStatus === "COOKING" ? "warning" : "info")}">
                  ${order.fulfillmentStatus}
                </span>
              </td>
              <td>
                <span class="alert-pill alert-${order.paymentStatus === "PAID" ? "success" : "critical"}">
                  ${order.paymentStatus}
                </span>
              </td>
              <td>
                <div style="display:flex;">
                  ${serveBtn}
                  ${paymentBtn}
                  <button class="k-item-btn" onclick="opsPanel.cancelOrder('${order.id}')" style="margin:0 2px; color:var(--color-critical);">Cancel</button>
                </div>
              </td>
            </tr>
          `;
        }).join("");
      }
    }
  }

  scanAlerts(state) {
    const alerts = [];
    const now = new Date().toISOString();

    // 1. Inventory thresholds warning
    // Raw Stock Alert
    for (const [key, raw] of Object.entries(state.inventory.raw)) {
      const available = raw.stock - raw.reserved;
      if (available <= 0) {
        alerts.push({
          severity: "CRITICAL",
          title: "No Stock Available",
          message: `Raw ingredient <strong>${raw.name}</strong> is completely DEPLETED. Menu items using it cannot be ordered.`,
          timestamp: now
        });
      } else if (available < raw.minStock) {
        alerts.push({
          severity: "WARNING",
          title: "Low Ingredient Stock",
          message: `Raw ingredient <strong>${raw.name}</strong> has only ${(available / raw.conversionFactor).toFixed(1)}${raw.purchaseUnit} left (Min: ${raw.minStock / raw.conversionFactor}${raw.purchaseUnit}).`,
          timestamp: now
        });
      }
    }

    // Prepared Base Stock Alert
    for (const [key, prep] of Object.entries(state.inventory.prepared)) {
      const available = prep.stock - prep.reserved;
      if (available === 0) {
        alerts.push({
          severity: "CRITICAL",
          title: "Prepped Base Exhausted",
          message: `Prepared base <strong>${prep.name}</strong> is empty. Switch morning batch prep or raw production!`,
          timestamp: now
        });
      } else if (available < prep.minStock) {
        alerts.push({
          severity: "INFO",
          title: "Low Prepped Stocks",
          message: `Prepared base <strong>${prep.name}</strong> has only ${available} ${prep.unit} remaining (Min: ${prep.minStock}).`,
          timestamp: now
        });
      }
    }

    // 2. Station Overloaded warnings
    for (const station of Object.values(state.config.stations)) {
      const queueTime = window.AutoBrixStore.getStationQueueTime(station.id);
      if (queueTime > 15) {
        alerts.push({
          severity: "WARNING",
          title: "Station Overloaded",
          message: `<strong>${station.name}</strong> queue is backlogged by <strong>${Math.round(queueTime)} minutes</strong>. Tweak labor check-ins!`,
          timestamp: now
        });
      }
    }

    // 3. Delayed Orders alerts
    state.orders.forEach(order => {
      if (["ACCEPTED", "COOKING"].includes(order.fulfillmentStatus)) {
        const elapsedMin = Math.floor((new Date() - new Date(order.timestamp)) / 60000);
        // Exceeding original ETA by more than 5 minutes
        if (elapsedMin > (order.eta + 5)) {
          alerts.push({
            severity: "CRITICAL",
            title: "Order Delayed Alert",
            message: `Order <strong>#${order.id}</strong> for ${order.customerName} has run for <strong>${elapsedMin}m</strong> (ETA was ${order.eta}m).`,
            timestamp: now
          });
        }
      }
    });

    return alerts;
  }

  // Quick operations actions
  async serveOrder(orderId) {
    if (window.AlokaAPI.isOnline()) {
      try {
        await window.AlokaAPI.patch(`/orders/${orderId}/status`, { fulfillment_status: "COMPLETED" });
        await window.AlokaAPI.loadAllState();
      } catch (err) {
        alert("Error serving order: " + err.message);
      }
    } else {
      window.AutoBrixStore.completeOrder(orderId);
    }
  }

  async collectPayment(orderId) {
    if (window.AlokaAPI.isOnline()) {
      try {
        await window.AlokaAPI.patch(`/orders/${orderId}/status`, { payment_status: "PAID" });
        await window.AlokaAPI.loadAllState();
      } catch (err) {
        alert("Error collecting payment: " + err.message);
      }
    } else {
      window.AutoBrixStore.updatePaymentStatus(orderId, "PAID");
    }
  }

  async cancelOrder(orderId) {
    if (confirm(`Are you sure you want to cancel order #${orderId}? This will release reserved ingredients.`)) {
      if (window.AlokaAPI.isOnline()) {
        try {
          await window.AlokaAPI.patch(`/orders/${orderId}/status`, { fulfillment_status: "CANCELLED" });
          await window.AlokaAPI.loadAllState();
        } catch (err) {
          alert("Error cancelling order: " + err.message);
        }
      } else {
        window.AutoBrixStore.cancelOrder(orderId);
      }
    }
  }
}

// Bind globally
window.OperationsPanel = OperationsPanel;
