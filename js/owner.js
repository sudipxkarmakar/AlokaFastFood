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
    this.container.innerHTML = `
      <div class="owner-grid">
        <!-- Sidebar Tabs -->
        <div class="owner-sidebar">
          <button class="owner-tab-btn ${this.activeTab === "analytics" ? "active" : ""}" data-tab="analytics">Operations Report</button>
          <button class="owner-tab-btn ${this.activeTab === "menu" ? "active" : ""}" data-tab="menu">Menu</button>
          <button class="owner-tab-btn ${this.activeTab === "recipes" ? "active" : ""}" data-tab="recipes">Recipe Editor</button>
          <button class="owner-tab-btn ${this.activeTab === "stations" ? "active" : ""}" data-tab="stations">Station Management</button>
          <button class="owner-tab-btn ${this.activeTab === "labor" ? "active" : ""}" data-tab="labor">Employee</button>
          <button class="owner-tab-btn ${this.activeTab === "inventory" ? "active" : ""}" data-tab="inventory">Batch Prep & Stock</button>
          <button class="owner-tab-btn ${this.activeTab === "expenditures" ? "active" : ""}" data-tab="expenditures">Purchase Ledger</button>
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

  updateActiveTabContent() {
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

    const expenses = state.expenses.reduce((sum, exp) => sum + exp.cost, 0);
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
      
      <!-- Day Closing Trigger -->
      <div class="glass-card" style="display:flex; justify-content:space-between; align-items:center;">
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

  // ==========================================
  // TAB: Menu Management & Pricing
  // ==========================================
  renderMenuTab(container, state) {
    container.innerHTML = `
      <div class="glass-card">
        <h4 class="modal-section-title" style="margin-bottom:0.75rem;">Menu Configurator</h4>
        <div class="owner-table-wrapper" style="border:none;">
          <table class="owner-table">
            <thead>
              <tr>
                <th style="width: 40px;"></th>
                <th>Thumbnail</th>
                <th>Menu Item</th>
                <th>Station</th>
                <th>Prep Time (Min)</th>
                <th>Variant</th>
                <th>Price (₹)</th>
                <th>Food Cost</th>
                <th>Gross Margin</th>
                <th>Margin %</th>
                <th>Active</th>
                <th style="text-align:center;">Actions</th>
              </tr>
            </thead>
            <tbody id="menu-rows-container"></tbody>
          </table>
        </div>
      </div>

      <!-- Add New Item Form / Generator Section -->
      <div class="glass-card" style="margin-top:1.5rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:0.75rem; margin-bottom:1rem;">
          <h4 class="modal-section-title" style="margin-bottom:0;">Menu Item Creator</h4>
          <div class="nav-buttons" style="gap:4px; display:inline-flex;">
            <button class="nav-btn ${this.menuFormTab !== 'generator' ? 'active' : ''}" id="btn-tab-single-item" style="padding:4px 10px; font-size:0.75rem; border-radius:4px; margin:0;">Single Item</button>
            <button class="nav-btn ${this.menuFormTab === 'generator' ? 'active' : ''}" id="btn-tab-smart-generator" style="padding:4px 10px; font-size:0.75rem; border-radius:4px; margin:0;">✨ Smart Generator</button>
          </div>
        </div>

        ${this.menuFormTab !== 'generator' ? `
        <form id="menu-add-form" style="display:flex; gap:0.75rem; flex-wrap:wrap; align-items:flex-end;">
          <div style="flex:1; min-width:160px; display:flex; flex-direction:column; gap:0.25rem;">
            <label class="form-label-xs">Item Name</label>
            <input type="text" class="pos-input-sm" id="menu-add-name" placeholder="e.g. Chicken Shawarma" required>
          </div>
          <div style="width:100px; display:flex; flex-direction:column; gap:0.25rem;">
            <label class="form-label-xs">Prep Time (Min)</label>
            <input type="number" class="pos-input-sm" id="menu-add-preptime" value="3" min="1" required>
          </div>
          <div style="width:150px; display:flex; flex-direction:column; gap:0.25rem;">
            <label class="form-label-xs">Assigned Station</label>
            <select class="pos-select-sm" id="menu-add-station" required style="width:100%;">
              ${Object.keys(state.config.stations).map(s => `<option value="${s}">${state.config.stations[s].name}</option>`).join("")}
            </select>
          </div>
          <div style="width:120px; display:flex; flex-direction:column; gap:0.25rem;">
            <label class="form-label-xs">Variant Name</label>
            <select class="pos-select-sm" id="menu-add-variant" style="width: 100%;">
              <option value="Single">Single</option>
              <option value="Half">Half</option>
              <option value="Full">Full</option>
            </select>
          </div>
          <div style="width:120px; display:flex; flex-direction:column; gap:0.25rem;">
            <label class="form-label-xs">Food Type</label>
            <select class="pos-select-sm" id="menu-add-foodtype" style="width: 100%;">
              <option value="non-veg">Non-Veg</option>
              <option value="veg">Veg</option>
              <option value="egg">Egg</option>
            </select>
          </div>
          <div style="width:100px; display:flex; flex-direction:column; gap:0.25rem;">
            <label class="form-label-xs">Price (₹)</label>
            <input type="number" class="pos-input-sm" id="menu-add-price" placeholder="Price" min="0" required>
          </div>
          <div style="flex:1; min-width:200px; display:flex; flex-direction:column; gap:0.25rem;">
            <label class="form-label-xs">Preview Image</label>
            <input type="file" id="menu-add-image" accept="image/*" class="pos-input-sm" style="padding:4px;">
          </div>
          <button type="submit" class="pos-action-btn primary" style="padding:0.35rem 1.25rem; grid-column:auto;">Add Menu Item</button>
        </form>
        ` : `
        <form id="menu-generator-form" style="display:flex; flex-direction:column; gap:1.25rem;">
          <div style="display:flex; gap:0.75rem; flex-wrap:wrap; align-items:flex-end;">
            <div style="flex:1; min-width:200px; display:flex; flex-direction:column; gap:0.25rem;">
              <label class="form-label-xs">Base Item Name (e.g. Chowmein, Roll, Pasta)</label>
              <div style="display:flex; gap:6px; align-items:center;">
                <input type="text" class="pos-input-sm" id="gen-base-name" placeholder="Enter base name..." required style="flex:1;">
                <button type="button" class="pos-action-btn secondary" style="padding:3px 6px; font-size:0.65rem; margin:0;" id="btn-fill-chowmein">Chowmein</button>
                <button type="button" class="pos-action-btn secondary" style="padding:3px 6px; font-size:0.65rem; margin:0;" id="btn-fill-roll">Roll</button>
                <button type="button" class="pos-action-btn secondary" style="padding:3px 6px; font-size:0.65rem; margin:0;" id="btn-fill-pasta">Pasta</button>
              </div>
            </div>

            <div style="width:100px; display:flex; flex-direction:column; gap:0.25rem;">
              <label class="form-label-xs">Prep Time (Min)</label>
              <input type="number" class="pos-input-sm" id="gen-preptime" value="3" min="1" required>
            </div>

            <div style="width:150px; display:flex; flex-direction:column; gap:0.25rem;">
              <label class="form-label-xs">Assigned Station</label>
              <select class="pos-select-sm" id="gen-station" required style="width:100%;">
                ${Object.keys(state.config.stations).map(s => `<option value="${s}">${state.config.stations[s].name}</option>`).join("")}
              </select>
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:0.25rem;">
            <span class="form-label-xs">Portion Configurations:</span>
            <div style="display:flex; gap:1.25rem; padding:0.5rem 0.75rem; background:rgba(0,0,0,0.15); border-radius:4px; align-self:flex-start;">
              <label style="font-size:0.8rem; display:inline-flex; align-items:center; gap:6px; cursor:pointer; font-weight:500;">
                <input type="radio" name="gen-portion-type" value="half_full" checked style="cursor:pointer; accent-color:var(--accent-color);">
                Half / Full Portion
              </label>
              <label style="font-size:0.8rem; display:inline-flex; align-items:center; gap:6px; cursor:pointer; font-weight:500;">
                <input type="radio" name="gen-portion-type" value="single" style="cursor:pointer; accent-color:var(--accent-color);">
                Single Piece / Portion
              </label>
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:0.25rem;">
            <span class="form-label-xs">Select Categories to Generate:</span>
            <div id="gen-category-checkboxes" style="display:flex; flex-wrap:wrap; gap:12px; padding:0.6rem 0.8rem; background:rgba(0,0,0,0.15); border-radius:4px;">
              <label style="font-size:0.75rem; display:inline-flex; align-items:center; gap:6px; cursor:pointer; font-weight:500;">
                <input type="checkbox" class="gen-cat-check" value="veg" checked style="accent-color:var(--accent-color);"> Veg (Plain)
              </label>
              <label style="font-size:0.75rem; display:inline-flex; align-items:center; gap:6px; cursor:pointer; font-weight:500;">
                <input type="checkbox" class="gen-cat-check" value="egg" checked style="accent-color:var(--accent-color);"> Egg
              </label>
              <label style="font-size:0.75rem; display:inline-flex; align-items:center; gap:6px; cursor:pointer; font-weight:500;">
                <input type="checkbox" class="gen-cat-check" value="chicken" checked style="accent-color:var(--accent-color);"> Chicken
              </label>
              <label style="font-size:0.75rem; display:inline-flex; align-items:center; gap:6px; cursor:pointer; font-weight:500;">
                <input type="checkbox" class="gen-cat-check" value="paneer" checked style="accent-color:var(--accent-color);"> Paneer
              </label>
              <label style="font-size:0.75rem; display:inline-flex; align-items:center; gap:6px; cursor:pointer; font-weight:500;">
                <input type="checkbox" class="gen-cat-check" value="egg_chicken" style="accent-color:var(--accent-color);"> Egg-Chicken (Combo)
              </label>
              <label style="font-size:0.75rem; display:inline-flex; align-items:center; gap:6px; cursor:pointer; font-weight:500;">
                <input type="checkbox" class="gen-cat-check" value="egg_paneer" style="accent-color:var(--accent-color);"> Egg-Paneer (Combo)
              </label>
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:0.25rem;">
            <span class="form-label-xs">Interactive Pricing Table:</span>
            <div class="owner-table-wrapper" style="border:1px solid var(--border-color); max-height:220px; overflow-y:auto; border-radius:4px; background:rgba(0,0,0,0.155);">
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

          <button type="submit" class="pos-action-btn primary" style="padding:0.4rem 1.5rem; grid-column:auto; align-self:flex-start; margin:0;">Generate Catalog Items</button>
        </form>
        `}
      </div>
    `;

    const tbody = document.getElementById("menu-rows-container");
    tbody.innerHTML = Object.values(state.config.menuItems)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .map(item => {
        const imageUrl = item.image ? (item.image.startsWith('http') || item.image.startsWith('data:') ? item.image : `http://localhost:3001${item.image}`) : '';
        
        const hasHalfAndFull = item.variants.half && item.variants.full;
        
        if (hasHalfAndFull) {
          const marginHalf = window.AutoBrixStore.calculateMenuItemMargin(item.id, 'half');
          const marginFull = window.AutoBrixStore.calculateMenuItemMargin(item.id, 'full');
          
          const marginHalfClass = marginHalf.marginPct >= 40 ? "good" : "poor";
          const marginFullClass = marginFull.marginPct >= 40 ? "good" : "poor";
          
          return `
            <tr draggable="true" data-id="${item.id}" class="draggable-row">
              <td class="drag-handle" style="cursor: grab; text-align: center; color: var(--text-muted); font-size: 1.1rem; user-select: none;">⠿</td>
              <td style="cursor: pointer; position: relative;" onclick="ownerPanel.openImageActionsModal('${item.id}')" title="Click to manage image">
                <div style="position: relative; width: 40px; height: 40px;">
                  ${item.image 
                    ? `<img src="${imageUrl}" style="width:40px; height:40px; border-radius:4px; object-fit:cover; border:1px solid rgba(255,255,255,0.1);">` 
                    : `<div style="width:40px; height:40px; border-radius:4px; background:rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center; font-size:0.7rem; color:var(--text-muted);">No Img</div>`}
                  <div class="food-type-indicator ${item.foodType || 'non-veg'}" style="position: absolute; top: -2px; right: -2px; z-index: 1;"></div>
                </div>
              </td>
              <td><strong>${item.name}</strong></td>
              <td>
                <select class="pos-select-sm" onchange="ownerPanel.updateItemStation('${item.id}', this.value)" style="padding:2px 4px; font-size:0.8rem; width:100%;">
                  ${Object.keys(state.config.stations).map(s => `<option value="${s}" ${item.station === s ? "selected" : ""}>${state.config.stations[s].name}</option>`).join("")}
                </select>
              </td>
              <td>
                <input type="text" class="owner-input-cell" value="${item.prepTime}" onchange="ownerPanel.updateItemPrepTime('${item.id}', this.value)" style="width:50px; padding:2px; text-align: center;">
              </td>
              <td><span class="badge badge-normal" style="font-size:0.7rem;">Half / Full</span></td>
              <td>
                <div style="display:flex; align-items:center; gap:4px; white-space: nowrap;">
                  <input type="text" class="owner-input-cell" value="${item.variants.half.price}" onchange="ownerPanel.updateItemPrice('${item.id}', 'half', this.value)" style="width:50px; text-align:center;">
                  <span style="color:var(--text-muted);">/</span>
                  <input type="text" class="owner-input-cell" value="${item.variants.full.price}" onchange="ownerPanel.updateItemPrice('${item.id}', 'full', this.value)" style="width:50px; text-align:center;">
                </div>
              </td>
              <td style="font-family:var(--font-mono); font-size:0.8rem; white-space: nowrap;">
                ₹${marginHalf.cost.toFixed(2)} <span style="color:var(--text-muted);">/</span> ₹${marginFull.cost.toFixed(2)}
              </td>
              <td style="font-family:var(--font-mono); font-size:0.8rem; white-space: nowrap; color:var(--color-success); font-weight:600;">
                ₹${marginHalf.margin.toFixed(2)} <span style="color:var(--text-muted);">/</span> ₹${marginFull.margin.toFixed(2)}
              </td>
              <td style="white-space: nowrap;">
                <span class="margin-badge ${marginHalfClass}">${marginHalf.marginPct}%</span>
                <span style="color:var(--text-muted);">/</span>
                <span class="margin-badge ${marginFullClass}">${marginFull.marginPct}%</span>
              </td>
              <td>
                <input type="checkbox" ${item.active ? "checked" : ""} onchange="ownerPanel.toggleItemActive('${item.id}', this.checked)">
              </td>
              <td style="text-align:center;">
                <button class="k-item-btn" onclick="ownerPanel.deleteMenuItem('${item.id}')" style="color:var(--color-critical); padding:4px 8px; margin:0; font-size:0.75rem; background:var(--color-critical-bg); border-color:rgba(239,68,68,0.35);">Delete</button>
              </td>
            </tr>
          `;
        } else {
          return Object.entries(item.variants).map(([vId, v]) => {
            const marginInfo = window.AutoBrixStore.calculateMenuItemMargin(item.id, vId);
            
            let marginClass = "good";
            if (marginInfo.marginPct < 40) marginClass = "poor";
            
            return `
              <tr draggable="true" data-id="${item.id}" class="draggable-row">
                <td class="drag-handle" style="cursor: grab; text-align: center; color: var(--text-muted); font-size: 1.1rem; user-select: none;">⠿</td>
                <td style="cursor: pointer; position: relative;" onclick="ownerPanel.openImageActionsModal('${item.id}')" title="Click to manage image">
                  <div style="position: relative; width: 40px; height: 40px;">
                    ${item.image 
                      ? `<img src="${imageUrl}" style="width:40px; height:40px; border-radius:4px; object-fit:cover; border:1px solid rgba(255,255,255,0.1);">` 
                      : `<div style="width:40px; height:40px; border-radius:4px; background:rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center; font-size:0.7rem; color:var(--text-muted);">No Img</div>`}
                    <div class="food-type-indicator ${item.foodType || 'non-veg'}" style="position: absolute; top: -2px; right: -2px; z-index: 1;"></div>
                  </div>
                </td>
                <td><strong>${item.name}</strong></td>
                <td>
                  <select class="pos-select-sm" onchange="ownerPanel.updateItemStation('${item.id}', this.value)" style="padding:2px 4px; font-size:0.8rem; width:100%;">
                    ${Object.keys(state.config.stations).map(s => `<option value="${s}" ${item.station === s ? "selected" : ""}>${state.config.stations[s].name}</option>`).join("")}
                  </select>
                </td>
                <td>
                  <input type="text" class="owner-input-cell" value="${item.prepTime}" onchange="ownerPanel.updateItemPrepTime('${item.id}', this.value)" style="width:50px; padding:2px; text-align: center;">
                </td>
                <td><span class="badge badge-normal" style="font-size:0.7rem;">${v.name}</span></td>
                <td>
                  <input type="text" class="owner-input-cell" value="${v.price}" onchange="ownerPanel.updateItemPrice('${item.id}', '${vId}', this.value)" style="text-align: center;">
                </td>
                <td style="font-family:var(--font-mono);">₹${marginInfo.cost.toFixed(2)}</td>
                <td style="font-family:var(--font-mono); color:var(--color-success); font-weight:600;">₹${marginInfo.margin.toFixed(2)}</td>
                <td>
                  <span class="margin-badge ${marginClass}">${marginInfo.marginPct}%</span>
                </td>
                <td>
                  <input type="checkbox" ${item.active ? "checked" : ""} onchange="ownerPanel.toggleItemActive('${item.id}', this.checked)">
                </td>
                <td style="text-align:center;">
                  <button class="k-item-btn" onclick="ownerPanel.deleteMenuItem('${item.id}')" style="color:var(--color-critical); padding:4px 8px; margin:0; font-size:0.75rem; background:var(--color-critical-bg); border-color:rgba(239,68,68,0.35);">Delete</button>
                </td>
              </tr>
            `;
          }).join("");
        }
      }).join("");

    this.bindMenuDragAndDrop();

    // Sub-tab switcher listeners
    const btnSingle = document.getElementById("btn-tab-single-item");
    const btnGen = document.getElementById("btn-tab-smart-generator");

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
      chicken: "Chicken",
      paneer: "Paneer",
      egg_chicken: "Egg Chicken",
      egg_paneer: "Egg Paneer"
    };

    const getFoodType = (cat) => {
      if (cat === 'veg') return 'veg';
      if (cat === 'egg') return 'egg';
      if (cat === 'paneer' || cat === 'egg_paneer') return 'veg';
      return 'non-veg';
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
            recipe: {}
          };
        });
      });
      window.AutoBrixStore.logAudit("Config Change", `Bulk generated ${itemsToCreate.length} item(s)`);
      alert(`Locally generated ${itemsToCreate.length} catalog item(s)!`);
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
    const tbody = document.getElementById("menu-rows-container");
    if (!tbody) return;

    let draggedRow = null;

    tbody.querySelectorAll(".draggable-row").forEach((row, currentIndex, allRows) => {
      // Drag-and-drop listeners
      row.addEventListener("dragstart", (e) => {
        draggedRow = row;
        row.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
      });

      row.addEventListener("dragover", (e) => {
        e.preventDefault();
        const target = e.target.closest(".draggable-row");
        if (target && target !== draggedRow) {
          const rect = target.getBoundingClientRect();
          const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
          tbody.insertBefore(draggedRow, next ? target.nextSibling : target);
        }
      });

      row.addEventListener("dragend", async () => {
        row.classList.remove("dragging");
        
        const newOrder = Array.from(tbody.querySelectorAll(".draggable-row")).map(r => r.dataset.id);
        const uniqueOrder = Array.from(new Set(newOrder));

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

            const newOrder = reorderedRows.map(r => r.dataset.id);
            const uniqueOrder = Array.from(new Set(newOrder));

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
  }

  // ==========================================
  // TAB: Station Management
  // ==========================================
  renderStationsTab(container, state) {
    container.innerHTML = `
      <div class="glass-card">
        <h4 class="modal-section-title" style="margin-bottom:0.75rem;">Station Management</h4>
        <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:1rem;">
          Add or remove operational kitchen stations. Active workers can cover multiple stations at once.
        </p>
        
        <div class="owner-table-wrapper" style="border:none; margin-bottom:1.5rem;">
          <table class="owner-table">
            <thead>
              <tr>
                <th>Station ID</th>
                <th>Station Name</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${Object.values(state.config.stations).map(station => `
                <tr>
                  <td><code style="font-family:var(--font-mono);">${station.id}</code></td>
                  <td><strong>${station.name}</strong></td>
                  <td>
                    <button class="k-item-btn" onclick="ownerPanel.deleteStation('${station.id}')" style="color:var(--color-critical); padding:2px 6px;">Remove Station</button>
                  </td>
                </tr>
              `).join("")}
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
  // TAB: Purchase Ledger & Expenditures
  // ==========================================
  renderExpendituresTab(container, state) {
    // Collect unique expense item names and suppliers for combo list datalist suggestions
    const customItems = state.customExpenseItems || [];
    const suppliers = state.customSuppliers || [];

    // Combine raw names and custom items
    const rawNames = Object.values(state.inventory.raw).map(r => r.name);
    const combinedItems = Array.from(new Set([...rawNames, ...customItems]));

    container.innerHTML = `
      <div class="batch-editor-panel" style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem;">
        
        <!-- Left: Form to record expense -->
        <div class="glass-card">
          <h4 class="modal-section-title" style="margin-bottom:0.75rem;">Record Purchase Expense</h4>
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
                <input type="number" step="0.1" class="pos-input-sm" id="exp-qty" placeholder="1.0" required>
              </div>
              <div style="width:120px; display:flex; flex-direction:column; gap:2px;">
                <label class="form-label-xs">Unit</label>
                <select class="pos-select-sm" id="exp-unit-select" style="width:100%;">
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="L">L</option>
                  <option value="ml">ml</option>
                  <option value="pcs">pcs</option>
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

            <button class="pos-action-btn primary" id="btn-add-expense" style="grid-column:auto; margin-top:0.5rem;">Save Expenditure</button>
          </div>
        </div>

        <!-- Right: Recent expenditures list & Audit Logs -->
        <div style="display:flex; flex-direction:column; gap:1.5rem;">
          
          <div class="glass-card" style="flex:1;">
            <h4 class="modal-section-title" style="margin-bottom:0.75rem;">Today's Purchases Ledger</h4>
            <div class="owner-table-wrapper" style="border:none; max-height:220px; overflow-y:auto;">
              <table class="owner-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Cost</th>
                    <th>Supplier</th>
                  </tr>
                </thead>
                <tbody>
                  ${state.expenses.length === 0 
                    ? `<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:1rem;">No expenditures logged today.</td></tr>` 
                    : state.expenses.map(exp => `
                      <tr>
                        <td><strong>${exp.item_name || exp.item}</strong></td>
                        <td>${exp.quantity} ${exp.unit}</td>
                        <td style="font-family:var(--font-mono); font-weight:600;">₹${exp.cost}</td>
                        <td>${exp.supplier}</td>
                      </tr>
                    `).join("")}
                </tbody>
              </table>
            </div>
          </div>

          <div class="glass-card" style="flex:1; display:flex; flex-direction:column; overflow:hidden;">
            <h4 class="modal-section-title" style="margin-bottom:0.75rem;">System Configuration Audit logs</h4>
            <div class="audit-logs-container" style="max-height:180px; overflow-y:auto; font-size:0.75rem;">
              ${state.auditLogs.map(log => `
                <div class="audit-log-row" style="padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.03);">
                  <div class="audit-log-meta" style="color:var(--text-muted); display:flex; justify-content:space-between; margin-bottom:2px;">
                    <span>${new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span>${log.user}</span>
                  </div>
                  <div>
                    <span class="audit-log-action" style="color:var(--accent-color);">${log.action}:</span>
                    <span>${log.payload}</span>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>

        </div>

      </div>
    `;

    // Dropdown auto unit mapping for Raw Ingredients
    const itemInput = document.getElementById("exp-item-input");
    const unitSelect = document.getElementById("exp-unit-select");
    
    itemInput.addEventListener("input", () => {
      const val = itemInput.value.trim();
      const matchingRaw = Object.values(state.inventory.raw).find(r => r.name.toLowerCase() === val.toLowerCase());
      if (matchingRaw) {
        unitSelect.value = matchingRaw.purchaseUnit;
      }
    });

    document.getElementById("btn-add-expense").addEventListener("click", async () => {
      const date = document.getElementById("exp-date").value;
      const name = itemInput.value.trim();
      const qty = parseFloat(document.getElementById("exp-qty").value);
      const unit = unitSelect.value;
      const cost = parseFloat(document.getElementById("exp-cost").value);
      const supplier = document.getElementById("exp-supplier-input").value.trim();

      if (!name || isNaN(qty) || qty <= 0 || isNaN(cost) || cost <= 0) {
        alert("Please enter a valid item name, quantity, and cost!");
        return;
      }

      // Link to raw ingredient ID if it matches
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
          supplier: supplier
        });
      }

      itemInput.value = "";
      document.getElementById("exp-qty").value = "";
      document.getElementById("exp-cost").value = "";
      document.getElementById("exp-supplier-input").value = "";
      this.updateActiveTabContent();
    });
  }
}

// Bind globally
window.OwnerPanel = OwnerPanel;
