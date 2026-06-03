// AutoBrix Owner / Admin Dashboard Module

class OwnerPanel {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.activeTab = "analytics"; // analytics, menu, recipes, stations, labor, inventory, expenditures
    this.selectedRecipeItem = null;
    this.selectedBatchRecipe = null;
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
          <button class="owner-tab-btn ${this.activeTab === "menu" ? "active" : ""}" data-tab="menu">Menu & Margins</button>
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
                    <td style="color:var(--color-success); font-weight:600;">₹${day.revenue.toFixed(2)}</td>
                    <td style="color:var(--color-warning);">₹${day.expenses.toFixed(2)}</td>
                    <td style="color:${day.netProfit >= 0 ? "var(--color-success)" : "var(--color-critical)"}; font-weight:600;">
                      ₹${day.netProfit.toFixed(2)}
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
        <h4 class="modal-section-title" style="margin-bottom:0.75rem;">Menu Configurator & Margins Tool</h4>
        <div class="owner-table-wrapper" style="border:none;">
          <table class="owner-table">
            <thead>
              <tr>
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
              </tr>
            </thead>
            <tbody id="menu-rows-container"></tbody>
          </table>
        </div>
      </div>

      <!-- Add New Item Form -->
      <div class="glass-card" style="margin-top:1.5rem;">
        <h4 class="modal-section-title" style="margin-bottom:0.75rem;">Add New Menu Item</h4>
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
            <input type="text" class="pos-input-sm" id="menu-add-variant" value="Single" placeholder="e.g. Single">
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
      </div>
    `;

    const tbody = document.getElementById("menu-rows-container");
    tbody.innerHTML = Object.values(state.config.menuItems).flatMap(item => {
      return Object.entries(item.variants).map(([vId, v]) => {
        const marginInfo = window.AutoBrixStore.calculateMenuItemMargin(item.id, vId);
        
        let marginClass = "good";
        if (marginInfo.marginPct < 40) marginClass = "poor";
        
        const imageUrl = item.image ? (item.image.startsWith('http') ? item.image : `http://localhost:3001${item.image}`) : '';

        return `
          <tr>
            <td>
              ${item.image 
                ? `<img src="${imageUrl}" style="width:40px; height:40px; border-radius:4px; object-fit:cover; border:1px solid rgba(255,255,255,0.1);">` 
                : `<div style="width:40px; height:40px; border-radius:4px; background:rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center; font-size:0.7rem; color:var(--text-muted);">No Img</div>`}
            </td>
            <td><strong>${item.name}</strong></td>
            <td>
              <select class="pos-select-sm" onchange="ownerPanel.updateItemStation('${item.id}', this.value)" style="padding:2px 4px; font-size:0.8rem; width:100%;">
                ${Object.keys(state.config.stations).map(s => `<option value="${s}" ${item.station === s ? "selected" : ""}>${state.config.stations[s].name}</option>`).join("")}
              </select>
            </td>
            <td>
              <input type="number" class="owner-input-cell" value="${item.prepTime}" onchange="ownerPanel.updateItemPrepTime('${item.id}', this.value)" style="width:50px; padding:2px;">
            </td>
            <td><span class="badge badge-normal" style="font-size:0.7rem;">${v.name}</span></td>
            <td>
              <input type="number" class="owner-input-cell" value="${v.price}" onchange="ownerPanel.updateItemPrice('${item.id}', '${vId}', this.value)">
            </td>
            <td style="font-family:var(--font-mono);">₹${marginInfo.cost.toFixed(2)}</td>
            <td style="font-family:var(--font-mono); color:var(--color-success); font-weight:600;">₹${marginInfo.margin.toFixed(2)}</td>
            <td>
              <span class="margin-badge ${marginClass}">${marginInfo.marginPct}%</span>
            </td>
            <td>
              <input type="checkbox" ${item.active ? "checked" : ""} onchange="ownerPanel.toggleItemActive('${item.id}', this.checked)">
            </td>
          </tr>
        `;
      });
    }).join("");

    // Form Listener
    document.getElementById("menu-add-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("menu-add-name").value.trim();
      const prepTime = parseInt(document.getElementById("menu-add-preptime").value) || 3;
      const stationId = document.getElementById("menu-add-station").value;
      const variantName = document.getElementById("menu-add-variant").value.trim() || "Single";
      const price = parseFloat(document.getElementById("menu-add-price").value) || 0;
      const imageFile = document.getElementById("menu-add-image").files[0];

      if (!name) return;
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

      if (window.AlokaAPI.isOnline()) {
        try {
          const formData = new FormData();
          formData.append("id", id);
          formData.append("name", name);
          formData.append("station_id", stationId);
          formData.append("prep_time", prepTime);
          formData.append("active", "1");
          if (imageFile) {
            formData.append("image", imageFile);
          }

          await window.AlokaAPI.postForm('/menu', formData);
          
          await window.AlokaAPI.post(`/menu/${id}/variants`, {
            variantId: `${id}_single`,
            name: variantName,
            price: price,
            recipe_multiplier: 1.0
          });

          await window.AlokaAPI.loadAllState();
          alert("Menu item added successfully!");
        } catch (err) {
          alert("Error adding menu item: " + err.message);
        }
      } else {
        const itemData = {
          id,
          name,
          station: stationId,
          prepTime,
          image: null,
          variants: {
            single: { name: variantName, price, recipeMultiplier: 1.0 }
          },
          recipe: {}
        };
        window.AutoBrixStore.addMenuItem(itemData);
      }
      this.updateActiveTabContent();
    });
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
        await window.AlokaAPI.patch(`/menu/${itemId}/variants/${variantId}`, { price: parseFloat(price) });
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
