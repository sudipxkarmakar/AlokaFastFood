// AutoBrix Owner / Admin Dashboard Module

class OwnerPanel {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.activeTab = "analytics"; // analytics, menu, recipes, stations, labor, inventory, expenditures
    this.selectedRecipeItem = null;
    this.selectedBatchRecipe = null;
    this.menuFormTab = "single"; // single, generator
  }

  init() {
    this.render();
    this.bindEvents();
    
    // Subscribe to store updates
    window.AutoBrixStore.subscribe(() => {
      this.updateActiveTabContent();
    });

    this.updateActiveTabContent();
  }

  render() {
    // If the wrapper is already statically defined in HTML, don't overwrite it
    if (this.container.querySelector(".owner-grid")) {
      return;
    }
    this.container.innerHTML = `
      <div class="owner-grid">
        <!-- Sidebar Tabs -->
        <div class="owner-sidebar">
          <button class="owner-tab-btn ${this.activeTab === "analytics" ? "active" : ""}" data-tab="analytics">Operations Report</button>
          <button class="owner-tab-btn ${this.activeTab === "menu" ? "active" : ""}" data-tab="menu">Menu</button>
          <button class="owner-tab-btn ${this.activeTab === "recipes" ? "active" : ""}" data-tab="recipes">Recipe Editor</button>
          <button class="owner-tab-btn ${this.activeTab === "stations" ? "active" : ""}" data-tab="stations">Station</button>
          <button class="owner-tab-btn ${this.activeTab === "labor" ? "active" : ""}" data-tab="labor">Employee</button>
          <button class="owner-tab-btn ${this.activeTab === "inventory" ? "active" : ""}" data-tab="inventory">Batch Prep & Stock</button>
          <button class="owner-tab-btn ${this.activeTab === "expenditures" ? "active" : ""}" data-tab="expenditures">Purchase</button>
        </div>
        
        <!-- Tab Content Workspace -->
        <div class="owner-panel-content" id="owner-workspace"></div>
      </div>
    `;
  }

  bindEvents() {
    // Sidebar tabs toggle
    this.container.querySelector(".owner-sidebar").addEventListener("click", (e) => {
      const btn = e.target.closest(".owner-tab-btn");
      if (btn) {
        this.activeTab = btn.dataset.tab;
        
        // Update active class in sidebar
        this.container.querySelectorAll(".owner-tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        
        this.updateActiveTabContent();
      }
    });
  }

  async updateActiveTabContent() {
    const workspace = document.getElementById("owner-workspace");
    if (!workspace) return;

    const state = window.AutoBrixStore.state;

    // Initialize selections if null
    if (!this.selectedRecipeItem && Object.keys(state.config.menuItems).length > 0) {
      this.selectedRecipeItem = Object.keys(state.config.menuItems)[0];
    }
    if (!this.selectedBatchRecipe && Object.keys(state.config.batchRecipes).length > 0) {
      this.selectedBatchRecipe = Object.keys(state.config.batchRecipes)[0];
    }

    if (this.activeTab === "analytics") {
      this.renderAnalyticsTab(workspace, state);
    } else if (this.activeTab === "menu") {
      this.renderMenuTab(workspace, state);
    } else if (this.activeTab === "recipes") {
      this.renderRecipesTab(workspace, state);
    } else if (this.activeTab === "stations") {
      this.renderStationsTab(workspace, state);
    } else if (this.activeTab === "labor") {
      this.renderLaborTab(workspace, state);
    } else if (this.activeTab === "inventory") {
      this.renderInventoryTab(workspace, state);
    } else if (this.activeTab === "expenditures") {
      await this.loadExpendituresData(state);
      this.renderExpendituresTab(workspace, state);
    }
  }

  // ==========================================
  // TAB: Analytics & Day Closing Reports
  // ==========================================
  renderAnalyticsTab(container, state) {
    let revenue = 0;
    let orderCount = 0;
    let avgWaitTime = 0;
    let completedWaitTimes = [];

    const todayOrders = state.orders.filter(o => o.fulfillmentStatus === "COMPLETED" || o.paymentStatus === "PAID");
    todayOrders.forEach(o => {
      revenue += o.total;
      orderCount++;
      if (o.timestamps && o.timestamps.completed && o.timestamps.accepted) {
        const ms = new Date(o.timestamps.completed) - new Date(o.timestamps.accepted);
        completedWaitTimes.push(ms / 1000 / 60);
      }
    });

    if (completedWaitTimes.length > 0) {
      avgWaitTime = Math.round(completedWaitTimes.reduce((s, w) => s + w, 0) / completedWaitTimes.length);
    }

    const expenses = state.expenses.reduce((sum, exp) => sum + (parseFloat(exp.cost) || 0), 0);
    const netProfit = revenue - expenses;

    // Identify low stock items
    const lowStockItems = [];
    for (const [key, raw] of Object.entries(state.inventory.raw)) {
      if ((raw.stock - raw.reserved) < raw.minStock) {
        lowStockItems.push(raw.name);
      }
    }

    // Identify best selling menu item
    let itemSales = {};
    todayOrders.forEach(o => {
      o.items.forEach(it => {
        itemSales[it.name] = (itemSales[it.name] || 0) + it.quantity;
      });
    });
    let bestSeller = "No Orders";
    let bestCount = 0;
    for (const [name, qty] of Object.entries(itemSales)) {
      if (qty > bestCount) {
        bestCount = qty;
        bestSeller = `${name} (${qty} sold)`;
      }
    }

    // Calculate today's Egg recommendations
    const eggRecs = window.AutoBrixStore.calculateEggPricingRecommendations(state);

    container.innerHTML = `
      <div class="kpi-row">
        <div class="kpi-card glass-card">
          <span class="kpi-title">Today's Revenue</span>
          <span class="kpi-value" style="color:var(--color-success);">₹${revenue.toFixed(2)}</span>
        </div>
        <div class="kpi-card glass-card">
          <span class="kpi-title">Purchases logged</span>
          <span class="kpi-value" style="color:var(--color-warning);">₹${expenses.toFixed(2)}</span>
        </div>
        <div class="kpi-card glass-card">
          <span class="kpi-title">Net Est. Profit</span>
          <span class="kpi-value" style="color:${netProfit >= 0 ? "var(--color-success)" : "var(--color-critical)"};">₹${netProfit.toFixed(2)}</span>
        </div>
        <div class="kpi-card glass-card">
          <span class="kpi-title">Orders Completed</span>
          <span class="kpi-value">${orderCount}</span>
        </div>
      </div>
      
      <div class="kpi-row">
        <div class="kpi-card glass-card" style="padding:0.75rem 1rem;">
          <span class="kpi-title">Avg Delivery Time</span>
          <span style="font-size:1.1rem; font-weight:700; margin-top:0.25rem;">${avgWaitTime > 0 ? `${avgWaitTime} minutes` : "5 min (est)"}</span>
        </div>
        <div class="kpi-card glass-card" style="padding:0.75rem 1rem;">
          <span class="kpi-title">Top Selling Product</span>
          <span style="font-size:1.1rem; font-weight:700; margin-top:0.25rem; color:var(--accent-color);">${bestSeller}</span>
        </div>
        <div class="kpi-card glass-card" style="padding:0.75rem 1rem;">
          <span class="kpi-title">Low Stock Raw Materials</span>
          <span style="font-size:1.1rem; font-weight:700; margin-top:0.25rem; color:${lowStockItems.length > 0 ? "var(--color-warning)" : "var(--color-success)"};">
            ${lowStockItems.length > 0 ? lowStockItems.join(", ") : "None. Restocked."}
          </span>
        </div>
      </div>

      <!-- Financial Chart.js section -->
      <div class="glass-card" style="margin-bottom:1.5rem;">
        <h4 class="modal-section-title" style="margin-bottom:0.5rem; display:flex; justify-content:space-between; align-items:center;">
          <span>Daily Financial Analytics Trend (EBITDA & Costs)</span>
          <span style="font-size:0.75rem; font-weight:normal; color:var(--text-muted);">Last 7 Closed Days</span>
        </h4>
        <div style="position: relative; height: 280px; width: 100%;">
          <canvas id="financialsChart"></canvas>
        </div>
      </div>

      <!-- Egg Stock & Dynamic Pricing Dashboard -->
      <div class="glass-card" style="margin-bottom:1.5rem; display:grid; grid-template-columns:1fr 1.8fr; gap:1.5rem;">
        
        <!-- Left: Rotten logger & suggestions -->
        <div style="border-right: 1px solid rgba(255,255,255,0.06); padding-right:1.5rem;">
          <h4 class="modal-section-title" style="margin-bottom:0.5rem;">Egg Tracking & Dynamic Pricing</h4>
          <span style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:1rem;">Maintains 5% overall profit on raw egg sales by adjusting for wastage and purchase cost fluctuations.</span>
          
          <div style="background:rgba(0,0,0,0.2); padding:0.75rem; border-radius:6px; margin-bottom:1rem; border:1px solid rgba(255,255,255,0.04);">
            <span style="font-size:0.8rem; font-weight:600; display:block; margin-bottom:6px; color:var(--accent-color);">Suggested Egg Selling Prices:</span>
            <div style="font-size:0.8rem; display:flex; flex-direction:column; gap:4px; font-family:var(--font-mono);">
              <div style="display:flex; justify-content:space-between;"><span>1pc egg:</span><strong>₹${eggRecs.suggestedPrices.pc1 || '0.00'}</strong></div>
              <div style="display:flex; justify-content:space-between;"><span>12pc egg:</span><strong>₹${eggRecs.suggestedPrices.pc12 || '0.00'}</strong></div>
              <div style="display:flex; justify-content:space-between;"><span>15pc egg:</span><strong>₹${eggRecs.suggestedPrices.pc15 || '0.00'}</strong></div>
              <div style="display:flex; justify-content:space-between;"><span>1 tray (30 pc):</span><strong>₹${eggRecs.suggestedPrices.tray1 || '0.00'}</strong></div>
              <div style="display:flex; justify-content:space-between;"><span>2 tray (60 pc):</span><strong>₹${eggRecs.suggestedPrices.tray2 || '0.00'}</strong></div>
              <div style="display:flex; justify-content:space-between;"><span>1 carton (210 pc):</span><strong>₹${eggRecs.suggestedPrices.carton1 || '0.00'}</strong></div>
            </div>
            
            <button class="pos-action-btn primary" onclick="ownerPanel.handleApplyEggPricing()" style="width:100%; margin-top:10px; font-size:0.75rem; padding:6px; grid-column:auto; font-weight:600; height:32px;">Apply Prices to Menu</button>
          </div>

          <div style="display:flex; flex-direction:column; gap:8px; background:rgba(255,255,255,0.02); padding:0.75rem; border-radius:6px;">
            <span style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:var(--text-secondary);">Log Egg Wastage / Rotten</span>
            <div style="display:flex; gap:0.5rem; align-items:center;">
              <input type="date" class="pos-input-sm" id="egg-log-date" value="${new Date().toISOString().split("T")[0]}" style="font-size:0.75rem; padding:2px; height:28px;">
              <input type="number" class="pos-input-sm" id="egg-rotten-count" placeholder="Qty pcs" min="0" value="${state.eggTrackingRotten || ''}" style="width:80px; font-size:0.75rem; padding:2px; height:28px; text-align:center;">
            </div>
            <button class="pos-action-btn" onclick="ownerPanel.handleSaveEggTracking()" style="padding:6px; font-size:0.75rem; font-weight:600; grid-column:auto; height:30px; margin:0; width:100%;">Save Egg Journal</button>
          </div>
        </div>

        <!-- Right: Egg history table -->
        <div>
          <h4 class="modal-section-title" style="margin-bottom:0.5rem;">Egg Reconciliation Ledger</h4>
          <div class="owner-table-wrapper" style="border:none; max-height:220px; overflow-y:auto;">
            <table class="owner-table" style="font-size:0.75rem;">
              <thead>
                <tr>
                  <th>Date</th>
                  <th style="text-align:center;">Opening</th>
                  <th style="text-align:center;">Purchased</th>
                  <th style="text-align:center;">Rotten</th>
                  <th style="text-align:center;">In Prep</th>
                  <th style="text-align:center;">Sold (Raw)</th>
                  <th style="text-align:center;">Closing</th>
                  <th style="text-align:center;">Sug. Price</th>
                </tr>
              </thead>
              <tbody>
                ${!state.eggTrackingHistory || state.eggTrackingHistory.length === 0
                  ? `<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:1rem;">No egg logs stored. Log purchase/rotten to start tracking.</td></tr>`
                  : state.eggTrackingHistory.map(log => `
                    <tr>
                      <td><strong>${log.tracking_date.split('T')[0]}</strong></td>
                      <td style="text-align:center; font-family:var(--font-mono);">${log.opening_stock}</td>
                      <td style="text-align:center; font-family:var(--font-mono); color:var(--color-success); font-weight:600;">+${log.purchased}</td>
                      <td style="text-align:center; font-family:var(--font-mono); color:var(--color-critical); font-weight:600;">-${log.rotten}</td>
                      <td style="text-align:center; font-family:var(--font-mono); color:var(--text-muted);">${log.used_in_prep}</td>
                      <td style="text-align:center; font-family:var(--font-mono); color:var(--text-muted);">${log.used_in_menu}</td>
                      <td style="text-align:center; font-family:var(--font-mono); font-weight:600;">${log.closing_stock}</td>
                      <td style="text-align:center; font-family:var(--font-mono); font-weight:600; color:var(--accent-color);">₹${(log.recommended_price || 0).toFixed(2)}</td>
                    </tr>
                  `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <!-- Day Closing Trigger -->
      <div class="glass-card" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
        <div>
          <h3 style="font-size:1rem; font-weight:600;">Operating Cycle Finalizer</h3>
          <p style="font-size:0.8rem; color:var(--text-secondary); margin-top:0.25rem;">
            Finalize sales, expenses, and log the inventory snapshot. This resets active state caches and writes to history.
          </p>
        </div>
        <button class="pos-action-btn primary" id="btn-close-day" style="grid-column:auto; width:180px;">Close Operating Day</button>
      </div>

      <!-- Closed Days History Reports -->
      <div class="glass-card">
        <h4 class="modal-section-title" style="margin-bottom:0.75rem;">Closing Journal Archive</h4>
        <div class="owner-table-wrapper" style="border:none;">
          <table class="owner-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Orders</th>
                <th>Revenue</th>
                <th>Purchases</th>
                <th>Net Profit</th>
              </tr>
            </thead>
            <tbody>
              ${state.dayHistory.length === 0 
                ? `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:2rem;">No historical archives logged yet.</td></tr>` 
                : state.dayHistory.map(day => `
                  <tr>
                    <td><strong>${day.date}</strong></td>
                    <td>${day.orderCount}</td>
                    <td style="color:var(--color-success); font-weight:600;">₹${(day.revenue || 0).toFixed(2)}</td>
                    <td style="color:var(--color-warning);">₹${(day.expenses || 0).toFixed(2)}</td>
                    <td style="color:${(day.netProfit || 0) >= 0 ? "var(--color-success)" : "var(--color-critical)"}; font-weight:600;">
                      ₹${(day.netProfit || 0).toFixed(2)}
                    </td>
                  </tr>
                `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Initialize Chart in next tick
    setTimeout(() => {
      this.initFinancialsChart(state);
    }, 50);

    // Event Listener for closing day
    document.getElementById("btn-close-day").addEventListener("click", async () => {
      if (confirm("Are you sure you want to CLOSE THE OPERATING DAY? This generates an reporting snap and resets active cashier/kitchen grids!")) {
        if (window.AlokaAPI.isOnline()) {
          try {
            const report = await window.AlokaAPI.post('/orders/day-close', {});
            await window.AlokaAPI.loadAllState();
            alert(`Day closed! Revenue of ₹${parseFloat(report.revenue).toFixed(2)} archived. Active lists cleared.`);
          } catch (err) {
            alert("Error closing day: " + err.message);
          }
        } else {
          const report = window.AutoBrixStore.closeDay();
          alert(`Day closed! Revenue of ₹${report.revenue.toFixed(2)} archived. Active lists cleared.`);
        }
        this.updateActiveTabContent();
      }
    });
  }

  initFinancialsChart(state) {
    const canvas = document.getElementById("financialsChart");
    if (!canvas) return;

    if (!window.Chart) {
      canvas.parentElement.innerHTML = `<div style="text-align:center; padding:3rem; color:var(--text-secondary);">Chart.js library is loading or unavailable.</div>`;
      return;
    }

    // Get last 7 closed days from dayHistory
    const lastDays = [...state.dayHistory].slice(0, 7).reverse();
    if (lastDays.length === 0) {
      const ctx = canvas.getContext("2d");
      ctx.font = "14px Inter, sans-serif";
      ctx.fillStyle = "#888";
      ctx.textAlign = "center";
      ctx.fillText("No historical closed days found to plot graph.", canvas.width / 2, canvas.height / 2);
      return;
    }

    const labels = lastDays.map(d => d.date);
    const revenues = lastDays.map(d => d.revenue);
    
    const foodCosts = [];
    const laborCosts = [];
    const fixedCosts = [];
    const ebitdas = [];

    lastDays.forEach(day => {
      let food = 0;
      let labor = 0;
      let fixed = 0;
      
      const dayExpenses = state.expenses.filter(e => {
        const expDate = e.date ? e.date.split('T')[0] : '';
        return expDate === day.date;
      });

      dayExpenses.forEach(e => {
        if (e.raw_ingredient_id !== null) {
          food += e.cost;
        } else if (e.item.toLowerCase().includes('wage') || e.item.toLowerCase().includes('salary') || e.item.toLowerCase().includes('payroll') || e.supplier.toLowerCase().includes('payroll')) {
          labor += e.cost;
        } else {
          fixed += e.cost;
        }
      });

      foodCosts.push(food);
      laborCosts.push(labor);
      fixedCosts.push(fixed);
      ebitdas.push(day.revenue - (food + labor + fixed));
    });

    const ctx = canvas.getContext("2d");
    new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Revenue',
            data: revenues,
            type: 'line',
            borderColor: '#10B981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: false,
            tension: 0.2,
            yAxisID: 'y',
            zIndex: 10
          },
          {
            label: 'EBITDA',
            data: ebitdas,
            type: 'line',
            borderColor: '#F59E0B',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            borderDash: [5, 5],
            fill: false,
            tension: 0.2,
            yAxisID: 'y',
            zIndex: 9
          },
          {
            label: 'Food Cost',
            data: foodCosts,
            backgroundColor: 'rgba(239, 68, 68, 0.7)',
            stack: 'costs',
            yAxisID: 'y'
          },
          {
            label: 'Labor Cost',
            data: laborCosts,
            backgroundColor: 'rgba(59, 130, 246, 0.7)',
            stack: 'costs',
            yAxisID: 'y'
          },
          {
            label: 'Fixed Cost',
            data: fixedCosts,
            backgroundColor: 'rgba(139, 92, 246, 0.7)',
            stack: 'costs',
            yAxisID: 'y'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            stacked: true,
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#9CA3AF' }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#9CA3AF', callback: val => '₹' + val }
          }
        },
        plugins: {
          legend: {
            labels: { color: '#F3F4F6' }
          }
        }
      }
    });
  }

  async handleSaveEggTracking() {
    const date = document.getElementById("egg-log-date").value;
    const rotten = parseInt(document.getElementById("egg-rotten-count").value) || 0;
    
    if (!date) {
      alert("Please select a valid date!");
      return;
    }
    
    window.AutoBrixStore.state.eggTrackingRotten = rotten;

    if (window.AlokaAPI.isOnline()) {
      try {
        const calc = await window.AlokaAPI.get(`/inventory/egg-tracking/calculate/${date}`);
        calc.rotten = rotten;
        calc.closing_stock = Math.max(0, calc.opening_stock + calc.purchased - rotten - calc.used_in_prep - calc.used_in_menu);
        
        const store = window.AutoBrixStore;
        const recommendations = store.calculateEggPricingRecommendations(store.state);
        calc.recommended_price = recommendations.suggestedPricePerEgg;

        await window.AlokaAPI.post(`/inventory/egg-tracking`, calc);
        await window.AlokaAPI.loadAllState();
        alert(`Successfully logged ${rotten} rotten eggs for ${date}! Suggested price: ₹${calc.recommended_price}/egg.`);
      } catch (err) {
        alert("Error saving egg tracking: " + err.message);
      }
    } else {
      alert("Logged rotten count locally!");
    }
    this.updateActiveTabContent();
  }

  async handleApplyEggPricing() {
    const store = window.AutoBrixStore;
    const recommendations = store.calculateEggPricingRecommendations(store.state);
    if (!recommendations.suggestedPrices || Object.keys(recommendations.suggestedPrices).length === 0) {
      alert("No pricing recommendation available.");
      return;
    }
    
    const prices = recommendations.suggestedPrices;
    const mapped = [
      { id: 'egg_1pc', price: prices.pc1 },
      { id: 'egg_12pc', price: prices.pc12 },
      { id: 'egg_15pc', price: prices.pc15 },
      { id: 'egg_tray', price: prices.tray1 },
      { id: 'egg_2tray', price: prices.tray2 },
      { id: 'egg_carton', price: prices.carton1 }
    ];

    if (window.AlokaAPI.isOnline()) {
      try {
        for (const item of mapped) {
          await window.AlokaAPI.patch(`/menu/egg/variants/${item.id}`, { price: item.price });
        }
        await window.AlokaAPI.loadAllState();
        alert("Applied suggested egg prices to the Menu tab successfully!");
      } catch (err) {
        alert("Error updating egg prices: " + err.message);
      }
    } else {
      store.updateState(s => {
        const item = s.config.menuItems.egg;
        if (item) {
          if (item.variants['1pc']) item.variants['1pc'].price = prices.pc1;
          if (item.variants['12pc']) item.variants['12pc'].price = prices.pc12;
          if (item.variants['15pc']) item.variants['15pc'].price = prices.pc15;
          if (item.variants['1tray']) item.variants['1tray'].price = prices.tray1;
          if (item.variants['2tray']) item.variants['2tray'].price = prices.tray2;
          if (item.variants['1carton']) item.variants['1carton'].price = prices.carton1;
        }
      });
      alert("Applied suggested egg prices locally!");
    }
    this.updateActiveTabContent();
  }

  getItemCategory(item) {
    const name = item.name.toLowerCase();
    const id = item.id.toLowerCase();
    if (name.includes("chowmein") || id.includes("chowmein") || name.includes("chamine") || id.includes("chamine") || name.includes("charming") || id.includes("charming")) return "chowmein";
    if (name.includes("pasta") || id.includes("pasta")) return "pasta";
    if (name.includes("roll") || id.includes("roll")) return "roll";
    if (name.includes("mughlai") || id.includes("mughlai") || name.includes("moghlai") || id.includes("moghlai")) return "mughlai";
    if (name.includes("pakora") || id.includes("pakora") || name.includes("pagoda") || id.includes("pagoda")) return "pakora";
    if (name.includes("chicken paratha") || id.includes("chicken_paratha") ||
        name.includes("gogni") || id.includes("gogni") || name.includes("sabzi paratha") || id.includes("sabzi_paratha") || name.includes("ghugni") || id.includes("ghugni") ||
        name.includes("chola") || id.includes("chola") || name.includes("bhatura") || id.includes("bhatura")) {
      return "combos";
    }
    if (name.includes("pepsi") || id.includes("pepsi") || name.includes("7up") || id.includes("7up") || name.includes("mirinda") || id.includes("mirinda") || name.includes("dew") || id.includes("dew") || name.includes("water") || id.includes("water") || name.includes("beverage") || id.includes("beverage")) return "beverage";
    return "others";
  }

  // ==========================================
  // TAB: Menu Management & Pricing
  // ==========================================
  renderMenuTab(container, state) {
    const categories = [
      { id: "chowmein", name: "Chowmein" },
      { id: "pasta", name: "Pasta" },
      { id: "roll", name: "Roll" },
      { id: "mughlai", name: "Mughlai" },
      { id: "pakora", name: "Chicken Pakora" },
      { id: "combos", name: "Combos" },
      { id: "beverage", name: "Beverages" },
      { id: "others", name: "Others / Mains" }
    ];

    const categorySectionsHTML = categories.map(cat => `
      <div class="category-section" style="margin-bottom: 0.8rem; padding: 0.75rem;">
        <h3 class="category-title" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
          <span>${cat.name}</span>
          <span style="font-size:0.75rem; color:var(--text-muted); background:rgba(255,255,255,0.05); padding:3px 10px; border-radius:12px; font-weight:normal; letter-spacing:0.02em;">Drag handle ⠿ to sort</span>
        </h3>
        <div class="owner-table-wrapper" style="border:none; background:transparent;">
          <table class="owner-table">
            <thead>
              <tr>
                <th style="width: 40px; text-align:center;"></th>
                <th style="width: 60px; text-align:center;">Image</th>
                <th style="min-width: 150px;">Menu Item</th>
                <th style="width: 110px;">Station</th>
                <th style="width: 90px; text-align:center;">Prep (Min)</th>
                <th style="width: 100px;">Variant</th>
                <th style="width: 95px; text-align:center;">Price (₹)</th>
                <th style="width: 110px; text-align:right;">Food Cost</th>
                <th style="width: 110px; text-align:right;">Gross Margin</th>
                <th style="width: 90px; text-align:center;">Margin %</th>
                <th style="width: 90px; text-align:center;">Live Stock</th>
                <th style="width: 70px; text-align:center;">Active</th>
                <th style="width: 100px; text-align:center;">Actions</th>
              </tr>
            </thead>
            <tbody class="menu-rows-category-container" data-category="${cat.id}" id="menu-rows-${cat.id}"></tbody>
          </table>
        </div>
      </div>
    `).join("");

    container.innerHTML = `
      <!-- Add New Item Form / Generator Section -->
      <div class="glass-card" style="margin-bottom:1rem; padding:1rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.06); padding-bottom:0.5rem; margin-bottom:0.75rem;">
          <h4 class="modal-section-title" style="margin-bottom:0; font-size:1.1rem; font-weight:700;">Menu Item Creator</h4>
          <div class="nav-buttons" style="gap:6px; display:inline-flex; background:rgba(0,0,0,0.2); padding:3px; border-radius:8px;">
            <button class="nav-btn ${this.menuFormTab === 'single' ? 'active' : ''}" id="btn-tab-single-item" style="padding:6px 12px; font-size:0.75rem; border-radius:6px; margin:0; height:28px;">Single Item</button>
            <button class="nav-btn ${this.menuFormTab === 'generator' ? 'active' : ''}" id="btn-tab-smart-generator" style="padding:6px 12px; font-size:0.75rem; border-radius:6px; margin:0; height:28px;">✨ Smart Generator</button>
          </div>
        </div>

        ${this.menuFormTab === 'single' ? `
        <form id="menu-add-form" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:0.75rem; align-items:end;">
          <div style="grid-column: span 2; display:flex; flex-direction:column; gap:0.4rem;">
            <label class="form-label-xs" style="font-weight:600; color:var(--text-secondary);">Item Name</label>
            <input type="text" class="owner-input-cell" id="menu-add-name" placeholder="e.g. Chicken Shawarma" required style="height:32px; padding:4px 10px;">
          </div>
          <div style="display:flex; flex-direction:column; gap:0.4rem;">
            <label class="form-label-xs" style="font-weight:600; color:var(--text-secondary);">Prep Time (Min)</label>
            <input type="number" class="owner-input-cell" id="menu-add-preptime" value="3" min="1" required style="height:32px; text-align:center;">
          </div>
          <div style="display:flex; flex-direction:column; gap:0.4rem;">
            <label class="form-label-xs" style="font-weight:600; color:var(--text-secondary);">Assigned Station</label>
            <select class="pos-select-sm" id="menu-add-station" required style="height:32px; padding:0 10px; font-size:0.8rem;">
              ${Object.keys(state.config.stations).map(s => `<option value="${s}">${state.config.stations[s].name}</option>`).join("")}
            </select>
          </div>
          <div style="display:flex; flex-direction:column; gap:0.4rem;">
            <label class="form-label-xs" style="font-weight:600; color:var(--text-secondary);">Variant Name</label>
            <select class="pos-select-sm" id="menu-add-variant" style="height:32px; padding:0 10px; font-size:0.8rem;">
              <option value="Single">Single</option>
              <option value="Half">Half</option>
              <option value="Full">Full</option>
            </select>
          </div>
          <div style="display:flex; flex-direction:column; gap:0.4rem;">
            <label class="form-label-xs" style="font-weight:600; color:var(--text-secondary);">Food Type</label>
            <select class="pos-select-sm" id="menu-add-foodtype" style="height:32px; padding:0 10px; font-size:0.8rem;">
              <option value="non-veg">Non-Veg</option>
              <option value="veg">Veg</option>
              <option value="egg">Egg</option>
            </select>
          </div>
          <div style="display:flex; flex-direction:column; gap:0.4rem;">
            <label class="form-label-xs" style="font-weight:600; color:var(--text-secondary);">Price (₹)</label>
            <input type="number" class="owner-input-cell" id="menu-add-price" placeholder="Price" min="0" required style="height:32px; text-align:center;">
          </div>
          <div style="grid-column: span 2; display:flex; flex-direction:column; gap:0.4rem;">
            <label class="form-label-xs" style="font-weight:600; color:var(--text-secondary);">Preview Image</label>
            <input type="file" id="menu-add-image" accept="image/*" class="owner-input-cell" style="padding:4px; height:32px; font-size:0.75rem;">
          </div>
          <button type="submit" class="pos-action-btn primary" style="padding:0; margin:0; width:100%; height:32px; border-radius:6px; font-weight:600;">Add Menu Item</button>
        </form>
        ` : `
        <form id="menu-generator-form" style="display:flex; flex-direction:column; gap:0.75rem;">
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:0.75rem; align-items:end;">
            <div style="grid-column: span 2; display:flex; flex-direction:column; gap:0.4rem;">
              <label class="form-label-xs" style="font-weight:600; color:var(--text-secondary);">Base Item Name (e.g. Chowmein, Roll, Pasta)</label>
              <div style="display:flex; gap:8px; align-items:center;">
                <input type="text" class="owner-input-cell" id="gen-base-name" placeholder="Enter base name..." required style="flex:1; height:32px; padding:4px 10px;">
                <button type="button" class="pos-action-btn secondary" style="padding:0 12px; font-size:0.75rem; margin:0; height:32px; border-radius:6px; font-weight:600;" id="btn-fill-chowmein">Chowmein</button>
                <button type="button" class="pos-action-btn secondary" style="padding:0 12px; font-size:0.75rem; margin:0; height:32px; border-radius:6px; font-weight:600;" id="btn-fill-roll">Roll</button>
                <button type="button" class="pos-action-btn secondary" style="padding:0 12px; font-size:0.75rem; margin:0; height:32px; border-radius:6px; font-weight:600;" id="btn-fill-pasta">Pasta</button>
              </div>
            </div>

            <div style="display:flex; flex-direction:column; gap:0.4rem;">
              <label class="form-label-xs" style="font-weight:600; color:var(--text-secondary);">Prep Time (Min)</label>
              <input type="number" class="owner-input-cell" id="gen-preptime" value="3" min="1" required style="height:32px; text-align:center;">
            </div>

            <div style="display:flex; flex-direction:column; gap:0.4rem;">
              <label class="form-label-xs" style="font-weight:600; color:var(--text-secondary);">Assigned Station</label>
              <select class="pos-select-sm" id="gen-station" required style="height:32px; padding:0 10px; width:100%; font-size:0.8rem;">
                ${Object.keys(state.config.stations).map(s => `<option value="${s}">${state.config.stations[s].name}</option>`).join("")}
              </select>
            </div>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 2fr; gap:0.75rem; align-items:start;">
            <div style="display:flex; flex-direction:column; gap:0.5rem;">
              <span class="form-label-xs" style="font-weight:600; color:var(--text-secondary);">Portion Configurations:</span>
              <div style="display:flex; flex-direction:column; gap:6px; padding:0.5rem; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.05); border-radius:8px;">
                <label style="font-size:0.8rem; display:inline-flex; align-items:center; gap:8px; cursor:pointer; font-weight:500;">
                  <input type="radio" name="gen-portion-type" value="half_full" checked style="cursor:pointer; accent-color:var(--accent-color); width:16px; height:16px;">
                  Half / Full Portion
                </label>
                <label style="font-size:0.8rem; display:inline-flex; align-items:center; gap:8px; cursor:pointer; font-weight:500;">
                  <input type="radio" name="gen-portion-type" value="single" style="cursor:pointer; accent-color:var(--accent-color); width:16px; height:16px;">
                  Single Piece / Portion
                </label>
              </div>
            </div>

            <div style="display:flex; flex-direction:column; gap:0.5rem;">
              <span class="form-label-xs" style="font-weight:600; color:var(--text-secondary);">Select Categories to Generate:</span>
              <div id="gen-category-checkboxes" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap:6px; padding:0.5rem; background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.05); border-radius:8px;">
                <label style="font-size:0.8rem; display:inline-flex; align-items:center; gap:8px; cursor:pointer; font-weight:500;">
                  <input type="checkbox" class="gen-cat-check" value="veg" checked style="accent-color:var(--accent-color); width:14px; height:14px;"> Veg (Plain)
                </label>
                <label style="font-size:0.8rem; display:inline-flex; align-items:center; gap:8px; cursor:pointer; font-weight:500;">
                  <input type="checkbox" class="gen-cat-check" value="egg" checked style="accent-color:var(--accent-color); width:14px; height:14px;"> Egg
                </label>
                <label style="font-size:0.8rem; display:inline-flex; align-items:center; gap:8px; cursor:pointer; font-weight:500;">
                  <input type="checkbox" class="gen-cat-check" value="double_egg" checked style="accent-color:var(--accent-color); width:14px; height:14px;"> Double Egg
                </label>
                <label style="font-size:0.8rem; display:inline-flex; align-items:center; gap:8px; cursor:pointer; font-weight:500;">
                  <input type="checkbox" class="gen-cat-check" value="chicken" checked style="accent-color:var(--accent-color); width:14px; height:14px;"> Chicken
                </label>
                <label style="font-size:0.8rem; display:inline-flex; align-items:center; gap:8px; cursor:pointer; font-weight:500;">
                  <input type="checkbox" class="gen-cat-check" value="paneer" checked style="accent-color:var(--accent-color); width:14px; height:14px;"> Paneer
                </label>
                <label style="font-size:0.8rem; display:inline-flex; align-items:center; gap:8px; cursor:pointer; font-weight:500;">
                  <input type="checkbox" class="gen-cat-check" value="egg_chicken" style="accent-color:var(--accent-color); width:14px; height:14px;"> Egg-Chicken
                </label>
                <label style="font-size:0.8rem; display:inline-flex; align-items:center; gap:8px; cursor:pointer; font-weight:500;">
                  <input type="checkbox" class="gen-cat-check" value="egg_paneer" style="accent-color:var(--accent-color); width:14px; height:14px;"> Egg-Paneer
                </label>
              </div>
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:0.5rem;">
            <span class="form-label-xs" style="font-weight:600; color:var(--text-secondary);">Interactive Pricing Table:</span>
            <div class="owner-table-wrapper" style="border:1px solid rgba(255,255,255,0.06); max-height:220px; overflow-y:auto; border-radius:8px; background:rgba(0,0,0,0.25);">
              <table class="owner-table" style="margin:0;">
                <thead>
                  <tr style="background:rgba(255,255,255,0.02);">
                    <th>Item Name</th>
                    <th>Category</th>
                    <th id="gen-price-th-1" style="width:130px; text-align:center;">Half Price (₹)</th>
                    <th id="gen-price-th-2" style="width:130px; text-align:center;">Full Price (₹)</th>
                  </tr>
                </thead>
                <tbody id="gen-pricing-rows">
                  <!-- Dynamically populated -->
                </tbody>
              </table>
            </div>
          </div>

          <button type="submit" class="pos-action-btn primary" style="padding:0 24px; margin:0; align-self:flex-start; height:32px; border-radius:6px; font-weight:600;">Generate Catalog Items</button>
        </form>
        `}
      </div>

      <!-- Menu Configurator Section -->
      <div class="glass-card" style="display:flex; flex-direction:column; gap:0.75rem; padding:1rem; margin-bottom:1.5rem;">
        <h4 class="modal-section-title" style="margin-bottom:0.25rem; font-size:1.1rem; font-weight:700; letter-spacing:-0.02em;">Menu Configurator</h4>
        <div class="categories-list-container">
          ${categorySectionsHTML}
        </div>
      </div>
    `;

    categories.forEach(cat => {
      const tbody = document.getElementById(`menu-rows-${cat.id}`);
      if (!tbody) return;

      const catItems = Object.values(state.config.menuItems)
        .filter(item => this.getItemCategory(item) === cat.id)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

      if (catItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="13" style="text-align:center; color:var(--text-muted); padding:1.5rem;">No items in this category.</td></tr>`;
        return;
      }

      tbody.innerHTML = catItems.map(item => {
        const imageUrl = item.image ? (item.image.startsWith('http') || item.image.startsWith('data:') ? item.image : `http://localhost:3001${item.image}`) : '';
        const hasHalfAndFull = item.variants && item.variants.half && item.variants.full;
        
        if (hasHalfAndFull) {
          const marginHalf = window.AutoBrixStore.calculateMenuItemMargin(item.id, 'half');
          const marginFull = window.AutoBrixStore.calculateMenuItemMargin(item.id, 'full');
          const availableHalf = window.AutoBrixStore.getMenuItemAvailableStock(item.id, 'half');
          const availableFull = window.AutoBrixStore.getMenuItemAvailableStock(item.id, 'full');
          
          const marginHalfClass = marginHalf.marginPct >= 40 ? "good" : "poor";
          const marginFullClass = marginFull.marginPct >= 40 ? "good" : "poor";
          
          return `
            <tr draggable="true" data-id="${item.id}" class="draggable-row">
              <td class="drag-handle" style="cursor: grab; text-align: center; color: var(--text-muted); font-size: 1.1rem; user-select: none; vertical-align: middle;">⠿</td>
              <td style="cursor: pointer; position: relative; text-align: center; vertical-align: middle;" onclick="ownerPanel.openImageActionsModal('${item.id}')" title="Click to manage image">
                <div style="position: relative; width: 40px; height: 40px; margin: 0 auto;">
                  ${item.image 
                    ? `<img src="${imageUrl}" style="width:40px; height:40px; border-radius:6px; object-fit:cover; border:1px solid rgba(255,255,255,0.08);">` 
                    : `<div style="width:40px; height:40px; border-radius:6px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:center; font-size:0.65rem; color:var(--text-muted); font-weight:600;">No Img</div>`}
                  <div class="food-type-indicator ${item.foodType || 'non-veg'}" style="position: absolute; top: -3px; right: -3px; z-index: 1;"></div>
                </div>
              </td>
              <td style="vertical-align: middle;"><strong>${item.name}</strong></td>
              <td style="vertical-align: middle;">
                <select class="pos-select-sm" onchange="ownerPanel.updateItemStation('${item.id}', this.value)" style="width:100%; height:28px; font-size:0.8rem; padding:0 6px;">
                  ${Object.keys(state.config.stations).map(s => `<option value="${s}" ${item.station === s ? "selected" : ""}>${state.config.stations[s].name}</option>`).join("")}
                </select>
              </td>
              <td style="vertical-align: middle; text-align:center;">
                <input type="number" class="owner-input-cell" value="${item.prepTime}" onchange="ownerPanel.updateItemPrepTime('${item.id}', this.value)" style="width:50px; text-align: center; height:28px; padding:2px;">
              </td>
              <td style="vertical-align: middle;"><span class="badge badge-normal" style="font-size:0.65rem; letter-spacing:0.02em; padding:2px 6px;">Half / Full</span></td>
              <td style="vertical-align: middle;">
                <div style="display:flex; flex-direction:column; gap:6px;">
                  <div class="variant-price-wrapper" style="display:flex; align-items:center; gap:6px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.05); padding:2px 6px; border-radius:4px;">
                    <span style="font-size:0.65rem; font-weight:700; color:var(--text-muted); width:10px;">H</span>
                    <input type="number" class="owner-input-cell" value="${item.variants.half.price}" onchange="ownerPanel.updateItemPrice('${item.id}', 'half', this.value)" style="width:45px; border:none; background:transparent; padding:0; text-align:center; font-family:var(--font-mono); font-size:0.8rem; outline:none; color:#fff;">
                  </div>
                  <div class="variant-price-wrapper" style="display:flex; align-items:center; gap:6px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.05); padding:2px 6px; border-radius:4px;">
                    <span style="font-size:0.65rem; font-weight:700; color:var(--text-muted); width:10px;">F</span>
                    <input type="number" class="owner-input-cell" value="${item.variants.full.price}" onchange="ownerPanel.updateItemPrice('${item.id}', 'full', this.value)" style="width:45px; border:none; background:transparent; padding:0; text-align:center; font-family:var(--font-mono); font-size:0.8rem; outline:none; color:#fff;">
                  </div>
                </div>
              </td>
              <td style="vertical-align: middle; text-align:right;">
                <div style="display:flex; flex-direction:column; gap:4px; font-family:var(--font-mono); font-size:0.8rem; line-height:1.2;">
                  <div><span style="color:var(--text-muted); font-size:0.65rem; padding-right:4px;">H:</span>₹${marginHalf.cost.toFixed(2)}</div>
                  <div><span style="color:var(--text-muted); font-size:0.65rem; padding-right:4px;">F:</span>₹${marginFull.cost.toFixed(2)}</div>
                </div>
              </td>
              <td style="vertical-align: middle; text-align:right;">
                <div style="display:flex; flex-direction:column; gap:4px; font-family:var(--font-mono); font-size:0.8rem; line-height:1.2; font-weight:600;">
                  <div style="color:var(--color-success);"><span style="color:var(--text-muted); font-size:0.65rem; font-weight:normal; padding-right:4px;">H:</span>₹${marginHalf.margin.toFixed(2)}</div>
                  <div style="color:var(--color-success);"><span style="color:var(--text-muted); font-size:0.65rem; font-weight:normal; padding-right:4px;">F:</span>₹${marginFull.margin.toFixed(2)}</div>
                </div>
              </td>
              <td style="vertical-align: middle; text-align:center;">
                <div style="display:flex; flex-direction:column; gap:6px; align-items:center;">
                  <span class="margin-badge ${marginHalfClass}" style="font-size:0.65rem; font-weight:700; width:45px; text-align:center; display:inline-block; padding:2px 0;">${marginHalf.marginPct}%</span>
                  <span class="margin-badge ${marginFullClass}" style="font-size:0.65rem; font-weight:700; width:45px; text-align:center; display:inline-block; padding:2px 0;">${marginFull.marginPct}%</span>
                </div>
              </td>
              <td style="vertical-align: middle; text-align:center;">
                <div style="display:flex; flex-direction:column; gap:6px; align-items:center;">
                  <span class="stock-badge ${availableHalf > 10 ? 'in-stock' : availableHalf > 0 ? 'low-stock' : 'no-stock'}" style="font-size:0.65rem; font-weight:700; padding:2px 6px; width:45px; text-align:center; display:inline-block;">
                    ${availableHalf}
                  </span>
                  <span class="stock-badge ${availableFull > 10 ? 'in-stock' : availableFull > 0 ? 'low-stock' : 'no-stock'}" style="font-size:0.65rem; font-weight:700; padding:2px 6px; width:45px; text-align:center; display:inline-block;">
                    ${availableFull}
                  </span>
                </div>
              </td>
              <td style="vertical-align: middle; text-align:center;">
                <input type="checkbox" ${item.active ? "checked" : ""} onchange="ownerPanel.toggleItemActive('${item.id}', this.checked)" style="width:16px; height:16px; accent-color:var(--accent-color); cursor:pointer;">
              </td>
              <td style="vertical-align: middle; text-align:center;">
                <button class="k-item-btn" onclick="ownerPanel.deleteMenuItem('${item.id}')" style="color:var(--color-critical); padding:4px 10px; margin:0; font-size:0.75rem; background:var(--color-critical-bg); border-color:rgba(239,68,68,0.2); border-radius:6px; font-weight:600;">Delete</button>
              </td>
            </tr>
          `;
        } else {
          return Object.entries(item.variants || {}).map(([vId, v]) => {
            const marginInfo = window.AutoBrixStore.calculateMenuItemMargin(item.id, vId);
            const availableSingle = window.AutoBrixStore.getMenuItemAvailableStock(item.id, vId);
            
            let marginClass = "good";
            if (marginInfo.marginPct < 40) marginClass = "poor";
            
            return `
              <tr draggable="true" data-id="${item.id}" class="draggable-row">
                <td class="drag-handle" style="cursor: grab; text-align: center; color: var(--text-muted); font-size: 1.1rem; user-select: none; vertical-align: middle;">⠿</td>
                <td style="cursor: pointer; position: relative; text-align: center; vertical-align: middle;" onclick="ownerPanel.openImageActionsModal('${item.id}')" title="Click to manage image">
                  <div style="position: relative; width: 40px; height: 40px; margin: 0 auto;">
                    ${item.image 
                      ? `<img src="${imageUrl}" style="width:40px; height:40px; border-radius:6px; object-fit:cover; border:1px solid rgba(255,255,255,0.08);">` 
                      : `<div style="width:40px; height:40px; border-radius:6px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:center; font-size:0.65rem; color:var(--text-muted); font-weight:600;">No Img</div>`}
                    <div class="food-type-indicator ${item.foodType || 'non-veg'}" style="position: absolute; top: -3px; right: -3px; z-index: 1;"></div>
                  </div>
                </td>
                <td style="vertical-align: middle;"><strong>${item.name}</strong></td>
                <td style="vertical-align: middle;">
                  <select class="pos-select-sm" onchange="ownerPanel.updateItemStation('${item.id}', this.value)" style="width:100%; height:28px; font-size:0.8rem; padding:0 6px;">
                    ${Object.keys(state.config.stations).map(s => `<option value="${s}" ${item.station === s ? "selected" : ""}>${state.config.stations[s].name}</option>`).join("")}
                  </select>
                </td>
                <td style="vertical-align: middle; text-align:center;">
                  <input type="number" class="owner-input-cell" value="${item.prepTime}" onchange="ownerPanel.updateItemPrepTime('${item.id}', this.value)" style="width:50px; padding:2px; text-align: center; height:28px;">
                </td>
                <td style="vertical-align: middle;"><span class="badge badge-normal" style="font-size:0.65rem; padding:2px 6px; text-transform: capitalize;">${v.name || vId}</span></td>
                <td style="vertical-align: middle;">
                  <div class="variant-price-wrapper" style="display:flex; align-items:center; gap:6px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.05); padding:2px 6px; border-radius:4px;">
                    <input type="number" class="owner-input-cell" value="${v.price}" onchange="ownerPanel.updateItemPrice('${item.id}', '${vId}', this.value)" style="width:60px; border:none; background:transparent; padding:0; text-align:center; font-family:var(--font-mono); font-size:0.8rem; outline:none; color:#fff;">
                  </div>
                </td>
                <td style="vertical-align: middle; text-align:right; font-family:var(--font-mono); font-size:0.8rem; color:var(--text-secondary);">₹${marginInfo.cost.toFixed(2)}</td>
                <td style="vertical-align: middle; text-align:right; font-family:var(--font-mono); font-size:0.8rem; color:var(--color-success); font-weight:600;">₹${marginInfo.margin.toFixed(2)}</td>
                <td style="vertical-align: middle; text-align:center;">
                  <span class="margin-badge ${marginClass}" style="font-size:0.65rem; font-weight:700; width:45px; text-align:center; display:inline-block; padding:2px 0;">${marginInfo.marginPct}%</span>
                </td>
                <td style="vertical-align: middle; text-align:center;">
                  <span class="stock-badge ${availableSingle > 10 ? 'in-stock' : availableSingle > 0 ? 'low-stock' : 'no-stock'}" style="font-size:0.65rem; font-weight:700; padding:2px 6px; width:45px; text-align:center; display:inline-block;">
                    ${availableSingle}
                  </span>
                </td>
                <td style="vertical-align: middle; text-align:center;">
                  <input type="checkbox" ${item.active ? "checked" : ""} onchange="ownerPanel.toggleItemActive('${item.id}', this.checked)" style="width:16px; height:16px; accent-color:var(--accent-color); cursor:pointer;">
                </td>
                <td style="vertical-align: middle; text-align:center;">
                  <button class="k-item-btn" onclick="ownerPanel.deleteMenuItem('${item.id}')" style="color:var(--color-critical); padding:4px 10px; margin:0; font-size:0.75rem; background:var(--color-critical-bg); border-color:rgba(239,68,68,0.2); border-radius:6px; font-weight:600;">Delete</button>
                </td>
              </tr>
            `;
          }).join("");
        }
      }).join("");
    });

    this.bindMenuDragAndDrop();

    // Sub-tab switcher listeners
    const btnSingle = document.getElementById("btn-tab-single-item");
    const btnGen = document.getElementById("btn-tab-smart-generator");
    const btnBev = document.getElementById("btn-tab-beverage-creator");

    if (btnSingle) {
      btnSingle.addEventListener("click", () => {
        this.menuFormTab = "single";
        this.updateActiveTabContent();
      });
    }

    if (btnGen) {
      btnGen.addEventListener("click", () => {
        this.menuFormTab = "generator";
        this.updateActiveTabContent();
        // Trigger initial pricing table update
        setTimeout(() => this.updateGenPricingGrid(), 20);
      });
    }

    if (btnBev) {
      btnBev.addEventListener("click", () => {
        this.menuFormTab = "beverage";
        this.updateActiveTabContent();
        setTimeout(() => this.updateBevPricingGrid(), 20);
      });
    }

    // Single Form Listener
    const singleForm = document.getElementById("menu-add-form");
    if (singleForm) {
      singleForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("menu-add-name").value.trim();
        const prepTime = parseInt(document.getElementById("menu-add-preptime").value) || 3;
        const stationId = document.getElementById("menu-add-station").value;
        const variantName = document.getElementById("menu-add-variant").value.trim() || "Single";
        const foodType = document.getElementById("menu-add-foodtype").value;
        const price = parseFloat(document.getElementById("menu-add-price").value) || 0;
        const imageFile = document.getElementById("menu-add-image").files[0];

        if (!name) return;
        const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

        // Check if variant already exists
        const existingItem = state.config.menuItems[id];
        if (existingItem && existingItem.variants && existingItem.variants[variantName.toLowerCase()]) {
          alert(`The variant "${variantName}" already exists for "${existingItem.name}". You can update its price directly in the configurator table.`);
          return;
        }

        if (window.AlokaAPI.isOnline()) {
          try {
            // If the item doesn't exist, create it first
            if (!existingItem) {
              const formData = new FormData();
              formData.append("id", id);
              formData.append("name", name);
              formData.append("station_id", stationId);
              formData.append("prep_time", prepTime);
              formData.append("active", "1");
              formData.append("food_type", foodType);
              if (imageFile) {
                formData.append("image", imageFile);
              }

              await window.AlokaAPI.postForm('/menu', formData);
            }

            // Add/Insert the variant record
            await window.AlokaAPI.post(`/menu/${id}/variants`, {
              variantId: `${id}_${variantName.toLowerCase()}`,
              name: variantName,
              price: price,
              recipe_multiplier: 1.0
            });

            await window.AlokaAPI.loadAllState();
            alert(existingItem ? `Added variant "${variantName}" to "${existingItem.name}"!` : "Menu item added successfully!");
          } catch (err) {
            alert("Error adding menu item: " + err.message);
          }
        } else {
          if (existingItem) {
            window.AutoBrixStore.updateState(s => {
              const it = s.config.menuItems[id];
              if (it) {
                it.variants[variantName.toLowerCase()] = {
                  id: `${id}_${variantName.toLowerCase()}`,
                  name: variantName,
                  price: price,
                  recipeMultiplier: 1.0
                };
              }
            });
          } else {
            const itemData = {
              id,
              name,
              station: stationId,
              prepTime,
              image: null,
              foodType: foodType,
              variants: {
                [variantName.toLowerCase()]: { id: `${id}_${variantName.toLowerCase()}`, name: variantName, price, recipeMultiplier: 1.0 }
              },
              recipe: {}
            };
            window.AutoBrixStore.addMenuItem(itemData);
          }
        }
        this.updateActiveTabContent();
      });
    }

    // Generator Form Listener
    const genForm = document.getElementById("menu-generator-form");
    if (genForm) {
      const fillChowmein = document.getElementById("btn-fill-chowmein");
      const fillRoll = document.getElementById("btn-fill-roll");
      const fillPasta = document.getElementById("btn-fill-pasta");
      const baseInput = document.getElementById("gen-base-name");

      const triggerInputEvent = () => {
        baseInput.dispatchEvent(new Event("input"));
      };

      if (fillChowmein) fillChowmein.addEventListener("click", () => { baseInput.value = "Chowmein"; triggerInputEvent(); });
      if (fillRoll) fillRoll.addEventListener("click", () => { baseInput.value = "Roll"; triggerInputEvent(); });
      if (fillPasta) fillPasta.addEventListener("click", () => { baseInput.value = "Pasta"; triggerInputEvent(); });

      baseInput.addEventListener("input", () => this.updateGenPricingGrid());
      
      genForm.querySelectorAll("input[name='gen-portion-type']").forEach(radio => {
        radio.addEventListener("change", () => this.updateGenPricingGrid());
      });

      genForm.querySelectorAll(".gen-cat-check").forEach(cb => {
        cb.addEventListener("change", () => this.updateGenPricingGrid());
      });

      genForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleBulkGeneration();
      });

      this.updateGenPricingGrid();
    }

    // Beverage Form Listener
    const bevForm = document.getElementById("menu-beverage-form");
    if (bevForm) {
      const brandSelect = document.getElementById("bev-brand");
      const supplierInput = document.getElementById("bev-default-supplier");

      if (brandSelect) {
        brandSelect.addEventListener("change", () => {
          if (brandSelect.value === "water") {
            supplierInput.value = "Kinley/Bisleri Distributor";
          } else {
            supplierInput.value = "Pepsi Co.";
          }
          this.updateBevPricingGrid();
        });
      }

      if (supplierInput) {
        supplierInput.addEventListener("input", () => this.updateBevPricingGrid());
      }

      bevForm.querySelectorAll(".bev-container-check").forEach(cb => {
        cb.addEventListener("change", () => this.updateBevPricingGrid());
      });

      bevForm.querySelectorAll(".bev-size-check").forEach(cb => {
        cb.addEventListener("change", () => this.updateBevPricingGrid());
      });

      bevForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleBeverageGeneration();
      });

      this.updateBevPricingGrid();
    }
  }

  async updateItemStation(itemId, station) {
    if (window.AlokaAPI.isOnline()) {
      try {
        await window.AlokaAPI.patch(`/menu/${itemId}`, { station_id: station });
        await window.AlokaAPI.loadAllState();
      } catch (err) { alert(err.message); }
    } else {
      window.AutoBrixStore.updateState(state => {
        const item = state.config.menuItems[itemId];
        if (item) {
          item.station = station;
          window.AutoBrixStore.logAudit("Menu Edit", `Assigned ${item.name} station: ${station}`);
        }
      });
    }
  }

  async updateItemPrepTime(itemId, prepTime) {
    if (window.AlokaAPI.isOnline()) {
      try {
        await window.AlokaAPI.patch(`/menu/${itemId}`, { prep_time: parseInt(prepTime) });
        await window.AlokaAPI.loadAllState();
      } catch (err) { alert(err.message); }
    } else {
      window.AutoBrixStore.updateState(state => {
        const item = state.config.menuItems[itemId];
        if (item) {
          item.prepTime = parseInt(prepTime);
          window.AutoBrixStore.logAudit("Menu Edit", `Changed ${item.name} prep time to ${prepTime}m`);
        }
      });
    }
  }

  async updateItemPrice(itemId, variantId, price) {
    if (window.AlokaAPI.isOnline()) {
      try {
        const dbVariantId = `${itemId}_${variantId.toLowerCase()}`;
        await window.AlokaAPI.patch(`/menu/${itemId}/variants/${dbVariantId}`, { price: parseFloat(price) });
        await window.AlokaAPI.loadAllState();
      } catch (err) { alert(err.message); }
    } else {
      window.AutoBrixStore.updateMenuItemPrice(itemId, variantId, price);
    }
  }

  async toggleItemActive(itemId, active) {
    if (window.AlokaAPI.isOnline()) {
      try {
        await window.AlokaAPI.patch(`/menu/${itemId}`, { active: active });
        await window.AlokaAPI.loadAllState();
      } catch (err) { alert(err.message); }
    } else {
      window.AutoBrixStore.updateState(state => {
        const item = state.config.menuItems[itemId];
        if (item) {
          item.active = active;
          window.AutoBrixStore.logAudit("Menu Edit", `Set active status for ${item.name} to ${active}`);
        }
      });
    }
  }

  async deleteMenuItem(itemId) {
    const state = window.AutoBrixStore.state;
    const item = state.config.menuItems[itemId];
    if (!item) return;

    if (confirm(`Are you sure you want to delete "${item.name}"? This will permanently remove the item, all its variants, and its recipe from the catalog!`)) {
      if (window.AlokaAPI.isOnline()) {
        try {
          await window.AlokaAPI.del(`/menu/${itemId}`);
          await window.AlokaAPI.loadAllState();
        } catch (err) {
          alert("Error deleting menu item: " + err.message);
        }
      } else {
        window.AutoBrixStore.removeMenuItem(itemId);
      }
      this.updateActiveTabContent();
    }
  }

  updateGenPricingGrid() {
    const baseInput = document.getElementById("gen-base-name");
    const gridContainer = document.getElementById("gen-pricing-rows");
    if (!baseInput || !gridContainer) return;

    const baseName = baseInput.value.trim() || "[Base]";
    const portionType = this.container.querySelector("input[name='gen-portion-type']:checked")?.value || "half_full";

    const th1 = document.getElementById("gen-price-th-1");
    const th2 = document.getElementById("gen-price-th-2");

    if (portionType === "single") {
      if (th1) th1.textContent = "Price (₹)";
      if (th2) th2.style.display = "none";
    } else {
      if (th1) th1.textContent = "Half Price (₹)";
      if (th2) th2.style.display = "";
      if (th2) th2.textContent = "Full Price (₹)";
    }

    const categories = Array.from(this.container.querySelectorAll(".gen-cat-check:checked")).map(cb => cb.value);

    const catLabels = {
      veg: "Veg",
      egg: "Egg",
      double_egg: "Double Egg",
      chicken: "Chicken",
      paneer: "Paneer",
      egg_chicken: "Egg Chicken",
      egg_paneer: "Egg Paneer"
    };

    gridContainer.innerHTML = categories.map(cat => {
      const label = catLabels[cat] || cat;
      const itemName = `${label} ${baseName}`;

      return `
        <tr data-cat="${cat}">
          <td><strong>${itemName}</strong></td>
          <td><span class="badge badge-normal" style="font-size:0.7rem;">${label}</span></td>
          <td style="text-align:center;">
            <input type="text" class="owner-input-cell gen-price-input-1" placeholder="Price" style="width:80px; text-align:center;" required>
          </td>
          ${portionType === "half_full" ? `
          <td style="text-align:center;">
            <input type="text" class="owner-input-cell gen-price-input-2" placeholder="Price" style="width:80px; text-align:center;" required>
          </td>
          ` : ""}
        </tr>
      `;
    }).join("");
  }

  async handleBulkGeneration() {
    const state = window.AutoBrixStore.state;
    const baseInput = document.getElementById("gen-base-name");
    if (!baseInput) return;

    const baseName = baseInput.value.trim();
    if (!baseName) return;

    const portionType = this.container.querySelector("input[name='gen-portion-type']:checked")?.value || "half_full";
    const stationId = document.getElementById("gen-station").value;
    const prepTime = parseInt(document.getElementById("gen-preptime").value) || 3;

    const rows = Array.from(document.querySelectorAll("#gen-pricing-rows tr"));
    if (!rows.length) {
      alert("Please select at least one category to generate items!");
      return;
    }

    const itemsToCreate = [];

    const catLabels = {
      veg: "Veg",
      egg: "Egg",
      double_egg: "Double Egg",
      chicken: "Chicken",
      paneer: "Paneer",
      egg_chicken: "Egg Chicken",
      egg_paneer: "Egg Paneer"
    };

    const getFoodType = (cat) => {
      if (cat === 'veg') return 'veg';
      if (cat === 'egg' || cat === 'double_egg') return 'egg';
      if (cat === 'paneer' || cat === 'egg_paneer') return 'veg';
      return 'non-veg';
    };

    const getDefaultRecipe = (baseName, cat) => {
      const base = baseName.toLowerCase();
      const recipe = {};
      
      if (base.includes("chowmein")) {
        recipe.chowmein_base = 1.0;
        recipe.onion = 20.0;
        recipe.capsicum = 20.0;
        recipe.sauce = 10.0;
      } else if (base.includes("pasta")) {
        recipe.pasta_base = 1.0;
        recipe.onion = 10.0;
        recipe.capsicum = 10.0;
        recipe.sauce = 10.0;
      } else if (base.includes("roll")) {
        recipe.paratha_base = 1.0;
        recipe.onion = 20.0;
        recipe.sauce = 10.0;
      } else {
        return {};
      }
      
      if (cat === "egg") {
        recipe.egg = 1.0;
      } else if (cat === "double_egg") {
        recipe.egg = 2.0;
      } else if (cat === "chicken") {
        recipe.chicken_keema = base.includes("roll") ? 80.0 : 60.0;
      } else if (cat === "paneer") {
        recipe.paneer_keema = base.includes("roll") ? 80.0 : 60.0;
      } else if (cat === "egg_chicken") {
        recipe.egg = 1.0;
        recipe.chicken_keema = base.includes("roll") ? 80.0 : 60.0;
      } else if (cat === "egg_paneer") {
        recipe.egg = 1.0;
        recipe.paneer_keema = base.includes("roll") ? 80.0 : 60.0;
      }
      
      return recipe;
    };

    for (const row of rows) {
      const cat = row.dataset.cat;
      const label = catLabels[cat] || cat;
      const name = `${label} ${baseName}`;
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

      const price1 = parseFloat(row.querySelector(".gen-price-input-1").value) || 0;
      const price2 = portionType === "half_full" ? (parseFloat(row.querySelector(".gen-price-input-2").value) || 0) : null;

      // Check if variant already exists
      const existing = state.config.menuItems[id];
      if (existing) {
        if (portionType === "half_full") {
          if (existing.variants.half || existing.variants.full) {
            if (!confirm(`Item "${name}" already exists. Overwrite pricing variants?`)) continue;
          }
        } else {
          if (existing.variants.single) {
            if (!confirm(`Item "${name}" already exists with Single variant. Overwrite pricing?`)) continue;
          }
        }
      }

      itemsToCreate.push({ id, name, cat, foodType: getFoodType(cat), price1, price2, existing: !!existing });
    }

    if (window.AlokaAPI.isOnline()) {
      try {
        for (const item of itemsToCreate) {
          if (!item.existing) {
            const formData = new FormData();
            formData.append("id", item.id);
            formData.append("name", item.name);
            formData.append("station_id", stationId);
            formData.append("prep_time", prepTime);
            formData.append("active", "1");
            formData.append("food_type", item.foodType);

            await window.AlokaAPI.postForm('/menu', formData);
          }

          if (portionType === "half_full") {
            const variantIdHalf = `${item.id}_half`;
            if (item.existing) {
              try {
                await window.AlokaAPI.patch(`/menu/${item.id}/variants/${variantIdHalf}`, { price: item.price1 });
              } catch {
                await window.AlokaAPI.post(`/menu/${item.id}/variants`, {
                  variantId: variantIdHalf, name: "Half", price: item.price1, recipe_multiplier: 1.0
                });
              }
            } else {
              await window.AlokaAPI.post(`/menu/${item.id}/variants`, {
                variantId: variantIdHalf, name: "Half", price: item.price1, recipe_multiplier: 1.0
              });
            }

            const variantIdFull = `${item.id}_full`;
            if (item.existing) {
              try {
                await window.AlokaAPI.patch(`/menu/${item.id}/variants/${variantIdFull}`, { price: item.price2 });
              } catch {
                await window.AlokaAPI.post(`/menu/${item.id}/variants`, {
                  variantId: variantIdFull, name: "Full", price: item.price2, recipe_multiplier: 1.8
                });
              }
            } else {
              await window.AlokaAPI.post(`/menu/${item.id}/variants`, {
                variantId: variantIdFull, name: "Full", price: item.price2, recipe_multiplier: 1.8
              });
            }
          } else {
            const variantIdSingle = `${item.id}_single`;
            if (item.existing) {
              try {
                await window.AlokaAPI.patch(`/menu/${item.id}/variants/${variantIdSingle}`, { price: item.price1 });
              } catch {
                await window.AlokaAPI.post(`/menu/${item.id}/variants`, {
                  variantId: variantIdSingle, name: "Single", price: item.price1, recipe_multiplier: 1.0
                });
              }
            } else {
              await window.AlokaAPI.post(`/menu/${item.id}/variants`, {
                variantId: variantIdSingle, name: "Single", price: item.price1, recipe_multiplier: 1.0
              });
            }
          }

          if (!item.existing) {
            // Seed default recipe for the generated menu item online
            const recipe = getDefaultRecipe(baseName, item.cat);
            for (const [ingId, qty] of Object.entries(recipe)) {
              const ingType = ['paratha_base', 'mughlai_dough', 'chowmein_base', 'pasta_base'].includes(ingId) ? 'prepared' : 'raw';
              const unit = ['chowmein_base', 'pasta_base'].includes(ingId) ? 'portions' : (ingId === 'egg' || ingId === 'paratha_base' ? 'pcs' : 'g');
              try {
                await window.AlokaAPI.put(`/menu/${item.id}/recipe/${ingId}`, {
                  quantity: qty,
                  ingredient_type: ingType,
                  unit: unit
                });
              } catch (err) {
                console.warn(`Failed to seed recipe ingredient ${ingId} for ${item.id}:`, err);
              }
            }
          }
        }

        await window.AlokaAPI.loadAllState();
        alert(`Successfully generated/updated ${itemsToCreate.length} catalog item(s)!`);
      } catch (err) {
        alert("Error during bulk generation: " + err.message);
      }
    } else {
      window.AutoBrixStore.updateState(s => {
        itemsToCreate.forEach(item => {
          const variantsObj = {};
          if (portionType === "half_full") {
            variantsObj.half = { id: `${item.id}_half`, name: "Half", price: item.price1, recipeMultiplier: 1.0 };
            variantsObj.full = { id: `${item.id}_full`, name: "Full", price: item.price2, recipeMultiplier: 1.8 };
          } else {
            variantsObj.single = { id: `${item.id}_single`, name: "Single", price: item.price1, recipeMultiplier: 1.0 };
          }

          s.config.menuItems[item.id] = {
            id: item.id,
            name: item.name,
            station: stationId,
            prepTime: prepTime,
            active: true,
            image: null,
            foodType: item.foodType,
            sortOrder: Object.keys(s.config.menuItems).length + 1,
            variants: variantsObj,
            recipe: getDefaultRecipe(baseName, item.cat)
          };
        });
      });
      window.AutoBrixStore.logAudit("Config Change", `Bulk generated ${itemsToCreate.length} item(s)`);
      alert(`Locally generated ${itemsToCreate.length} catalog item(s)!`);
    }

    this.menuFormTab = "single";
    this.updateActiveTabContent();
  }

  updateBevPricingGrid() {
    const brandSelect = document.getElementById("bev-brand");
    const gridContainer = document.getElementById("bev-pricing-rows");
    const defaultSupplierInput = document.getElementById("bev-default-supplier");
    if (!brandSelect || !gridContainer) return;

    const brandVal = brandSelect.value;
    const brandName = brandSelect.options[brandSelect.selectedIndex].text;
    const defaultSupplier = defaultSupplierInput ? defaultSupplierInput.value.trim() : "Pepsi Co.";

    const containers = Array.from(this.container.querySelectorAll(".bev-container-check:checked")).map(cb => cb.value);
    const sizes = Array.from(this.container.querySelectorAll(".bev-size-check:checked")).map(cb => cb.value);

    const containerLabels = {
      plastic: "Plastic Bottle",
      glass: "Glass Bottle",
      can: "Can"
    };

    const combinations = [];
    containers.forEach(container => {
      sizes.forEach(size => {
        combinations.push({ container, size });
      });
    });

    if (combinations.length === 0) {
      gridContainer.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:1rem;">Select at least one container type and size.</td></tr>`;
      return;
    }

    gridContainer.innerHTML = combinations.map(comb => {
      const containerLabel = containerLabels[comb.container] || comb.container;
      const variantName = `${comb.size} ${containerLabel}`;
      const itemName = `${brandName} ${variantName}`;
      
      let defaultSalePrice = 40;
      let defaultCost = 30;
      if (comb.size === "250ml") { defaultSalePrice = 20; defaultCost = 15; }
      else if (comb.size === "300ml") { defaultSalePrice = 25; defaultCost = 19; }
      else if (comb.size === "750ml") { defaultSalePrice = 60; defaultCost = 45; }
      else if (comb.size === "1L") { defaultSalePrice = 80; defaultCost = 60; }
      else if (comb.size === "2L") { defaultSalePrice = 120; defaultCost = 90; }

      if (brandVal === "water") {
        if (comb.size === "250ml") { defaultSalePrice = 10; defaultCost = 7; }
        else if (comb.size === "500ml") { defaultSalePrice = 15; defaultCost = 10; }
        else if (comb.size === "1L") { defaultSalePrice = 20; defaultCost = 14; }
        else if (comb.size === "2L") { defaultSalePrice = 35; defaultCost = 25; }
      }

      return `
        <tr data-container="${comb.container}" data-size="${comb.size}">
          <td><strong>${itemName}</strong></td>
          <td style="text-align:center;">
            <input type="number" class="owner-input-cell bev-price-input" value="${defaultSalePrice}" style="width:80px; text-align:center;" required min="0">
          </td>
          <td style="text-align:center;">
            <input type="number" class="owner-input-cell bev-cost-input" value="${defaultCost}" style="width:80px; text-align:center;" required min="0">
          </td>
          <td style="text-align:center;">
            <input type="number" class="owner-input-cell bev-stock-input" value="48" style="width:70px; text-align:center;" required min="0">
          </td>
          <td style="text-align:center;">
            <input type="number" class="owner-input-cell bev-minstock-input" value="12" style="width:70px; text-align:center;" required min="0">
          </td>
          <td style="text-align:center;">
            <input type="text" class="owner-input-cell bev-supplier-input" value="${defaultSupplier}" style="width:130px; text-align:center;" required>
          </td>
        </tr>
      `;
    }).join("");
  }

  async handleBeverageGeneration() {
    const state = window.AutoBrixStore.state;
    const brandSelect = document.getElementById("bev-brand");
    if (!brandSelect) return;

    const brandVal = brandSelect.value;
    const brandName = brandSelect.options[brandSelect.selectedIndex].text;

    const menuItemId = brandVal;
    const menuItemName = brandVal === 'water' ? 'Water Bottle' : brandName;

    const rows = Array.from(document.querySelectorAll("#bev-pricing-rows tr"));
    if (!rows.length || rows[0].innerText.includes("Select at least one")) {
      alert("Please select container type(s) and size(s) first!");
      return;
    }

    const itemsToCreate = [];
    const containerLabels = {
      plastic: "Plastic Bottle",
      glass: "Glass Bottle",
      can: "Can"
    };

    for (const row of rows) {
      const container = row.dataset.container;
      const size = row.dataset.size;
      const containerLabel = containerLabels[container] || container;
      const variantName = `${size} ${containerLabel}`;
      const name = `${menuItemName} ${variantName}`;
      
      const salePrice = parseFloat(row.querySelector(".bev-price-input").value) || 0;
      const purchaseCost = parseFloat(row.querySelector(".bev-cost-input").value) || 0;
      const stock = parseFloat(row.querySelector(".bev-stock-input").value) || 0;
      const minStock = parseFloat(row.querySelector(".bev-minstock-input").value) || 0;
      const supplier = row.querySelector(".bev-supplier-input").value.trim() || "Pepsi Distributor";

      const variantId = `${size.toLowerCase()}_${container.toLowerCase()}`;
      const rawId = `${menuItemId}_${variantId}`;

      itemsToCreate.push({
        variantId,
        variantName,
        rawId,
        name,
        salePrice,
        purchaseCost,
        stock,
        minStock,
        supplier
      });
    }

    if (window.AlokaAPI.isOnline()) {
      try {
        const existingItem = state.config.menuItems[menuItemId];
        if (!existingItem) {
          const formData = new FormData();
          formData.append("id", menuItemId);
          formData.append("name", menuItemName);
          formData.append("station_id", "reception");
          formData.append("prep_time", "1");
          formData.append("active", "1");
          await window.AlokaAPI.postForm('/menu', formData);

          await window.AlokaAPI.patch(`/menu/${menuItemId}`, { food_type: 'veg' });
        }

        for (const item of itemsToCreate) {
          const existingRaw = state.inventory.raw[item.rawId];
          if (existingRaw) {
            await window.AlokaAPI.patch(`/inventory/raw/${item.rawId}`, {
              cost_per_purchase_unit: item.purchaseCost,
              stock: item.stock,
              min_stock: item.minStock,
              supplier: item.supplier
            });
          } else {
            await window.AlokaAPI.post('/inventory/raw', {
              id: item.rawId,
              name: item.name,
              stock: item.stock,
              min_stock: item.minStock,
              purchase_unit: 'pcs',
              stock_unit: 'pcs',
              conversion_factor: 1.0,
              cost_per_purchase_unit: item.purchaseCost,
              supplier: item.supplier
            });
          }

          const dbVariantId = `${menuItemId}_${item.variantId}`;
          if (existingItem && existingItem.variants[item.variantId]) {
            await window.AlokaAPI.patch(`/menu/${menuItemId}/variants/${dbVariantId}`, {
              price: item.salePrice
            });
          } else {
            await window.AlokaAPI.post(`/menu/${menuItemId}/variants`, {
              variantId: dbVariantId,
              name: item.variantName,
              price: item.salePrice,
              recipe_multiplier: 1.0
            });
          }

          await window.AlokaAPI.put(`/menu/${menuItemId}/recipe/${item.rawId}`, {
            quantity: 1.0,
            ingredient_type: 'raw',
            unit: 'pcs'
          });
        }

        await window.AlokaAPI.loadAllState();
        alert(`Successfully created/updated ${itemsToCreate.length} beverage variant(s) online!`);
      } catch (err) {
        alert("Error creating beverages: " + err.message);
      }
    } else {
      window.AutoBrixStore.updateState(s => {
        let existingItem = s.config.menuItems[menuItemId];
        if (!existingItem) {
          s.config.menuItems[menuItemId] = {
            id: menuItemId,
            name: menuItemName,
            station: 'reception',
            prepTime: 1,
            active: true,
            image: null,
            foodType: 'veg',
            sortOrder: Object.keys(s.config.menuItems).length + 1,
            variants: {},
            recipe: {}
          };
          existingItem = s.config.menuItems[menuItemId];
        }

        itemsToCreate.forEach(item => {
          existingItem.variants[item.variantId] = {
            id: `${menuItemId}_${item.variantId}`,
            name: item.variantName,
            price: item.salePrice,
            recipeMultiplier: 1.0
          };

          s.inventory.raw[item.rawId] = {
            name: item.name,
            stock: item.stock,
            reserved: 0,
            minStock: item.minStock,
            purchaseUnit: 'pcs',
            stockUnit: 'pcs',
            conversionFactor: 1.0,
            costPerPurchaseUnit: item.purchaseCost,
            supplier: item.supplier
          };

          existingItem.recipe[item.rawId] = 1.0;
        });
      });
      window.AutoBrixStore.logAudit("Config Change", `Bulk generated ${itemsToCreate.length} beverage(s)`);
      alert(`Locally created ${itemsToCreate.length} beverage variant(s)!`);
    }

    this.menuFormTab = "single";
    this.updateActiveTabContent();
  }

  openImageActionsModal(itemId) {
    const state = window.AutoBrixStore.state;
    const item = state.config.menuItems[itemId];
    if (!item) return;

    const existing = document.getElementById("image-actions-modal-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "image-actions-modal-overlay";
    overlay.className = "modal-overlay";
    overlay.style.zIndex = "10000";

    const imageUrl = item.image ? (item.image.startsWith('http') || item.image.startsWith('data:') ? item.image : `http://localhost:3001${item.image}`) : '';

    overlay.innerHTML = `
      <div class="modal-container" style="max-width: 420px; padding: 0; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--border-radius-md); box-shadow: var(--shadow-lg);">
        <div class="modal-header" style="padding: 1rem 1.25rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <h3 class="modal-title" style="font-size: 1.1rem; font-weight: 600; color: var(--text-primary);">Image Actions: ${item.name}</h3>
          <button class="modal-close-btn" id="btn-close-img-modal" style="background: none; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer;">&times;</button>
        </div>
        <div class="modal-body" style="padding: 1.25rem; display: flex; flex-direction: column; gap: 1.25rem; align-items: center;">
          <!-- Food Type selection -->
          <div style="width: 100%; display: flex; flex-direction: column; gap: 0.25rem; align-self: stretch;">
            <label class="form-label-xs" style="color: var(--text-secondary); font-weight: 600;">Food Category</label>
            <select class="pos-select-sm" id="modal-foodtype-select" style="width: 100%;">
              <option value="non-veg" ${item.foodType === 'non-veg' ? 'selected' : ''}>Non-Veg (Red Circle)</option>
              <option value="veg" ${item.foodType === 'veg' ? 'selected' : ''}>Veg (Green Circle)</option>
              <option value="egg" ${item.foodType === 'egg' ? 'selected' : ''}>Egg (Yellow Circle)</option>
            </select>
          </div>

          <!-- Options selection view -->
          <div id="img-modal-options" style="width: 100%; display: flex; flex-direction: column; gap: 0.75rem;">
            <button class="pos-action-btn secondary" id="btn-modal-view-img" style="width: 100%; padding: 0.85rem; font-size: 0.9rem; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
              View Image
            </button>
            <button class="pos-action-btn primary" id="btn-modal-upload-img" style="width: 100%; padding: 0.85rem; font-size: 0.9rem; display: flex; align-items: center; justify-content: center; gap: 8px; margin: 0; grid-column: span 2;">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1m-4-8-4-4m0 0L8 8m4-4v12"/></svg>
              ${item.image ? "Update Image" : "Upload Image"}
            </button>
          </div>

          <!-- Large Preview Container -->
          <div id="img-modal-preview" style="display: none; width: 100%; flex-direction: column; align-items: center; gap: 0.75rem;">
            ${item.image 
              ? `<img src="${imageUrl}" style="width:100%; max-height:240px; border-radius:6px; object-fit:cover; border:1px solid rgba(255,255,255,0.1); shadow: var(--shadow-md);">` 
              : `<div style="width:100%; height:200px; border-radius:6px; background:rgba(255,255,255,0.03); border:1px dashed var(--border-color); display:flex; flex-direction:column; align-items:center; justify-content:center; gap: 8px; color:var(--text-muted);">
                  <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 0 1 2.828 0L16 16m-2-2l1.586-1.586a2 2 0 0 1 2.828 0L20 14m-6-6h.01M6 20h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z"/></svg>
                  <span>No Image Available</span>
                 </div>`}
            <button class="pos-action-btn secondary" id="btn-modal-back-to-options" style="width: 100%; padding: 0.5rem; font-size: 0.8rem;">Back</button>
          </div>

          <!-- Hidden File Input -->
          <input type="file" id="modal-img-input" accept="image/*" style="display: none;">
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const btnClose = overlay.querySelector("#btn-close-img-modal");
    const btnView = overlay.querySelector("#btn-modal-view-img");
    const btnUpload = overlay.querySelector("#btn-modal-upload-img");
    const btnBack = overlay.querySelector("#btn-modal-back-to-options");
    const optionsView = overlay.querySelector("#img-modal-options");
    const previewView = overlay.querySelector("#img-modal-preview");
    const fileInput = overlay.querySelector("#modal-img-input");
    const foodTypeSelect = overlay.querySelector("#modal-foodtype-select");

    const closeModal = () => overlay.remove();
    btnClose.addEventListener("click", closeModal);

    btnView.addEventListener("click", () => {
      optionsView.style.display = "none";
      previewView.style.display = "flex";
    });

    btnBack.addEventListener("click", () => {
      previewView.style.display = "none";
      optionsView.style.display = "flex";
    });

    btnUpload.addEventListener("click", () => {
      fileInput.click();
    });

    foodTypeSelect.addEventListener("change", async () => {
      const newFoodType = foodTypeSelect.value;
      if (window.AlokaAPI.isOnline()) {
        try {
          await window.AlokaAPI.patch(`/menu/${item.id}`, { food_type: newFoodType });
          await window.AlokaAPI.loadAllState();
        } catch (err) {
          alert("Error updating food category: " + err.message);
        }
      } else {
        window.AutoBrixStore.updateState(state => {
          const it = state.config.menuItems[item.id];
          if (it) {
            it.foodType = newFoodType;
          }
        });
      }
      this.updateActiveTabContent();
    });

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      if (!file) return;

      if (window.AlokaAPI.isOnline()) {
        try {
          const formData = new FormData();
          formData.append("image", file);
          await window.AlokaAPI.patchForm(`/menu/${item.id}/image`, formData);
          await window.AlokaAPI.loadAllState();
          alert("Image updated successfully!");
        } catch (err) {
          alert("Error uploading image: " + err.message);
        }
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          window.AutoBrixStore.updateState(state => {
            const it = state.config.menuItems[item.id];
            if (it) {
              it.image = e.target.result;
            }
          });
          alert("Image updated locally!");
        };
        reader.readAsDataURL(file);
      }
      closeModal();
      this.updateActiveTabContent();
    });
  }

  bindMenuDragAndDrop() {
    const tbodies = document.querySelectorAll(".menu-rows-category-container");
    tbodies.forEach(tbody => {
      if (!tbody) return;

      let draggedRow = null;

      tbody.querySelectorAll(".draggable-row").forEach((row) => {
        // Drag-and-drop listeners
        row.addEventListener("dragstart", (e) => {
          draggedRow = row;
          row.classList.add("dragging");
          e.dataTransfer.effectAllowed = "move";
        });

        row.addEventListener("dragover", (e) => {
          e.preventDefault();
          const target = e.target.closest(".draggable-row");
          if (target && target !== draggedRow && target.parentNode === tbody) {
            const rect = target.getBoundingClientRect();
            const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
            tbody.insertBefore(draggedRow, next ? target.nextSibling : target);
          }
        });

        row.addEventListener("dragend", async () => {
          row.classList.remove("dragging");
          
          const allDraggable = Array.from(document.querySelectorAll(".menu-rows-category-container .draggable-row"));
          const newOrder = allDraggable.map(r => r.dataset.id);
          const uniqueIds = Array.from(new Set(newOrder));
          uniqueIds.sort((a, b) => {
            const indicesA = [];
            const indicesB = [];
            newOrder.forEach((id, idx) => {
              if (id === a) indicesA.push(idx);
              if (id === b) indicesB.push(idx);
            });
            const avgA = indicesA.reduce((sum, val) => sum + val, 0) / indicesA.length;
            const avgB = indicesB.reduce((sum, val) => sum + val, 0) / indicesB.length;
            return avgA - avgB;
          });
          const uniqueOrder = uniqueIds;

          if (window.AlokaAPI.isOnline()) {
            try {
              await window.AlokaAPI.post('/menu/reorder', { order: uniqueOrder });
              await window.AlokaAPI.loadAllState();
            } catch (err) {
              alert("Error saving reorder: " + err.message);
            }
          } else {
            window.AutoBrixStore.updateState(state => {
              uniqueOrder.forEach((id, idx) => {
                if (state.config.menuItems[id]) {
                  state.config.menuItems[id].sortOrder = idx;
                }
              });
            });
          }
          this.updateActiveTabContent();
        });

        // Click to reorder popover logic on drag-handle click
        const handle = row.querySelector(".drag-handle");
        if (handle) {
          handle.addEventListener("click", (e) => {
            e.stopPropagation();
            e.preventDefault();

            // Remove any existing popovers
            const existing = document.getElementById("reorder-action-popover");
            if (existing) existing.remove();

            const currentRows = Array.from(tbody.querySelectorAll(".draggable-row"));
            const curIndex = currentRows.indexOf(row);
            const totalRows = currentRows.length;
            
            const isFirst = (curIndex === 0);
            const isLast = (curIndex === totalRows - 1);

            const popover = document.createElement("div");
            popover.id = "reorder-action-popover";
            popover.className = "reorder-popover glass-card";
            popover.style.cssText = `
              position: fixed;
              top: ${e.clientY + 8}px;
              left: ${e.clientX + 8}px;
              z-index: 10002;
              padding: 4px 0;
              min-width: 140px;
              background: var(--bg-surface);
              border: 1px solid var(--border-color);
              border-radius: var(--border-radius-sm);
              box-shadow: var(--shadow-lg);
            `;

            popover.innerHTML = `
              <div class="reorder-option ${isFirst ? 'disabled' : ''}" id="reorder-top" style="padding: 6px 12px; font-size: 0.8rem; font-weight: 500; cursor: ${isFirst ? 'not-allowed' : 'pointer'}; opacity: ${isFirst ? '0.4' : '1'};">🔝 Move to Top</div>
              <div class="reorder-option ${isFirst ? 'disabled' : ''}" id="reorder-up" style="padding: 6px 12px; font-size: 0.8rem; font-weight: 500; cursor: ${isFirst ? 'not-allowed' : 'pointer'}; opacity: ${isFirst ? '0.4' : '1'};">⬆️ Move Up</div>
              <div class="reorder-option ${isLast ? 'disabled' : ''}" id="reorder-down" style="padding: 6px 12px; font-size: 0.8rem; font-weight: 500; cursor: ${isLast ? 'not-allowed' : 'pointer'}; opacity: ${isLast ? '0.4' : '1'};">⬇️ Move Down</div>
              <div class="reorder-option ${isLast ? 'disabled' : ''}" id="reorder-bottom" style="padding: 6px 12px; font-size: 0.8rem; font-weight: 500; cursor: ${isLast ? 'not-allowed' : 'pointer'}; opacity: ${isLast ? '0.4' : '1'};">🔚 Move to Bottom</div>
              <div style="height: 1px; background: var(--border-color); margin: 4px 0;"></div>
              <div class="reorder-option" id="reorder-to-index" style="padding: 6px 12px; font-size: 0.8rem; font-weight: 500; cursor: pointer;">🔢 Move to Row...</div>
            `;

            document.body.appendChild(popover);

            const closePopover = () => {
              popover.remove();
              document.removeEventListener("click", globalClick);
            };

            const globalClick = (ev) => {
              if (!popover.contains(ev.target)) {
                closePopover();
              }
            };

            setTimeout(() => {
              document.addEventListener("click", globalClick);
            }, 50);

            const executeMove = async (targetIndex) => {
              closePopover();
              if (targetIndex < 0 || targetIndex >= totalRows || targetIndex === curIndex) return;

              const reorderedRows = [...currentRows];
              reorderedRows.splice(curIndex, 1);
              reorderedRows.splice(targetIndex, 0, row);

              // Re-append to tbody to visually swap
              reorderedRows.forEach(r => tbody.appendChild(r));

              const allDraggable = Array.from(document.querySelectorAll(".menu-rows-category-container .draggable-row"));
              const newOrder = allDraggable.map(r => r.dataset.id);
              const uniqueIds = Array.from(new Set(newOrder));
              uniqueIds.sort((a, b) => {
                const indicesA = [];
                const indicesB = [];
                newOrder.forEach((id, idx) => {
                  if (id === a) indicesA.push(idx);
                  if (id === b) indicesB.push(idx);
                });
                const avgA = indicesA.reduce((sum, val) => sum + val, 0) / indicesA.length;
                const avgB = indicesB.reduce((sum, val) => sum + val, 0) / indicesB.length;
                return avgA - avgB;
              });
              const uniqueOrder = uniqueIds;

              if (window.AlokaAPI.isOnline()) {
                try {
                  await window.AlokaAPI.post('/menu/reorder', { order: uniqueOrder });
                  await window.AlokaAPI.loadAllState();
                } catch (err) {
                  alert("Error saving reorder: " + err.message);
                }
              } else {
                window.AutoBrixStore.updateState(state => {
                  uniqueOrder.forEach((id, idx) => {
                    if (state.config.menuItems[id]) {
                      state.config.menuItems[id].sortOrder = idx;
                    }
                  });
                });
              }
              this.updateActiveTabContent();
            };

            // Option click handlers
            if (!isFirst) {
              popover.querySelector("#reorder-top").addEventListener("click", () => executeMove(0));
              popover.querySelector("#reorder-up").addEventListener("click", () => executeMove(curIndex - 1));
            }
            if (!isLast) {
              popover.querySelector("#reorder-down").addEventListener("click", () => executeMove(curIndex + 1));
              popover.querySelector("#reorder-bottom").addEventListener("click", () => executeMove(totalRows - 1));
            }
            popover.querySelector("#reorder-to-index").addEventListener("click", () => {
              const targetRowStr = prompt(`Enter target row number (1 to ${totalRows}):`, curIndex + 1);
              if (targetRowStr === null) return;
              const targetNum = parseInt(targetRowStr);
              if (isNaN(targetNum) || targetNum < 1 || targetNum > totalRows) {
                alert("Invalid row number!");
                return;
              }
              executeMove(targetNum - 1);
            });
          });
        }
      });
    });
  }

  // ==========================================
  // TAB: Station
  // ==========================================
  renderStationsTab(container, state) {
    container.innerHTML = `
      <div class="glass-card">
        <h4 class="modal-section-title" style="margin-bottom:0.75rem;">Station</h4>
        <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:1rem;">
          Add or remove operational kitchen stations and assign a staff member to cover each in real-time.
        </p>
        
        <div class="owner-table-wrapper" style="border:none; margin-bottom:1.5rem;">
          <table class="owner-table">
            <thead>
              <tr>
                <th>Station Name</th>
                <th>Assigned Staff</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${Object.values(state.config.stations).map(station => {
                return `
                  <tr>
                    <td><strong>${station.name}</strong></td>
                    <td>
                      <select class="pos-select-sm station-worker-select" data-station-id="${station.id}" style="width:100%; max-width:180px;">
                        <option value="">Unassigned</option>
                        ${state.config.workers.map(w => `
                          <option value="${w.id}" ${w.id === station.currentWorkerId ? 'selected' : ''}>${w.name}</option>
                        `).join("")}
                      </select>
                    </td>
                    <td>
                      <button class="k-item-btn" onclick="ownerPanel.deleteStation('${station.id}')" style="color:var(--color-critical); padding:2px 6px;">Remove Station</button>
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>

        <!-- Add Station Form -->
        <div style="background:rgba(0,0,0,0.1); padding:1rem; border-radius:4px;">
          <h5 class="modal-section-title" style="margin-bottom:0.5rem;">Create New Station</h5>
          <form id="station-add-form" style="display:flex; gap:0.5rem;">
            <input type="text" class="pos-input-sm" id="station-add-name" placeholder="e.g. Moghlai Tawa" style="flex:1;" required>
            <button type="submit" class="pos-action-btn primary" style="padding:0.35rem 1.25rem; grid-column:auto;">Add Station</button>
          </form>
        </div>
      </div>
    `;

    // Bind dropdown changes
    container.querySelectorAll(".station-worker-select").forEach(select => {
      select.addEventListener("change", async (e) => {
        const stationId = e.target.dataset.stationId;
        const workerId = e.target.value;
        if (window.AlokaAPI.isOnline()) {
          try {
            await window.AlokaAPI.put(`/stations/${stationId}/assign`, { worker_id: workerId || null });
            await window.AlokaAPI.loadAllState();
          } catch (err) {
            alert("Error assigning worker: " + err.message);
          }
        } else {
          window.AutoBrixStore.assignWorkerToStation(stationId, workerId || null);
        }
        this.updateActiveTabContent();
      });
    });

    document.getElementById("station-add-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("station-add-name").value.trim();
      if (!name) return;
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      
      if (state.config.stations[id]) {
        alert("Station already exists!");
        return;
      }

      if (window.AlokaAPI.isOnline()) {
        try {
          await window.AlokaAPI.post('/stations', { id, name });
          await window.AlokaAPI.loadAllState();
        } catch (err) {
          alert("Error adding station: " + err.message);
        }
      } else {
        window.AutoBrixStore.addStation(id, name);
      }
      this.updateActiveTabContent();
    });
  }

  async deleteStation(id) {
    if (confirm(`Remove station "${id}"? This will unassign it from all workers and menu items.`)) {
      if (window.AlokaAPI.isOnline()) {
        try {
          await window.AlokaAPI.del(`/stations/${id}`);
          await window.AlokaAPI.loadAllState();
        } catch (err) {
          alert("Error deleting station: " + err.message);
        }
      } else {
        window.AutoBrixStore.removeStation(id);
      }
      this.updateActiveTabContent();
    }
  }

  // ==========================================
  // TAB: Recipe Editor
  // ==========================================
  renderRecipesTab(container, state) {
    container.innerHTML = `
      <div class="glass-card">
        <h4 class="modal-section-title" style="margin-bottom:0.75rem;">Interactive Recipe & Portions Editor</h4>
        
        <div class="batch-editor-panel" style="display:grid; grid-template-columns: 240px 1fr; gap:1.5rem;">
          <!-- Left: Menu Item List -->
          <div class="glass-card" style="max-height: 480px; overflow-y: auto; padding:0.5rem; background:rgba(0,0,0,0.15); display:flex; flex-direction:column; gap:4px;">
            <h5 style="font-size:0.75rem; color:var(--text-muted); padding:0 0.5rem 0.5rem 0.5rem; border-bottom:1px solid rgba(255,255,255,0.05); text-transform:uppercase; letter-spacing:0.05em;">Menu Catalog</h5>
            ${Object.values(state.config.menuItems).map(it => {
              const activeClass = this.selectedRecipeItem === it.id ? "active" : "";
              return `
                <button class="owner-tab-btn ${activeClass}" 
                        onclick="ownerPanel.selectRecipeItem('${it.id}')" 
                        style="text-align:left; width:100%; padding:8px 12px; border-radius:4px; font-size:0.85rem; font-weight:600; display:flex; justify-content:space-between; align-items:center; background:none; border:none; color:var(--text-secondary); cursor:pointer;">
                  <span>${it.name}</span>
                  <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>
                </button>
              `;
            }).join("")}
          </div>

          <!-- Right: Ingredient Configurator -->
          <div class="glass-card" style="background:rgba(255,255,255,0.02); display:flex; flex-direction:column; justify-content:space-between;">
            <div>
              <h4 id="recipe-editor-title" style="font-size:1.1rem; font-weight:700; color:var(--accent-color); margin-bottom:1rem;"></h4>
              
              <div class="owner-table-wrapper" style="border:none; max-height: 280px; overflow-y:auto;">
                <table class="owner-table">
                  <thead>
                    <tr>
                      <th>Ingredient</th>
                      <th>Quantity Required</th>
                      <th>Unit</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody id="recipe-ingredients-list"></tbody>
                </table>
              </div>
            </div>

            <!-- Add ingredient Form -->
            <div style="margin-top:1.5rem; display:flex; gap:0.5rem; background:rgba(0,0,0,0.15); padding:0.75rem; border-radius:6px; flex-wrap:wrap; align-items:center;">
              <div style="flex:1; min-width:180px;">
                <select class="pos-select-sm" id="recipe-add-ing" style="width:100%;">
                  <!-- loaded dynamically -->
                </select>
              </div>
              <div style="width:100px;">
                <input type="number" class="pos-input-sm" id="recipe-add-qty" placeholder="Qty" style="width:100%;">
              </div>
              <div style="width:90px;">
                <select class="pos-select-sm" id="recipe-add-unit" style="width:100%;">
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                  <option value="ml">ml</option>
                  <option value="L">L</option>
                  <option value="pcs">pcs</option>
                  <option value="portions">portions</option>
                  <option value="packets">packets</option>
                </select>
              </div>
              <button class="pos-action-btn primary" id="recipe-add-btn" style="padding:0.35rem 1rem; grid-column:auto;">Add Ingredient</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Populate Add-Ingredient Dropdown with all items (they remain in the dropdown)
    const selectAddIng = document.getElementById("recipe-add-ing");
    const rawKeys = Object.keys(state.inventory.raw);
    const interKeys = Object.keys(state.inventory.intermediate);
    const prepKeys = Object.keys(state.inventory.prepared);
    const allIngs = [...rawKeys, ...interKeys, ...prepKeys];

    selectAddIng.innerHTML = allIngs.map(key => {
      const isRaw = state.inventory.raw[key] !== undefined;
      const inv = isRaw ? state.inventory.raw[key] : (state.inventory.intermediate[key] || state.inventory.prepared[key]);
      const typeLabel = isRaw ? "Raw" : (state.inventory.intermediate[key] ? "Inter" : "Prep");
      return `<option value="${key}">${inv.name} (${typeLabel})</option>`;
    }).join("");

    const renderSelectedRecipeRows = () => {
      const itemId = this.selectedRecipeItem;
      const item = state.config.menuItems[itemId];
      if (!item) return;

      document.getElementById("recipe-editor-title").innerHTML = `Recipe Formula for: <span style="color:#ffffff;">${item.name}</span>`;
      
      const tbody = document.getElementById("recipe-ingredients-list");
      tbody.innerHTML = Object.entries(item.recipe || {}).map(([ingId, qty]) => {
        const isRaw = state.inventory.raw[ingId] !== undefined;
        const inv = isRaw ? state.inventory.raw[ingId] : (state.inventory.intermediate[ingId] || state.inventory.prepared[ingId]);
        if (!inv) return '';
        
        // Find existing unit
        const defaultUnit = isRaw ? inv.stockUnit : inv.unit;
        
        // Render unit dropdown in row
        const unitDropdown = `
          <select class="pos-select-sm" onchange="ownerPanel.updateRecipeQty('${item.id}', '${ingId}', document.getElementById('qty-${item.id}-${ingId}').value, this.value)" style="padding:2px 4px; font-size:0.8rem; width:80px;">
            ${['g','kg','ml','L','pcs','portions','packets'].map(u => `<option value="${u}" ${defaultUnit === u ? "selected" : ""}>${u}</option>`).join("")}
          </select>
        `;

        return `
          <tr>
            <td><strong>${inv.name}</strong></td>
            <td>
              <input type="number" id="qty-${item.id}-${ingId}" class="owner-input-cell" value="${qty}" onchange="ownerPanel.updateRecipeQty('${item.id}', '${ingId}', this.value, '${defaultUnit}')">
            </td>
            <td>${unitDropdown}</td>
            <td>
              <button class="k-item-btn" onclick="ownerPanel.deleteRecipeIngredient('${item.id}', '${ingId}')" style="color:var(--color-critical); padding:2px 6px;">Remove</button>
            </td>
          </tr>
        `;
      }).join("");
    };

    renderSelectedRecipeRows();

    // Add ingredient handler
    document.getElementById("recipe-add-btn").addEventListener("click", () => {
      const itemId = this.selectedRecipeItem;
      const ingId = selectAddIng.value;
      const qty = parseFloat(document.getElementById("recipe-add-qty").value);
      const unit = document.getElementById("recipe-add-unit").value;

      this.addRecipeIngredient(itemId, ingId, qty, unit);
      document.getElementById("recipe-add-qty").value = "";
    });
  }

  selectRecipeItem(itemId) {
    this.selectedRecipeItem = itemId;
    this.updateActiveTabContent();
  }

  async updateRecipeQty(itemId, ingredientId, quantity, unit) {
    const qty = parseFloat(quantity);
    const state = window.AutoBrixStore.state;
    let type = 'intermediate';
    if (state.inventory.raw[ingredientId]) type = 'raw';
    else if (state.inventory.prepared[ingredientId]) type = 'prepared';

    if (window.AlokaAPI.isOnline()) {
      try {
        await window.AlokaAPI.put(`/menu/${itemId}/recipe/${ingredientId}`, {
          quantity: qty,
          ingredient_type: type,
          unit: unit
        });
        await window.AlokaAPI.loadAllState();
      } catch (err) {
        alert("Error updating recipe: " + err.message);
      }
    } else {
      window.AutoBrixStore.updateMenuItemRecipe(itemId, ingredientId, qty);
    }
    this.updateActiveTabContent();
  }

  async deleteRecipeIngredient(itemId, ingredientId) {
    if (confirm("Remove this ingredient from the recipe?")) {
      if (window.AlokaAPI.isOnline()) {
        try {
          await window.AlokaAPI.put(`/menu/${itemId}/recipe/${ingredientId}`, {
            quantity: 0
          });
          await window.AlokaAPI.loadAllState();
        } catch (err) {
          alert("Error removing ingredient: " + err.message);
        }
      } else {
        window.AutoBrixStore.updateMenuItemRecipe(itemId, ingredientId, 0);
      }
      this.updateActiveTabContent();
    }
  }

  async addRecipeIngredient(itemId, ingredientId, qty, unit) {
    if (isNaN(qty) || qty <= 0) {
      alert("Enter a valid quantity!");
      return;
    }
    const state = window.AutoBrixStore.state;
    let type = 'intermediate';
    if (state.inventory.raw[ingredientId]) type = 'raw';
    else if (state.inventory.prepared[ingredientId]) type = 'prepared';

    if (window.AlokaAPI.isOnline()) {
      try {
        await window.AlokaAPI.put(`/menu/${itemId}/recipe/${ingredientId}`, {
          quantity: qty,
          ingredient_type: type,
          unit: unit
        });
        await window.AlokaAPI.loadAllState();
      } catch (err) {
        alert("Error adding ingredient: " + err.message);
      }
    } else {
      window.AutoBrixStore.updateMenuItemRecipe(itemId, ingredientId, qty);
    }
    this.updateActiveTabContent();
  }

  // ==========================================
  // TAB: Labor Shifts
  // ==========================================
  renderLaborTab(container, state) {
    container.innerHTML = `
      <div class="glass-card">
        <h4 class="modal-section-title" style="margin-bottom:0.75rem;">Employee Roster & Wage Configuration</h4>
        <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:1rem;">
          Configure staff check-in, station coverage (multiple allowed), and daily salary rates.
        </p>

        <div class="owner-table-wrapper" style="border:none; margin-bottom:1.5rem;">
          <table class="owner-table">
            <thead>
              <tr>
                <th style="text-align: left;">Employee Name</th>
                <th style="text-align: left;">Assigned Station Coverage</th>
                <th style="text-align: center;">Daily Salary</th>
                <th style="text-align: center;">Shift Checked-in</th>
                <th style="text-align: center;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${state.config.workers.map(worker => {
                const stationsList = (worker.stations || []).map(s => {
                  const station = state.config.stations[s];
                  if (!station) return "";
                  return `<span class="badge badge-normal" style="font-size: 0.7rem; text-transform: none; padding: 2px 8px; border-radius: 4px;">${station.name}</span>`;
                }).filter(Boolean).join(" ");

                const checked = worker.active ? "checked" : "";

                return `
                  <tr>
                    <td><strong>${worker.name}</strong></td>
                    <td>
                      <div style="display:flex; flex-wrap:wrap; gap:4px; max-width:400px;">
                        ${stationsList || `<span style="color: var(--text-muted); font-size: 0.8rem; font-style: italic;">No stations assigned</span>`}
                      </div>
                    </td>
                    <td style="text-align: center;"><span style="font-family: var(--font-mono); font-weight: 500;">₹${worker.dailySalary || 0}</span></td>
                    <td style="text-align: center;">
                      <input type="checkbox" ${checked} onchange="ownerPanel.toggleWorkerShift('${worker.id}', this.checked)" style="width: 16px; height: 16px; accent-color: var(--accent-color); cursor: pointer;">
                    </td>
                    <td style="text-align: center;">
                      <div style="display:inline-flex; gap:6px;">
                        <button class="k-item-btn" onclick="ownerPanel.openEditWorkerModal('${worker.id}')" style="margin-top:0; font-size:0.75rem; padding: 4px 10px; background: var(--accent-color); border-color: var(--accent-color); color: #fff;">Edit</button>
                        <button class="k-item-btn" onclick="ownerPanel.deleteWorker('${worker.id}', '${worker.name}')" style="margin-top:0; font-size:0.75rem; padding: 4px 10px; background: var(--color-critical-bg); border-color: rgba(239, 68, 68, 0.3); color: var(--color-critical);">Delete</button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
        
        <!-- Add worker Form -->
        <div style="background:rgba(0,0,0,0.1); padding:1rem; border-radius:4px;">
          <h5 class="modal-section-title" style="margin-bottom:0.75rem;">Add New Employee</h5>
          <form id="worker-add-form" style="display:flex; flex-direction:column; gap:0.75rem;">
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
              <input type="text" class="pos-input-sm" id="worker-add-name" placeholder="Name (e.g. Raju)" style="flex:1; min-width:120px;" required>
              <input type="number" class="pos-input-sm" id="worker-add-salary" placeholder="Daily Salary (e.g. ₹500)" style="width:180px;" required>
            </div>
            
            <div style="display:flex; flex-direction:column; gap:0.25rem;">
              <span class="form-label-xs">Station Coverage Assignment:</span>
              <div style="display:flex; flex-wrap:wrap; gap:4px; padding:0.5rem; background:rgba(0,0,0,0.2); border-radius:4px;">
                ${Object.keys(state.config.stations).map(s => `
                  <label style="font-size:0.75rem; display:inline-flex; align-items:center; gap:4px; cursor:pointer; padding:2px 8px; border-radius:3px;">
                    <input type="checkbox" class="worker-add-station-check" value="${s}">
                    ${state.config.stations[s].name}
                  </label>
                `).join("")}
              </div>
            </div>

            <button type="submit" class="pos-action-btn primary" style="padding:0.35rem 1.25rem; grid-column:auto; align-self:flex-start;">Add Employee</button>
          </form>
        </div>
      </div>
    `;

    document.getElementById("worker-add-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("worker-add-name").value.trim();
      const dailySalary = parseInt(document.getElementById("worker-add-salary").value) || 0;
      
      const stationChecks = document.querySelectorAll(".worker-add-station-check:checked");
      const stations = Array.from(stationChecks).map(c => c.value);

      if (!name) return;

      if (window.AlokaAPI.isOnline()) {
        try {
          await window.AlokaAPI.post('/workers', { name, stations, daily_salary: dailySalary });
          await window.AlokaAPI.loadAllState();
        } catch (err) {
          alert("Error adding worker: " + err.message);
        }
      } else {
        window.AutoBrixStore.addWorker(name, stations, dailySalary);
      }
      this.updateActiveTabContent();
    });
  }

  openEditWorkerModal(workerId) {
    const state = window.AutoBrixStore.state;
    const worker = state.config.workers.find(w => w.id === workerId);
    if (!worker) return;

    const existing = document.getElementById("edit-worker-modal-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "edit-worker-modal-overlay";
    overlay.className = "modal-overlay";
    overlay.style.zIndex = "10000";

    const allStations = state.config.stations;
    const selectedStations = [...(worker.stations || [])];

    overlay.innerHTML = `
      <div class="modal-container" style="max-width: 400px; padding: 0; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--border-radius-md); box-shadow: var(--shadow-lg);">
        <div class="modal-header" style="padding: 1rem 1.25rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <h3 class="modal-title" style="font-size: 1.1rem; font-weight: 600; color: var(--text-primary);">Edit Employee</h3>
          <button class="modal-close-btn" id="btn-close-edit-modal" style="background: none; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer;">&times;</button>
        </div>
        <form id="edit-worker-form">
          <div class="modal-body" style="padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem;">
            <div style="display: flex; flex-direction: column; gap: 0.25rem;">
              <label class="form-label-xs">Employee Name</label>
              <input type="text" class="pos-input-sm" id="edit-worker-name" value="${worker.name}" required style="width: 100%;">
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 0.25rem;">
              <label class="form-label-xs">Daily Salary (₹)</label>
              <input type="number" class="pos-input-sm" id="edit-worker-salary" value="${worker.dailySalary || 0}" min="0" required style="width: 100%;">
            </div>

            <div style="display: flex; align-items: center; gap: 0.5rem; margin: 0.25rem 0;">
              <input type="checkbox" id="edit-worker-active" ${worker.active ? "checked" : ""} style="width: 16px; height: 16px; accent-color: var(--accent-color); cursor: pointer;">
              <label for="edit-worker-active" style="font-size: 0.85rem; font-weight: 500; color: var(--text-primary); cursor: pointer; user-select: none;">Shift Checked-in</label>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.25rem; position: relative;">
              <label class="form-label-xs">Assigned Station Coverage</label>
              
              <div class="multiselect-container" style="position: relative; width: 100%;">
                <div id="multiselect-trigger" style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.85rem; color: var(--text-primary); cursor: pointer; user-select: none;">
                  <span id="multiselect-selected-text">Select Stations</span>
                  <span style="font-size: 0.6rem; color: var(--text-muted); transition: transform 0.2s;" id="multiselect-arrow">▼</span>
                </div>

                <div id="multiselect-options-list" style="display: none; position: absolute; top: 105%; left: 0; right: 0; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 4px; box-shadow: var(--shadow-md); max-height: 200px; overflow-y: auto; z-index: 10001; padding: 0.25rem 0;">
                  ${Object.keys(allStations).map(s => {
                    const isSelected = selectedStations.includes(s);
                    return `
                      <label style="display: flex; align-items: center; gap: 8px; padding: 6px 12px; font-size: 0.85rem; color: var(--text-secondary); cursor: pointer; user-select: none; transition: background 0.15s;" class="multiselect-option-row">
                        <input type="checkbox" class="edit-station-check-option" value="${s}" ${isSelected ? "checked" : ""} style="accent-color: var(--accent-color); cursor: pointer;">
                        <span>${allStations[s].name}</span>
                      </label>
                    `;
                  }).join("")}
                </div>
              </div>
            </div>
          </div>
          
          <div class="modal-footer" style="padding: 1rem 1.25rem; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;">
            <button type="button" class="pos-action-btn danger" id="btn-delete-worker" style="padding: 0.35rem 1rem; margin: 0; font-size: 0.85rem;">Remove Employee</button>
            <div style="display: flex; gap: 0.5rem;">
              <button type="button" class="pos-action-btn secondary" id="btn-cancel-edit-modal" style="padding: 0.35rem 1rem; margin: 0; font-size: 0.85rem;">Cancel</button>
              <button type="submit" class="pos-action-btn primary" style="padding: 0.35rem 1.25rem; margin: 0; font-size: 0.85rem;">Save Changes</button>
            </div>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    const trigger = overlay.querySelector("#multiselect-trigger");
    const optionsList = overlay.querySelector("#multiselect-options-list");
    const arrow = overlay.querySelector("#multiselect-arrow");
    const checkboxes = overlay.querySelectorAll(".edit-station-check-option");
    const selectedText = overlay.querySelector("#multiselect-selected-text");

    const updateSelectedText = () => {
      const checkedVals = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.parentNode.querySelector('span').textContent);
      if (checkedVals.length === 0) {
        selectedText.textContent = "Select Stations";
        selectedText.style.color = "var(--text-muted)";
      } else {
        selectedText.textContent = checkedVals.join(", ");
        selectedText.style.color = "var(--text-primary)";
      }
    };

    updateSelectedText();

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = optionsList.style.display === "block";
      optionsList.style.display = isOpen ? "none" : "block";
      arrow.style.transform = isOpen ? "rotate(0deg)" : "rotate(180deg)";
    });

    document.addEventListener("click", function closeDropdown(e) {
      if (!overlay.parentNode) {
        document.removeEventListener("click", closeDropdown);
        return;
      }
      if (!trigger.contains(e.target) && !optionsList.contains(e.target)) {
        optionsList.style.display = "none";
        arrow.style.transform = "rotate(0deg)";
      }
    });

    checkboxes.forEach(cb => {
      cb.addEventListener("change", () => {
        updateSelectedText();
      });
      const row = cb.closest(".multiselect-option-row");
      row.addEventListener("mouseenter", () => {
        row.style.background = "rgba(255,255,255,0.04)";
      });
      row.addEventListener("mouseleave", () => {
        row.style.background = "none";
      });
    });

    const closeModal = () => {
      overlay.remove();
    };

    overlay.querySelector("#btn-close-edit-modal").addEventListener("click", closeModal);
    overlay.querySelector("#btn-cancel-edit-modal").addEventListener("click", closeModal);

    overlay.querySelector("#btn-delete-worker").addEventListener("click", async () => {
      if (confirm(`Are you sure you want to remove ${worker.name} from the employee roster?`)) {
        if (window.AlokaAPI.isOnline()) {
          try {
            await window.AlokaAPI.del(`/workers/${worker.id}`);
            await window.AlokaAPI.loadAllState();
          } catch (err) {
            alert("Error removing worker: " + err.message);
          }
        } else {
          window.AutoBrixStore.removeWorker(worker.id);
        }
        closeModal();
        this.updateActiveTabContent();
      }
    });

    overlay.querySelector("#edit-worker-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const updatedName = overlay.querySelector("#edit-worker-name").value.trim();
      const updatedSalary = parseInt(overlay.querySelector("#edit-worker-salary").value) || 0;
      const updatedActive = overlay.querySelector("#edit-worker-active").checked;
      const updatedStations = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);

      if (!updatedName) return;

      if (window.AlokaAPI.isOnline()) {
        try {
          await window.AlokaAPI.patch(`/workers/${worker.id}`, {
            name: updatedName,
            active: updatedActive,
            daily_salary: updatedSalary,
            stations: updatedStations
          });
          await window.AlokaAPI.loadAllState();
        } catch (err) {
          alert("Error saving worker: " + err.message);
        }
      } else {
        window.AutoBrixStore.updateWorkerShift(worker.id, updatedActive, updatedStations, updatedSalary, updatedName);
      }
      closeModal();
      this.updateActiveTabContent();
    });
  }

  async deleteWorker(workerId, workerName) {
    if (confirm(`Are you sure you want to remove ${workerName} from the employee roster?`)) {
      if (window.AlokaAPI.isOnline()) {
        try {
          await window.AlokaAPI.del(`/workers/${workerId}`);
          await window.AlokaAPI.loadAllState();
        } catch (err) {
          alert("Error removing worker: " + err.message);
        }
      } else {
        window.AutoBrixStore.removeWorker(workerId);
      }
      this.updateActiveTabContent();
    }
  }

  async toggleWorkerShift(workerId, active) {
    const state = window.AutoBrixStore.state;
    const worker = state.config.workers.find(w => w.id === workerId);
    if (!worker) return;

    if (window.AlokaAPI.isOnline()) {
      try {
        await window.AlokaAPI.patch(`/workers/${workerId}`, { active: active });
        await window.AlokaAPI.loadAllState();
      } catch (err) { alert(err.message); }
    } else {
      window.AutoBrixStore.updateWorkerShift(workerId, active, worker.stations, worker.dailySalary);
    }
  }

  // ==========================================
  // TAB: Morning Batch Production Prep & Stocks
  // ==========================================
  renderInventoryTab(container, state) {
    container.innerHTML = `
      <div class="batch-editor-panel" style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem;">
        
        <!-- Left Pane: Morning Prep Form & Recipe Config -->
        <div style="display:flex; flex-direction:column; gap:1.5rem;">
          
          <!-- Morning Batch Logger -->
          <div class="glass-card">
            <h4 class="modal-section-title" style="margin-bottom:0.75rem;">Morning Batch Production Tracker</h4>
            <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:1rem;">
              Convert raw ingredients purchased into prepped intermediates or ready bases. This tracks production yields and logs waste details.
            </p>
            
            <div style="display:flex; flex-direction:column; gap:0.75rem;">
              <div style="display:flex; flex-direction:column; gap:0.25rem;">
                <label class="form-label-xs">Select Prep Target:</label>
                <select class="pos-select-sm" id="batch-target">
                  ${Object.entries(state.config.batchRecipes).map(([key, r]) => `<option value="${key}" ${this.selectedBatchRecipe === key ? "selected" : ""}>${r.name} (${r.unit})</option>`).join("")}
                </select>
              </div>
              
              <div style="display:flex; flex-direction:column; gap:0.25rem;">
                <label class="form-label-xs" id="batch-input-label">Raw Ingredient Used (g):</label>
                <input type="number" class="pos-input-sm" id="batch-input-qty" placeholder="Input qty (e.g. 10000)">
              </div>
              
              <div style="display:flex; flex-direction:column; gap:0.25rem;">
                <label class="form-label-xs">Actual Yield Output Quantity:</label>
                <input type="number" class="pos-input-sm" id="batch-actual-qty" placeholder="Yield output">
              </div>
              
              <button class="pos-action-btn primary" id="btn-batch-produce" style="grid-column:auto; margin-top:0.5rem;">Log Batch Yield</button>
            </div>
          </div>

          <!-- Dynamic Ingredient List Editor for Batch Recipe -->
          <div class="glass-card" style="background:rgba(255,255,255,0.02);">
            <h4 class="modal-section-title" style="margin-bottom:0.5rem;" id="batch-recipe-editor-title">Batch Recipe Formula</h4>
            
            <div class="owner-table-wrapper" style="border:none; max-height:160px; overflow-y:auto; margin-bottom:1rem;">
              <table class="owner-table" style="font-size:0.8rem;">
                <thead>
                  <tr>
                    <th>Raw Ingredient</th>
                    <th>Ratio Per Unit Yield</th>
                    <th>Unit</th>
                    <th>Remove</th>
                  </tr>
                </thead>
                <tbody id="batch-recipe-ing-rows"></tbody>
              </table>
            </div>

            <!-- Add Ing to Batch Recipe Form -->
            <div style="display:flex; gap:0.4rem; background:rgba(0,0,0,0.15); padding:0.5rem; border-radius:4px; margin-bottom:1rem;">
              <select class="pos-select-sm" id="batch-add-raw-id" style="flex:1; font-size:0.75rem;">
                ${Object.entries(state.inventory.raw).map(([key, raw]) => `<option value="${key}">${raw.name}</option>`).join("")}
              </select>
              <input type="number" class="pos-input-sm" id="batch-add-ratio" placeholder="Ratio" style="width:70px; font-size:0.75rem;">
              <select class="pos-select-sm" id="batch-add-unit" style="width:60px; font-size:0.75rem;">
                <option value="g">g</option>
                <option value="kg">kg</option>
                <option value="ml">ml</option>
                <option value="L">L</option>
                <option value="pcs">pcs</option>
              </select>
              <button class="pos-action-btn primary" id="btn-batch-add-ing" style="padding:4px 8px; font-size:0.75rem; grid-column:auto;">Add</button>
            </div>

            <!-- Processing Type & Stages Config -->
            <div style="border-top:1px solid rgba(255,255,255,0.05); padding-top:1rem;">
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.75rem;">
                <span class="form-label-xs" style="font-weight:700;">Processing Flow Type:</span>
                <div style="display:flex; gap:0.5rem;">
                  <label style="font-size:0.8rem; display:inline-flex; align-items:center; gap:4px; cursor:pointer;">
                    <input type="radio" name="proc-type" id="proc-direct" value="direct"> Direct Prep
                  </label>
                  <label style="font-size:0.8rem; display:inline-flex; align-items:center; gap:4px; cursor:pointer;">
                    <input type="radio" name="proc-type" id="proc-staged" value="staged"> Staged Processing
                  </label>
                </div>
              </div>

              <!-- Stages Editor Table -->
              <div id="batch-stages-editor-section" style="display:none; background:rgba(0,0,0,0.1); padding:0.5rem; border-radius:4px;">
                <span class="form-label-xs" style="display:block; margin-bottom:0.4rem; font-weight:700;">Processing Stages Checklist:</span>
                <div class="owner-table-wrapper" style="border:none; max-height:140px; overflow-y:auto; margin-bottom:0.5rem;">
                  <table class="owner-table" style="font-size:0.75rem;">
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Stage Name</th>
                        <th>Station</th>
                        <th>Min</th>
                        <th>Remove</th>
                      </tr>
                    </thead>
                    <tbody id="batch-stages-rows"></tbody>
                  </table>
                </div>
                
                <div style="display:flex; gap:4px; align-items:center;">
                  <input type="text" class="pos-input-sm" id="stage-new-name" placeholder="Stage Name" style="flex:1; font-size:0.75rem;">
                  <select class="pos-select-sm" id="stage-new-station" style="width:100px; font-size:0.75rem;">
                    ${Object.keys(state.config.stations).map(s => `<option value="${s}">${state.config.stations[s].name}</option>`).join("")}
                  </select>
                  <input type="number" class="pos-input-sm" id="stage-new-duration" placeholder="Min" style="width:50px; font-size:0.75rem;">
                  <button class="pos-action-btn primary" id="btn-stage-add" style="padding:4px 8px; font-size:0.75rem; grid-column:auto;">+ Stage</button>
                </div>
              </div>
            </div>

          </div>
        </div>
        
        <!-- Right Pane: Inventory & Raw Prices Panel -->
        <div style="display:flex; flex-direction:column; gap:1.5rem;">
          
          <!-- Raw Ingredients Cost and Suppliers Management Panel -->
          <div class="glass-card" style="display:flex; flex-direction:column;">
            <h4 class="modal-section-title" style="margin-bottom:0.5rem;">Raw Material Procurement List</h4>
            <span style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:1rem;">Editable purchase costs per unit and suppliers (saves instantly to DB)</span>
            
            <div class="owner-table-wrapper" style="border:none; max-height:280px; overflow-y:auto;">
              <table class="owner-table" style="font-size:0.75rem;">
                <thead>
                  <tr>
                    <th>Ingredient Name</th>
                    <th>Stock Avail</th>
                    <th>Min stock</th>
                    <th>Price/Unit (₹)</th>
                    <th>Supplier Partner</th>
                  </tr>
                </thead>
                <tbody>
                  ${Object.entries(state.inventory.raw).map(([key, raw]) => {
                    const avail = raw.stock - raw.reserved;
                    const valColor = avail < raw.minStock ? "var(--color-warning)" : "inherit";
                    
                    return `
                      <tr>
                        <td><strong>${raw.name}</strong></td>
                        <td style="font-family:var(--font-mono); color:${valColor};">
                          ${(avail / raw.conversionFactor).toFixed(1)}${raw.purchaseUnit}
                        </td>
                        <td>
                          <input type="number" class="owner-input-cell" value="${raw.minStock / raw.conversionFactor}" onchange="ownerPanel.updateRawIngredientField('${key}', 'min_stock', this.value * ${raw.conversionFactor})" style="width:50px;">
                        </td>
                        <td>
                          <input type="number" class="owner-input-cell" value="${raw.costPerPurchaseUnit}" onchange="ownerPanel.updateRawIngredientField('${key}', 'cost_per_purchase_unit', this.value)" style="width:60px;">
                        </td>
                        <td>
                          <input type="text" class="owner-input-cell" value="${raw.supplier || ''}" onchange="ownerPanel.updateRawIngredientField('${key}', 'supplier', this.value)" style="width:110px;">
                        </td>
                      </tr>
                    `;
                  }).join("")}
                </tbody>
              </table>
            </div>

            <!-- Create New Raw Ingredient Form -->
            <div style="background:rgba(255,255,255,0.03); padding:0.75rem; border-radius:6px; margin-top:1rem;">
              <span class="form-label-xs" style="font-weight:700; display:block; margin-bottom:0.5rem;">Create New Raw Material:</span>
              <form id="raw-add-form" style="display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem;">
                <input type="text" class="pos-input-sm" id="raw-add-name" placeholder="Ingredient Name" style="grid-column: span 2;" required>
                
                <div style="display:flex; flex-direction:column; gap:2px;">
                  <label class="form-label-xs">Pur. Unit</label>
                  <select class="pos-select-sm" id="raw-add-punit">
                    <option value="kg">kg</option>
                    <option value="L">L</option>
                    <option value="pcs">pcs</option>
                    <option value="portions">portions</option>
                    <option value="packets">packets</option>
                  </select>
                </div>
                
                <div style="display:flex; flex-direction:column; gap:2px;">
                  <label class="form-label-xs">Stock Unit</label>
                  <select class="pos-select-sm" id="raw-add-sunit">
                    <option value="g">g</option>
                    <option value="ml">ml</option>
                    <option value="pcs">pcs</option>
                    <option value="portions">portions</option>
                    <option value="packets">packets</option>
                  </select>
                </div>

                <div style="display:flex; flex-direction:column; gap:2px;">
                  <label class="form-label-xs">Conv Factor</label>
                  <input type="number" class="pos-input-sm" id="raw-add-conv" value="1000" required>
                </div>

                <div style="display:flex; flex-direction:column; gap:2px;">
                  <label class="form-label-xs">Min Stock</label>
                  <input type="number" class="pos-input-sm" id="raw-add-min" value="0" required>
                </div>

                <div style="display:flex; flex-direction:column; gap:2px;">
                  <label class="form-label-xs">Purchase Cost (₹)</label>
                  <input type="number" class="pos-input-sm" id="raw-add-cost" value="0" required>
                </div>

                <div style="display:flex; flex-direction:column; gap:2px;">
                  <label class="form-label-xs">Supplier</label>
                  <input type="text" class="pos-input-sm" id="raw-add-supplier" placeholder="e.g. Local Dairy">
                </div>

                <button type="submit" class="pos-action-btn primary" style="grid-column: span 2; padding:0.35rem 0.5rem; margin-top:0.25rem;">Add Ingredient</button>
              </form>
            </div>

          </div>

          <!-- Three-Tier Stock Status for Prepared Items -->
          <div class="glass-card" style="padding:0.75rem 1rem;">
            <h5 style="font-size:0.75rem; color:var(--color-warning); margin-bottom:0.5rem; text-transform:uppercase; font-weight:700;">Intermediate & Prepared stocks</h5>
            <div class="owner-table-wrapper" style="border:none;">
              <table class="owner-table" style="font-size:0.75rem;">
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th>Available Stock</th>
                    <th>Reserved Queue</th>
                  </tr>
                </thead>
                <tbody>
                  ${[...Object.entries(state.inventory.intermediate), ...Object.entries(state.inventory.prepared)].map(([key, item]) => {
                    const avail = item.stock - item.reserved;
                    const valColor = avail < item.minStock ? "var(--color-warning)" : "inherit";
                    return `
                      <tr>
                        <td><strong>${item.name}</strong></td>
                        <td style="font-family:var(--font-mono); color:${valColor};">${avail} / ${item.stock} ${item.unit}</td>
                        <td style="font-family:var(--font-mono); color:var(--text-muted);">${item.reserved} ${item.unit}</td>
                      </tr>
                    `;
                  }).join("")}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>
    `;

    // Dynamic labels for Morning batch production
    const batchTarget = document.getElementById("batch-target");
    const inputLabel = document.getElementById("batch-input-label");

    const updateBatchFormLabels = () => {
      const targetId = batchTarget.value;
      this.selectedBatchRecipe = targetId;
      const recipe = state.config.batchRecipes[targetId];
      if (!recipe) return;
      
      const primaryRawIngId = Object.keys(recipe.rawIngredients)[0];
      const rawIng = state.inventory.raw[primaryRawIngId];
      if (rawIng) {
        inputLabel.innerText = `Raw Ingredient Used: ${rawIng.name} (${rawIng.stockUnit})`;
      }

      // Render ingredient rows for select batch recipe
      const ingTbody = document.getElementById("batch-recipe-ing-rows");
      document.getElementById("batch-recipe-editor-title").innerText = `Batch Formula: ${recipe.name}`;
      
      ingTbody.innerHTML = Object.entries(recipe.rawIngredients).map(([rawId, ratio]) => {
        const raw = state.inventory.raw[rawId];
        if (!raw) return '';
        return `
          <tr>
            <td><strong>${raw.name}</strong></td>
            <td>
              <input type="number" class="owner-input-cell" value="${ratio}" onchange="ownerPanel.updateBatchRecipeIng('${targetId}', '${rawId}', this.value)" style="width:70px;">
            </td>
            <td>${raw.stockUnit}</td>
            <td>
              <button class="k-item-btn" onclick="ownerPanel.updateBatchRecipeIng('${targetId}', '${rawId}', 0)" style="color:var(--color-critical); padding:2px 6px;">Remove</button>
            </td>
          </tr>
        `;
      }).join("");

      // Radio Flow type check
      const procDirect = document.getElementById("proc-direct");
      const procStaged = document.getElementById("proc-staged");
      if (recipe.processingType === "staged") {
        procStaged.checked = true;
        document.getElementById("batch-stages-editor-section").style.display = "block";
      } else {
        procDirect.checked = true;
        document.getElementById("batch-stages-editor-section").style.display = "none";
      }

      // Render stages checklist
      const stagesTbody = document.getElementById("batch-stages-rows");
      stagesTbody.innerHTML = (recipe.stages || []).map((stage, idx) => `
        <tr>
          <td><strong>${idx + 1}</strong></td>
          <td>${stage.stage_name}</td>
          <td><span class="badge badge-normal">${state.config.stations[stage.station_id] ? state.config.stations[stage.station_id].name : stage.station_id}</span></td>
          <td>${stage.duration_min}m</td>
          <td>
            <button class="k-item-btn" onclick="ownerPanel.removeBatchStage('${targetId}', ${idx})" style="color:var(--color-critical); padding:2px 4px;">Remove</button>
          </td>
        </tr>
      `).join("");
    };

    batchTarget.addEventListener("change", updateBatchFormLabels);
    updateBatchFormLabels();

    // Direct/Staged Toggle Listener
    const procDirect = document.getElementById("proc-direct");
    const procStaged = document.getElementById("proc-staged");
    const toggleProcType = async (type) => {
      const targetId = this.selectedBatchRecipe;
      const recipe = state.config.batchRecipes[targetId];
      if (window.AlokaAPI.isOnline()) {
        try {
          await window.AlokaAPI.patch(`/inventory/batch-recipes/${targetId}`, {
            processing_type: type,
            stages: type === 'direct' ? [] : (recipe.stages || [])
          });
          await window.AlokaAPI.loadAllState();
        } catch (err) { alert(err.message); }
      } else {
        window.AutoBrixStore.updateState(s => {
          if (s.config.batchRecipes[targetId]) {
            s.config.batchRecipes[targetId].processingType = type;
            if (type === 'direct') s.config.batchRecipes[targetId].stages = [];
          }
        });
      }
      this.updateActiveTabContent();
    };

    procDirect.addEventListener("change", () => toggleProcType("direct"));
    procStaged.addEventListener("change", () => toggleProcType("staged"));

    // Add stage item
    document.getElementById("btn-stage-add").addEventListener("click", async () => {
      const targetId = this.selectedBatchRecipe;
      const recipe = state.config.batchRecipes[targetId];
      const stageName = document.getElementById("stage-new-name").value.trim();
      const stationId = document.getElementById("stage-new-station").value;
      const duration = parseInt(document.getElementById("stage-new-duration").value) || 0;

      if (!stageName) {
        alert("Enter a stage name!");
        return;
      }

      const currentStages = recipe.stages ? [...recipe.stages] : [];
      currentStages.push({
        stage_name: stageName,
        station_id: stationId,
        duration_min: duration
      });

      if (window.AlokaAPI.isOnline()) {
        try {
          await window.AlokaAPI.patch(`/inventory/batch-recipes/${targetId}`, { stages: currentStages });
          await window.AlokaAPI.loadAllState();
        } catch (err) { alert(err.message); }
      } else {
        window.AutoBrixStore.updateState(s => {
          if (s.config.batchRecipes[targetId]) {
            s.config.batchRecipes[targetId].stages = currentStages;
          }
        });
      }
      document.getElementById("stage-new-name").value = "";
      document.getElementById("stage-new-duration").value = "";
      this.updateActiveTabContent();
    });

    // Add Ing to Recipe
    document.getElementById("btn-batch-add-ing").addEventListener("click", async () => {
      const targetId = this.selectedBatchRecipe;
      const rawId = document.getElementById("batch-add-raw-id").value;
      const ratio = parseFloat(document.getElementById("batch-add-ratio").value);
      const unit = document.getElementById("batch-add-unit").value;

      if (isNaN(ratio) || ratio <= 0) {
        alert("Enter a valid ratio!");
        return;
      }

      if (window.AlokaAPI.isOnline()) {
        try {
          await window.AlokaAPI.put(`/inventory/batch-recipes/${targetId}/ingredients/${rawId}`, {
            ratio_per_unit: ratio,
            unit: unit
          });
          await window.AlokaAPI.loadAllState();
        } catch (err) { alert(err.message); }
      } else {
        window.AutoBrixStore.updateState(s => {
          if (s.config.batchRecipes[targetId]) {
            s.config.batchRecipes[targetId].rawIngredients[rawId] = ratio;
          }
        });
      }
      document.getElementById("batch-add-ratio").value = "";
      this.updateActiveTabContent();
    });

    // Logger morning batch submit
    document.getElementById("btn-batch-produce").addEventListener("click", async () => {
      const targetId = batchTarget.value;
      const inputQty = parseFloat(document.getElementById("batch-input-qty").value);
      const actualQty = parseFloat(document.getElementById("batch-actual-qty").value);

      if (isNaN(inputQty) || isNaN(actualQty) || inputQty <= 0 || actualQty <= 0) {
        alert("Enter valid numeric quantities for inputs and yield!");
        return;
      }

      if (window.AlokaAPI.isOnline()) {
        try {
          const res = await window.AlokaAPI.post('/inventory/batch-produce', {
            recipe_id: targetId,
            input_qty: inputQty,
            actual_yield: actualQty
          });
          alert(`Success!\nExpected Yield: ${parseFloat(res.expected).toFixed(0)}\nActual Yield: ${res.actual}\nYield Efficiency: ${parseFloat(res.yieldPct).toFixed(1)}%\nWaste: ${parseFloat(res.waste).toFixed(0)}`);
          await window.AlokaAPI.loadAllState();
        } catch (err) {
          alert("Error logging batch yield: " + err.message);
        }
      } else {
        const res = window.AutoBrixStore.produceBatch(targetId, inputQty, actualQty);
        if (res) {
          alert(`Success!\nExpected Yield: ${res.expected.toFixed(0)}\nActual Yield: ${res.actual.toFixed(0)}\nYield Efficiency: ${res.yieldPct.toFixed(1)}%\nWaste: ${res.waste.toFixed(0)}`);
        }
      }

      document.getElementById("batch-input-qty").value = "";
      document.getElementById("batch-actual-qty").value = "";
      this.updateActiveTabContent();
    });

    // Raw ingredient Add Submit
    document.getElementById("raw-add-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("raw-add-name").value.trim();
      const pUnit = document.getElementById("raw-add-punit").value;
      const sUnit = document.getElementById("raw-add-sunit").value;
      const conv = parseFloat(document.getElementById("raw-add-conv").value) || 1000;
      const minStock = parseFloat(document.getElementById("raw-add-min").value) || 0;
      const cost = parseFloat(document.getElementById("raw-add-cost").value) || 0;
      const supplier = document.getElementById("raw-add-supplier").value.trim();

      if (!name) return;
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

      if (window.AlokaAPI.isOnline()) {
        try {
          await window.AlokaAPI.post('/inventory/raw', {
            id, name, stock: 0, min_stock: minStock * conv,
            purchase_unit: pUnit, stock_unit: sUnit,
            conversion_factor: conv, cost_per_purchase_unit: cost,
            supplier: supplier
          });
          await window.AlokaAPI.loadAllState();
          alert("Raw ingredient added successfully!");
        } catch (err) {
          alert("Error adding raw material: " + err.message);
        }
      } else {
        window.AutoBrixStore.updateState(s => {
          s.inventory.raw[id] = {
            name, stock: 0, reserved: 0, minStock: minStock * conv,
            purchaseUnit: pUnit, stockUnit: sUnit,
            conversionFactor: conv, costPerPurchaseUnit: cost,
            supplier: supplier
          };
        });
      }
      document.getElementById("raw-add-name").value = "";
      document.getElementById("raw-add-supplier").value = "";
      this.updateActiveTabContent();
    });
  }

  async updateBatchRecipeIng(targetId, rawId, ratio) {
    const val = parseFloat(ratio);
    if (window.AlokaAPI.isOnline()) {
      try {
        await window.AlokaAPI.put(`/inventory/batch-recipes/${targetId}/ingredients/${rawId}`, {
          ratio_per_unit: val
        });
        await window.AlokaAPI.loadAllState();
      } catch (err) { alert(err.message); }
    } else {
      window.AutoBrixStore.updateState(s => {
        if (s.config.batchRecipes[targetId]) {
          if (val <= 0) {
            delete s.config.batchRecipes[targetId].rawIngredients[rawId];
          } else {
            s.config.batchRecipes[targetId].rawIngredients[rawId] = val;
          }
        }
      });
    }
    this.updateActiveTabContent();
  }

  async removeBatchStage(targetId, index) {
    const state = window.AutoBrixStore.state;
    const recipe = state.config.batchRecipes[targetId];
    if (!recipe || !recipe.stages) return;
    
    const newStages = recipe.stages.filter((_, i) => i !== index);

    if (window.AlokaAPI.isOnline()) {
      try {
        await window.AlokaAPI.patch(`/inventory/batch-recipes/${targetId}`, { stages: newStages });
        await window.AlokaAPI.loadAllState();
      } catch (err) { alert(err.message); }
    } else {
      window.AutoBrixStore.updateState(s => {
        if (s.config.batchRecipes[targetId]) {
          s.config.batchRecipes[targetId].stages = newStages;
        }
      });
    }
    this.updateActiveTabContent();
  }

  async updateRawIngredientField(rawId, field, value) {
    let parsedVal = value;
    if (['min_stock', 'cost_per_purchase_unit'].includes(field)) {
      parsedVal = parseFloat(value);
    }
    if (window.AlokaAPI.isOnline()) {
      try {
        const body = {};
        body[field] = parsedVal;
        await window.AlokaAPI.patch(`/inventory/raw/${rawId}`, body);
        await window.AlokaAPI.loadAllState();
      } catch (err) { alert(err.message); }
    } else {
      window.AutoBrixStore.updateState(s => {
        if (s.inventory.raw[rawId]) {
          const mapField = field === 'min_stock' ? 'minStock' : (field === 'cost_per_purchase_unit' ? 'costPerPurchaseUnit' : field);
          s.inventory.raw[rawId][mapField] = parsedVal;
        }
      });
    }
  }

  // ==========================================
  // TAB: Purchase & Expenditures
  // ==========================================
  async loadExpendituresData(state) {
    if (!this.expenditurePeriodFilter) this.expenditurePeriodFilter = "today";
    if (!this.expenditureStartDate) this.expenditureStartDate = new Date().toISOString().split("T")[0];
    if (!this.expenditureEndDate) this.expenditureEndDate = new Date().toISOString().split("T")[0];

    if (window.AlokaAPI.isOnline()) {
      try {
        let path = '/expenses';
        if (this.expenditurePeriodFilter === 'today') {
          path += `?date=${new Date().toISOString().split("T")[0]}`;
        } else if (this.expenditurePeriodFilter === 'month') {
          const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
          path += `?month=${currentMonth}`;
        } else if (this.expenditurePeriodFilter === 'all') {
          path += '?all=true';
        } else if (this.expenditurePeriodFilter === 'custom') {
          path += `?start_date=${this.expenditureStartDate}&end_date=${this.expenditureEndDate}`;
        }
        const filtered = await window.AlokaAPI.get(path);
        state.expenses = filtered.map(exp => ({
          id: exp.id,
          date: exp.expense_date.split('T')[0],
          item: exp.item_name,
          quantity: parseFloat(exp.quantity),
          unit: exp.unit,
          cost: parseFloat(exp.cost),
          supplier: exp.supplier,
          raw_ingredient_id: exp.raw_ingredient_id
        }));
      } catch (err) {
        console.error("Failed to load filtered expenses:", err);
      }
    } else {
      let filtered = [...state.expenses];
      const todayStr = new Date().toISOString().split("T")[0];
      if (this.expenditurePeriodFilter === 'today') {
        filtered = filtered.filter(exp => exp.date === todayStr);
      } else if (this.expenditurePeriodFilter === 'month') {
        const currentMonth = todayStr.slice(0, 7); // YYYY-MM
        filtered = filtered.filter(exp => exp.date.startsWith(currentMonth));
      } else if (this.expenditurePeriodFilter === 'custom') {
        filtered = filtered.filter(exp => exp.date >= this.expenditureStartDate && exp.date <= this.expenditureEndDate);
      }
      this.localFilteredExpenses = filtered;
    }
  }

  renderExpendituresTab(container, state) {
    if (!this.expenditureFormType) this.expenditureFormType = "general";
    if (!this.expenditurePeriodFilter) this.expenditurePeriodFilter = "today";
    if (!this.bevSizes) this.bevSizes = ["100ml", "250ml", "500ml", "1L", "2L"];
    if (this.selectedBevSizeIdx === undefined) this.selectedBevSizeIdx = 2;

    const customItems = state.customExpenseItems || [];
    const suppliers = state.customSuppliers || [];

    const utilitySuggestions = [
      "Electricity Bill", "Gas Bill", "Mobile Recharge", "Rent", "Salary Payment",
      "Internet/Wi-Fi Bill", "Water Supply Bill", "Raw Chicken", "Paneer", "Flour",
      "Cooking Oil", "Onions", "Capsicum", "Raw Noodles", "Raw Pasta",
      "Cheese Block", "Mix Spices", "Sauces & Condiments", "Ghugni Peas", "Chole Chana"
    ];
    const combinedItems = Array.from(new Set([...utilitySuggestions, ...customItems]));

    const listExpenses = window.AlokaAPI.isOnline() ? state.expenses : (this.localFilteredExpenses || state.expenses);
    const totalPeriodCost = listExpenses.reduce((sum, exp) => sum + exp.cost, 0);

    let periodTitle = "Today's Purchases";
    if (this.expenditurePeriodFilter === 'month') periodTitle = "This Month's Purchases";
    else if (this.expenditurePeriodFilter === 'all') periodTitle = "All-Time Purchases";
    else if (this.expenditurePeriodFilter === 'custom') periodTitle = `Purchases: ${this.expenditureStartDate} to ${this.expenditureEndDate}`;

    container.innerHTML = `
      <div class="glass-card" style="margin-bottom:1rem; padding:1rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
        <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
          <span style="font-size:0.8rem; font-weight:700; color:var(--text-secondary); text-transform:uppercase;">Show Period:</span>
          <div class="nav-buttons" style="gap:4px; display:inline-flex; background:rgba(0,0,0,0.2); padding:2px; border-radius:6px;">
            <button class="nav-btn ${this.expenditurePeriodFilter === 'today' ? 'active' : ''}" id="btn-filter-today" style="padding:4px 10px; font-size:0.75rem; border-radius:4px; margin:0; height:26px;">Today</button>
            <button class="nav-btn ${this.expenditurePeriodFilter === 'month' ? 'active' : ''}" id="btn-filter-month" style="padding:4px 10px; font-size:0.75rem; border-radius:4px; margin:0; height:26px;">This Month</button>
            <button class="nav-btn ${this.expenditurePeriodFilter === 'all' ? 'active' : ''}" id="btn-filter-all" style="padding:4px 10px; font-size:0.75rem; border-radius:4px; margin:0; height:26px;">All Time</button>
            <button class="nav-btn ${this.expenditurePeriodFilter === 'custom' ? 'active' : ''}" id="btn-filter-custom" style="padding:4px 10px; font-size:0.75rem; border-radius:4px; margin:0; height:26px;">Custom Range</button>
          </div>
          
          <div id="custom-date-inputs" style="display:${this.expenditurePeriodFilter === 'custom' ? 'flex' : 'none'}; align-items:center; gap:6px;">
            <input type="date" class="pos-input-sm" id="filter-start-date" value="${this.expenditureStartDate}" style="height:28px; padding:2px 6px; font-size:0.75rem;">
            <span style="font-size:0.75rem; color:var(--text-secondary);">to</span>
            <input type="date" class="pos-input-sm" id="filter-end-date" value="${this.expenditureEndDate}" style="height:28px; padding:2px 6px; font-size:0.75rem;">
            <button class="pos-action-btn primary" id="btn-apply-custom-filter" style="padding:2px 8px; font-size:0.75rem; height:28px; margin:0;">Apply</button>
          </div>
        </div>

        <div style="display:flex; gap:1.5rem; align-items:center;">
          <div style="text-align:right;">
            <span style="font-size:0.7rem; color:var(--text-secondary); text-transform:uppercase; display:block;">Total Expenditure</span>
            <span style="font-size:1.3rem; font-weight:700; color:var(--color-warning); font-family:var(--font-mono);">₹${totalPeriodCost.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div class="batch-editor-panel" style="display:grid; grid-template-columns: 1.1fr 0.9fr; gap:1.5rem;">
        
        <!-- Left: Form to record expense -->
        <div class="glass-card">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.06); padding-bottom:0.5rem; margin-bottom:0.75rem;">
            <h4 class="modal-section-title" style="margin-bottom:0;">Record Purchase / Bill</h4>
            <div class="nav-buttons" style="gap:4px; display:inline-flex; background:rgba(0,0,0,0.2); padding:2px; border-radius:6px;">
              <button class="nav-btn ${this.expenditureFormType === 'general' ? 'active' : ''}" id="btn-form-general" style="padding:4px 10px; font-size:0.75rem; border-radius:4px; margin:0; height:26px;">General / Bill</button>
              <button class="nav-btn ${this.expenditureFormType === 'beverage' ? 'active' : ''}" id="btn-form-beverage" style="padding:4px 10px; font-size:0.75rem; border-radius:4px; margin:0; height:26px;">Beverages</button>
              <button class="nav-btn ${this.expenditureFormType === 'egg' ? 'active' : ''}" id="btn-form-egg" style="padding:4px 10px; font-size:0.75rem; border-radius:4px; margin:0; height:26px;">Eggs</button>
            </div>
          </div>

          <div id="purchase-form-container">
            ${this.renderActivePurchaseForm(state, combinedItems, suppliers)}
          </div>
        </div>

        <!-- Right: Recent expenditures list & Audit Logs -->
        <div style="display:flex; flex-direction:column; gap:1.5rem;">
          
          <div class="glass-card" style="flex:1; display:flex; flex-direction:column; min-height:420px;">
            <h4 class="modal-section-title" style="margin-bottom:0.75rem;">${periodTitle}</h4>
            <div class="owner-table-wrapper" style="border:none; flex-grow:1; max-height:450px; overflow-y:auto;">
              <table class="owner-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Cost</th>
                    <th>Supplier</th>
                    <th style="text-align:center; width:45px;">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  ${listExpenses.length === 0 
                    ? `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:2rem;">No purchases logged for this period.</td></tr>` 
                    : listExpenses.map(exp => `
                      <tr>
                        <td style="font-size:0.75rem; color:var(--text-secondary); white-space:nowrap;">${exp.date || exp.expense_date.split('T')[0]}</td>
                        <td><strong>${exp.item || exp.item_name}</strong></td>
                        <td>${exp.quantity} ${exp.unit}</td>
                        <td style="font-family:var(--font-mono); font-weight:600;">₹${exp.cost}</td>
                        <td style="font-size:0.75rem;">${exp.supplier}</td>
                        <td style="text-align:center;">
                          <button class="k-item-btn" onclick="ownerPanel.handleDeleteExpense('${exp.id}')" style="color:var(--color-critical); padding:2px 6px; background:var(--color-critical-bg); border-color:rgba(239,68,68,0.2); border-radius:4px;">🗑️</button>
                        </td>
                      </tr>
                    `).join("")}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>
    `;

    this.bindExpenditureEvents(state);
  }

  renderActivePurchaseForm(state, combinedItems, suppliers) {
    if (this.expenditureFormType === 'beverage') {
      return `
        <div style="display:flex; flex-direction:column; gap:0.75rem;">
          <div style="display:flex; flex-direction:column; gap:0.25rem;">
            <label class="form-label-xs">Date</label>
            <input type="date" class="pos-input-sm" id="exp-date" value="${new Date().toISOString().split("T")[0]}">
          </div>

          <div style="display:flex; flex-direction:column; gap:0.25rem;">
            <label class="form-label-xs">Beverage Name (e.g. Pepsi, Water, Sprite)</label>
            <input type="text" class="pos-input-sm" id="bev-name-input" placeholder="Enter beverage name (e.g. Pepsi)" required list="bev-brands-suggest">
            <datalist id="bev-brands-suggest">
              <option value="Pepsi">
              <option value="Water">
              <option value="7up">
              <option value="Mirinda">
              <option value="Mountain Dew">
              <option value="Sprite">
              <option value="Coca Cola">
              <option value="Fanta">
            </datalist>
          </div>

          <div style="display:flex; flex-direction:column; gap:0.25rem;">
            <label class="form-label-xs">Container Type</label>
            <div style="display:flex; gap:0.75rem; margin-top:2px;">
              <label style="font-size:0.8rem; display:inline-flex; align-items:center; gap:4px; cursor:pointer;">
                <input type="radio" name="bev-container-radio" value="plastic" checked style="accent-color:var(--accent-color);"> Plastic Bottle
              </label>
              <label style="font-size:0.8rem; display:inline-flex; align-items:center; gap:4px; cursor:pointer;">
                <input type="radio" name="bev-container-radio" value="glass" style="accent-color:var(--accent-color);"> Glass Bottle
              </label>
              <label style="font-size:0.8rem; display:inline-flex; align-items:center; gap:4px; cursor:pointer;">
                <input type="radio" name="bev-container-radio" value="can" style="accent-color:var(--accent-color);"> Can
              </label>
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:0.25rem;">
            <label class="form-label-xs">Volume / Size Presets (Edit labels, select one to purchase)</label>
            <div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:4px; background:rgba(0,0,0,0.1); padding:4px; border-radius:6px;">
              ${this.bevSizes.map((sz, idx) => `
                <div style="display:flex; flex-direction:column; align-items:center; gap:4px; background:rgba(255,255,255,0.02); padding:4px; border-radius:4px; border: 1px solid ${this.selectedBevSizeIdx === idx ? 'var(--accent-color)' : 'transparent'};">
                  <input type="radio" name="bev-size-select-radio" value="${idx}" ${this.selectedBevSizeIdx === idx ? 'checked' : ''} style="cursor:pointer; accent-color:var(--accent-color);">
                  <input type="text" class="owner-input-cell bev-size-label-input" data-index="${idx}" value="${sz}" style="width:100%; text-align:center; font-size:0.75rem; padding:2px; height:22px;">
                </div>
              `).join("")}
            </div>
          </div>

          <div style="display:flex; gap:0.5rem;">
            <div style="flex:1; display:flex; flex-direction:column; gap:2px;">
              <label class="form-label-xs">Qty Purchased (pcs)</label>
              <input type="number" class="pos-input-sm" id="exp-qty" placeholder="e.g. 24" required min="1">
            </div>
            <div style="flex:1; display:flex; flex-direction:column; gap:2px;">
              <label class="form-label-xs">Total Cost (₹)</label>
              <input type="number" class="pos-input-sm" id="exp-cost" placeholder="e.g. 480" required min="1">
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:0.25rem;">
            <label class="form-label-xs">Supplier Name</label>
            <input type="text" class="pos-input-sm" id="exp-supplier-input" list="suppliers-list" placeholder="Select or type..." required>
          </div>

          <datalist id="suppliers-list">
            ${suppliers.map(sup => `<option value="${sup}">`).join("")}
          </datalist>

          <button class="pos-action-btn primary" id="btn-save-beverage-purchase" style="margin-top:0.5rem;">Log Beverage Purchase</button>
        </div>
      `;
    } else if (this.expenditureFormType === 'egg') {
      return `
        <div style="display:flex; flex-direction:column; gap:0.75rem;">
          <div style="display:flex; flex-direction:column; gap:0.25rem;">
            <label class="form-label-xs">Date</label>
            <input type="date" class="pos-input-sm" id="exp-date" value="${new Date().toISOString().split("T")[0]}">
          </div>

          <div style="display:flex; gap:0.5rem;">
            <div style="flex:1; display:flex; flex-direction:column; gap:2px;">
              <label class="form-label-xs">Cartons Purchased</label>
              <input type="number" class="pos-input-sm" id="egg-qty-cartons" placeholder="e.g. 2" required min="1">
            </div>
            <div style="flex:1; display:flex; flex-direction:column; gap:2px;">
              <label class="form-label-xs">Price Per Carton (₹)</label>
              <input type="number" class="pos-input-sm" id="egg-carton-price" placeholder="e.g. 1200" required min="1">
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:0.25rem;">
            <label class="form-label-xs">Total Purchase Cost (₹)</label>
            <input type="number" class="pos-input-sm" id="exp-cost" placeholder="Auto-calculated" required min="1">
          </div>



          <div style="display:flex; flex-direction:column; gap:0.25rem;">
            <label class="form-label-xs">Supplier Name</label>
            <input type="text" class="pos-input-sm" id="exp-supplier-input" list="suppliers-list" value="Egg Vendor" required>
          </div>

          <datalist id="suppliers-list">
            ${suppliers.map(sup => `<option value="${sup}">`).join("")}
          </datalist>

          <button class="pos-action-btn primary" id="btn-save-egg-purchase" style="margin-top:0.5rem;">Log Egg Purchase</button>
        </div>
      `;
    } else {
      return `
        <div style="display:flex; flex-direction:column; gap:0.75rem;">
          <div style="display:flex; flex-direction:column; gap:0.25rem;">
            <label class="form-label-xs">Date</label>
            <input type="date" class="pos-input-sm" id="exp-date" value="${new Date().toISOString().split("T")[0]}">
          </div>

          <div style="display:flex; flex-direction:column; gap:0.25rem;">
            <label class="form-label-xs">Item Name / Category</label>
            <input type="text" class="pos-input-sm" id="exp-item-input" list="expense-items-list" placeholder="Select or type item name..." required>
            <datalist id="expense-items-list">
              ${combinedItems.map(item => `<option value="${item}">`).join("")}
            </datalist>
          </div>

          <div style="display:flex; gap:0.5rem;">
            <div style="flex:1; display:flex; flex-direction:column; gap:2px;">
              <label class="form-label-xs">Quantity</label>
              <input type="number" step="0.1" class="pos-input-sm" id="exp-qty" value="1.0" required>
            </div>
            <div style="width:120px; display:flex; flex-direction:column; gap:2px;">
              <label class="form-label-xs">Unit</label>
              <select class="pos-select-sm" id="exp-unit-select" style="width:100%;">
                <option value="pcs">pcs</option>
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="L">L</option>
                <option value="ml">ml</option>
                <option value="dozens">dozens</option>
                <option value="packets">packets</option>
                <option value="boxes">boxes</option>
                <option value="bags">bags</option>
              </select>
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:0.25rem;">
            <label class="form-label-xs">Total Cost (₹)</label>
            <input type="number" class="pos-input-sm" id="exp-cost" placeholder="Total Cost" required>
          </div>

          <div style="display:flex; flex-direction:column; gap:0.25rem;">
            <label class="form-label-xs">Supplier Name</label>
            <input type="text" class="pos-input-sm" id="exp-supplier-input" list="suppliers-list" placeholder="Select or type supplier..." required>
            <datalist id="suppliers-list">
              ${suppliers.map(sup => `<option value="${sup}">`).join("")}
            </datalist>
          </div>

          <button class="pos-action-btn primary" id="btn-add-expense" style="margin-top:0.5rem;">Save Expenditure</button>
        </div>
      `;
    }
  }

  bindExpenditureEvents(state) {
    const formTypes = ['general', 'beverage', 'egg'];
    formTypes.forEach(type => {
      const btn = document.getElementById(`btn-form-${type}`);
      if (btn) {
        btn.addEventListener("click", () => {
          this.expenditureFormType = type;
          this.updateActiveTabContent();
        });
      }
    });

    const periods = ['today', 'month', 'all', 'custom'];
    periods.forEach(p => {
      const btn = document.getElementById(`btn-filter-${p}`);
      if (btn) {
        btn.addEventListener("click", () => {
          this.expenditurePeriodFilter = p;
          this.updateActiveTabContent();
        });
      }
    });

    const applyFilterBtn = document.getElementById("btn-apply-custom-filter");
    if (applyFilterBtn) {
      applyFilterBtn.addEventListener("click", () => {
        this.expenditureStartDate = document.getElementById("filter-start-date").value;
        this.expenditureEndDate = document.getElementById("filter-end-date").value;
        this.updateActiveTabContent();
      });
    }

    if (this.expenditureFormType === 'general') {
      const itemInput = document.getElementById("exp-item-input");
      const unitSelect = document.getElementById("exp-unit-select");
      if (itemInput && unitSelect) {
        itemInput.addEventListener("input", () => {
          const val = itemInput.value.trim();
          const matchingRaw = Object.values(state.inventory.raw).find(r => r.name.toLowerCase() === val.toLowerCase());
          if (matchingRaw) {
            unitSelect.value = matchingRaw.purchaseUnit;
          }
        });
      }

      const saveBtn = document.getElementById("btn-add-expense");
      if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
          const date = document.getElementById("exp-date").value;
          const name = itemInput.value.trim();
          const qtyVal = document.getElementById("exp-qty").value;
          const qty = qtyVal === "" ? 1.0 : parseFloat(qtyVal);
          const unit = unitSelect.value;
          const cost = parseFloat(document.getElementById("exp-cost").value);
          const supplier = document.getElementById("exp-supplier-input").value.trim();

          if (!name || isNaN(qty) || qty <= 0 || isNaN(cost) || cost <= 0) {
            alert("Please enter a valid item name, quantity, and cost!");
            return;
          }

          const rawEntry = Object.entries(state.inventory.raw).find(([k, r]) => r.name.toLowerCase() === name.toLowerCase());
          const rawId = rawEntry ? rawEntry[0] : null;

          if (window.AlokaAPI.isOnline()) {
            try {
              await window.AlokaAPI.post('/expenses', {
                expense_date: date,
                item_name: name,
                quantity: qty,
                unit: unit,
                cost: cost,
                supplier: supplier,
                raw_ingredient_id: rawId
              });
              await window.AlokaAPI.loadAllState();
              alert("Expenditure recorded!");
            } catch (err) {
              alert("Error saving expenditure: " + err.message);
            }
          } else {
            window.AutoBrixStore.addExpense({
              date: date,
              item: name,
              quantity: qty,
              unit: unit,
              cost: cost,
              supplier: supplier,
              raw_ingredient_id: rawId
            });
          }
          this.updateActiveTabContent();
        });
      }
    }

    if (this.expenditureFormType === 'beverage') {
      const sizeRadioGroup = document.getElementsByName("bev-size-select-radio");
      const sizeLabelInputs = document.querySelectorAll(".bev-size-label-input");

      sizeRadioGroup.forEach(radio => {
        radio.addEventListener("change", (e) => {
          this.selectedBevSizeIdx = parseInt(e.target.value);
        });
      });

      sizeLabelInputs.forEach(input => {
        input.addEventListener("change", (e) => {
          const idx = parseInt(e.target.dataset.index);
          this.bevSizes[idx] = e.target.value.trim() || this.bevSizes[idx];
        });
      });

      const saveBevBtn = document.getElementById("btn-save-beverage-purchase");
      if (saveBevBtn) {
        saveBevBtn.addEventListener("click", async () => {
          const date = document.getElementById("exp-date").value;
          const brandName = document.getElementById("bev-name-input").value.trim();
          const container = document.querySelector("input[name='bev-container-radio']:checked").value;
          const size = this.bevSizes[this.selectedBevSizeIdx];
          const qty = parseFloat(document.getElementById("exp-qty").value);
          const cost = parseFloat(document.getElementById("exp-cost").value);
          const supplier = document.getElementById("exp-supplier-input").value.trim();

          if (!brandName || !size || isNaN(qty) || qty <= 0 || isNaN(cost) || cost <= 0) {
            alert("Please fill in all beverage fields correctly (brand, size, qty, cost must be greater than zero)!");
            return;
          }

          const brandVal = brandName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
          const containerLabels = { plastic: "Plastic Bottle", glass: "Glass Bottle", can: "Can" };
          const containerLabel = containerLabels[container] || container;
          const variantId = `${size.toLowerCase()}_${container.toLowerCase()}`;
          const rawId = `${brandVal}_${variantId}`;
          const variantName = `${size} ${containerLabel}`;
          const itemFullName = `${brandName} ${variantName}`;

          const defaultSellingPrice = Math.round((cost / qty) * 1.30);

          const beverageData = {
            brandVal,
            brandName,
            size,
            container,
            sellingPrice: defaultSellingPrice
          };

          if (window.AlokaAPI.isOnline()) {
            try {
              const menuItems = state.config.menuItems;
              const existingItem = menuItems[brandVal];
              if (!existingItem) {
                const formData = new FormData();
                formData.append("id", brandVal);
                formData.append("name", brandVal === 'water' ? 'Water Bottle' : brandName);
                formData.append("station_id", "reception");
                formData.append("prep_time", "1");
                formData.append("active", "1");
                await window.AlokaAPI.postForm('/menu', formData);
                await window.AlokaAPI.patch(`/menu/${brandVal}`, { food_type: 'veg' });
              }

              const existingRaw = state.inventory.raw[rawId];
              if (!existingRaw) {
                await window.AlokaAPI.post('/inventory/raw', {
                  id: rawId,
                  name: itemFullName,
                  stock: 0,
                  min_stock: 12,
                  purchase_unit: 'pcs',
                  stock_unit: 'pcs',
                  conversion_factor: 1.0,
                  cost_per_purchase_unit: cost / qty,
                  supplier: supplier
                });
              }

              const dbVariantId = `${brandVal}_${variantId}`;
              const hasVariant = existingItem && existingItem.variants[variantId];
              if (!hasVariant) {
                await window.AlokaAPI.post(`/menu/${brandVal}/variants`, {
                  variantId: dbVariantId,
                  name: variantName,
                  price: defaultSellingPrice,
                  recipe_multiplier: 1.0
                });
              }

              await window.AlokaAPI.put(`/menu/${brandVal}/recipe/${rawId}`, {
                quantity: 1.0,
                ingredient_type: 'raw',
                unit: 'pcs'
              });

              await window.AlokaAPI.post('/expenses', {
                expense_date: date,
                item_name: itemFullName,
                quantity: qty,
                unit: 'pcs',
                cost: cost,
                supplier: supplier,
                raw_ingredient_id: rawId
              });

              await window.AlokaAPI.loadAllState();
              alert(`Beverage purchase logged and menu updated for ${itemFullName}!`);
            } catch (err) {
              alert("Error saving online beverage purchase: " + err.message);
            }
          } else {
            window.AutoBrixStore.addExpense({
              date: date,
              item: itemFullName,
              quantity: qty,
              unit: 'pcs',
              cost: cost,
              supplier: supplier,
              raw_ingredient_id: rawId,
              beverageData: beverageData
            });
            alert(`Beverage purchase logged locally for ${itemFullName}!`);
          }
          this.updateActiveTabContent();
        });
      }
    }

    if (this.expenditureFormType === 'egg') {
      const qtyCartonsInput = document.getElementById("egg-qty-cartons");
      const cartonPriceInput = document.getElementById("egg-carton-price");
      const totalCostInput = document.getElementById("exp-cost");

      const calcTotalEggCost = () => {
        const qty = parseFloat(qtyCartonsInput.value) || 0;
        const price = parseFloat(cartonPriceInput.value) || 0;
        totalCostInput.value = qty * price || "";
      };

      qtyCartonsInput.addEventListener("input", calcTotalEggCost);
      cartonPriceInput.addEventListener("input", calcTotalEggCost);

      const saveEggBtn = document.getElementById("btn-save-egg-purchase");
      if (saveEggBtn) {
        saveEggBtn.addEventListener("click", async () => {
          const date = document.getElementById("exp-date").value;
          const qtyCartons = parseFloat(qtyCartonsInput.value);
          const cartonPrice = parseFloat(cartonPriceInput.value);
          const totalCost = parseFloat(totalCostInput.value);
          const supplier = document.getElementById("exp-supplier-input").value.trim();

          if (isNaN(qtyCartons) || qtyCartons <= 0 || isNaN(cartonPrice) || cartonPrice <= 0 || isNaN(totalCost) || totalCost <= 0) {
            alert("Please fill all egg purchase fields correctly!");
            return;
          }

          if (window.AlokaAPI.isOnline()) {
            try {
              const existingItem = state.config.menuItems.egg;
              if (!existingItem) {
                const formData = new FormData();
                formData.append("id", "egg");
                formData.append("name", "Egg");
                formData.append("station_id", "reception");
                formData.append("prep_time", "1");
                formData.append("active", "1");
                await window.AlokaAPI.postForm('/menu', formData);
                await window.AlokaAPI.patch(`/menu/egg`, { food_type: 'egg' });
              }

              await window.AlokaAPI.put(`/menu/egg/recipe/egg`, {
                quantity: 1.0,
                ingredient_type: 'raw',
                unit: 'pcs'
              });

              await window.AlokaAPI.post('/expenses', {
                expense_date: date,
                item_name: 'Egg Carton',
                quantity: qtyCartons,
                unit: 'cartons',
                cost: totalCost,
                supplier: supplier,
                raw_ingredient_id: 'egg'
              });

              await window.AlokaAPI.loadAllState();
              alert(`Egg purchase logged. Stock increased by ${qtyCartons * 210} eggs!`);
            } catch (err) {
              alert("Error saving online egg purchase: " + err.message);
            }
          } else {
            window.AutoBrixStore.addExpense({
              date: date,
              item: 'Egg Carton',
              quantity: qtyCartons,
              unit: 'cartons',
              cost: totalCost,
              supplier: supplier,
              raw_ingredient_id: 'egg'
            });
            alert(`Egg purchase logged locally!`);
          }
          this.updateActiveTabContent();
        });
      }
    }
  }

  async handleDeleteExpense(expenseId) {
    if (confirm("Are you sure you want to delete this expenditure log?")) {
      if (window.AlokaAPI.isOnline()) {
        try {
          await window.AlokaAPI.del(`/expenses/${expenseId}`);
          await window.AlokaAPI.loadAllState();
          alert("Expenditure log deleted!");
        } catch (err) {
          alert("Error deleting expenditure: " + err.message);
        }
      } else {
        window.AutoBrixStore.deleteExpense(expenseId);
        alert("Expenditure log deleted locally!");
      }
      this.updateActiveTabContent();
    }
  }
}

// Bind globally
window.OwnerPanel = OwnerPanel;
