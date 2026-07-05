// api.js — HTTP API Bridge for AlokaFastFood
// Replaces localStorage calls with MySQL-backed REST API
// Falls back gracefully to localStorage if server is unreachable

const API_BASE = 'http://localhost:3001/api';

window.AlokaAPI = {
  _online: false,

  async ping() {
    try {
      const r = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
      // Server is reachable if we get ANY HTTP response.
      // Check if DB is also connected (our health endpoint returns {db:'connected'} when ok).
      const body = await r.json().catch(() => ({}));
      this._online = true;          // server is up
      this._dbOk = (body.db === 'connected');
    } catch {
      this._online = false;
      this._dbOk   = false;
    }
    return this._online;
  },

  isOnline() { return this._online; },
  isDbOk()   { return this._dbOk;   },


  async get(path) {
    const r = await fetch(`${API_BASE}${path}`);
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  async post(path, data) {
    const r = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  async postForm(path, formData) {
    const r = await fetch(`${API_BASE}${path}`, { method: 'POST', body: formData });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  async patch(path, data) {
    const r = await fetch(`${API_BASE}${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  async patchForm(path, formData) {
    const r = await fetch(`${API_BASE}${path}`, { method: 'PATCH', body: formData });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  async put(path, data) {
    const r = await fetch(`${API_BASE}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  async del(path) {
    const r = await fetch(`${API_BASE}${path}`, { method: 'DELETE' });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  // High-level helpers
  async loadAllState() {
    const [menuItems, stations, workers, rawInv, intermediateInv, batchRecipes,
           expenses, orders, auditLogs, dayHistory, customItems, suppliers, eggTracking] = await Promise.all([
      this.get('/menu'),
      this.get('/stations'),
      this.get('/workers'),
      this.get('/inventory/raw'),
      this.get('/inventory/intermediate'),
      this.get('/inventory/batch-recipes'),
      this.get('/expenses'),
      this.get('/orders'),
      this.get('/orders/audit-logs'),
      this.get('/orders/day-history'),
      this.get('/expenses/custom-items'),
      this.get('/expenses/suppliers'),
      this.get('/inventory/egg-tracking')
    ]);

    // Transform DB rows into the shape AutoBrixStore.state expects
    const menuMap = {};
    menuItems.forEach(item => {
      const variants = {};
      (item.variants || []).forEach(v => {
        const key = v.name.toLowerCase();
        variants[key] = {
          id: v.id,
          name: v.name,
          price: parseFloat(v.price) || 0,
          recipeMultiplier: parseFloat(v.recipe_multiplier) || 1.0
        };
      });
      const recipe = {};
      (item.recipe || []).forEach(r => { recipe[r.ingredient_id] = r.quantity; });
      menuMap[item.id] = {
        id: item.id,
        name: item.name,
        station: item.station_id,
        prepTime: item.prep_time,
        active: !!item.active,
        image: item.image_path || null,
        foodType: item.food_type || 'non-veg',
        sortOrder: item.sort_order || 0,
        variants,
        recipe
      };
    });

    const stationsMap = {};
    stations.forEach(s => { stationsMap[s.id] = { id: s.id, name: s.name, baseCapacity: s.base_capacity, currentWorkerId: s.current_worker_id || null }; });

    const workersArr = workers.map(w => ({
      id: w.id,
      name: w.name,
      stations: w.stations || [],
      dailySalary: w.daily_salary || 0,
      active: !!w.active
    }));

    const rawMap = {};
    rawInv.forEach(r => { rawMap[r.id] = {
      name: r.name, stock: +r.stock, reserved: +r.reserved, minStock: +r.min_stock,
      purchaseUnit: r.purchase_unit, stockUnit: r.stock_unit,
      conversionFactor: +r.conversion_factor, costPerPurchaseUnit: +r.cost_per_purchase_unit,
      supplier: r.supplier
    }; });

    const interMap = {}, prepMap = {};
    intermediateInv.forEach(i => {
      const obj = { name: i.name, stock: +i.stock, reserved: +i.reserved, minStock: +i.min_stock, unit: i.unit };
      if (i.item_type === 'prepared') prepMap[i.id] = obj;
      else interMap[i.id] = obj;
    });

    const batchMap = {};
    batchRecipes.forEach(r => {
      const rawIngredients = {};
      (r.ingredients || []).forEach(ing => { rawIngredients[ing.raw_ingredient_id] = +ing.ratio_per_unit; });
      batchMap[r.id] = {
        name: r.name, unit: r.unit,
        rawIngredients,
        expectedYieldRatio: +r.expected_yield_ratio,
        processingType: r.processing_type,
        stages: r.stages || []
      };
    });

    // Patch AutoBrixStore state
    const store = window.AutoBrixStore;
    store.state.config.menuItems = menuMap;
    store.state.config.stations = stationsMap;
    store.state.config.workers = workersArr;
    store.state.config.batchRecipes = batchMap;
    store.state.inventory.raw = rawMap;
    store.state.inventory.intermediate = interMap;
    store.state.inventory.prepared = prepMap;
    store.state.expenses = expenses.map(exp => ({
      id: exp.id,
      date: exp.expense_date ? exp.expense_date.split('T')[0] : '',
      item: exp.item_name,
      quantity: parseFloat(exp.quantity) || 0,
      unit: exp.unit,
      cost: parseFloat(exp.cost) || 0,
      supplier: exp.supplier,
      raw_ingredient_id: exp.raw_ingredient_id
    }));
    store.state.orders = orders.map(o => ({
      id: o.id,
      customerName: o.customer_name || "Walk-In",
      source: o.source || "DINE_IN",
      priority: o.priority || "NORMAL",
      subtotal: +o.subtotal || 0,
      tax: +o.tax || 0,
      total: +o.total || 0,
      commission: +o.commission || 0,
      netRevenue: +o.net_revenue || 0,
      eta: o.eta || 0,
      fulfillmentStatus: o.fulfillment_status || "ACCEPTED",
      paymentStatus: o.payment_status || "UNPAID",
      timestamp: o.created_at || new Date().toISOString(),
      timestamps: {
        accepted: o.ts_accepted ? new Date(o.ts_accepted).toISOString() : null,
        cooking: o.ts_cooking ? new Date(o.ts_cooking).toISOString() : null,
        ready: o.ts_ready ? new Date(o.ts_ready).toISOString() : null,
        completed: o.ts_completed ? new Date(o.ts_completed).toISOString() : null
      },
      items: (o.items || []).map(it => ({
        id: it.menu_item_id,
        name: it.menu_item_name,
        variant: it.variant_id,
        variantName: it.variant_name,
        quantity: it.quantity,
        price: +it.unit_price,
        modifiers: typeof it.modifiers === 'string' ? JSON.parse(it.modifiers) : (it.modifiers || []),
        status: it.status
      }))
    }));
    store.state.auditLogs = auditLogs.map(l => ({
      timestamp: l.log_timestamp, user: l.actor, action: l.action, payload: l.payload
    }));
    store.state.dayHistory = dayHistory.map(d => ({
      date: d.report_date, orderCount: d.order_count,
      revenue: +d.revenue, expenses: +d.expenses, netProfit: +d.net_profit
    }));
    store.state.customExpenseItems = customItems;
    store.state.customSuppliers = suppliers;
    store.state.eggTrackingHistory = eggTracking;

    console.log('[AlokaAPI] State synced from MySQL ✓');
    store.saveToStorage();
    store.notifyListeners('mysql-sync');
  }
};

// Auto-init: ping server and load state if online
(async () => {
  let statusEl = document.getElementById('db-status-badge');
  if (!statusEl) {
    statusEl = document.createElement('div');
    statusEl.id = 'db-status-badge';
    statusEl.style.cssText = `
      position:fixed; bottom:12px; right:12px; z-index:9999;
      padding:6px 12px; border-radius:20px; font-size:0.7rem; font-weight:700;
      letter-spacing:0.05em; backdrop-filter:blur(8px); transition:all 0.3s;
      cursor:default;
    `;
    document.body.appendChild(statusEl);
  }

  const setStatus = (state, detail) => {
    if (state === 'online') {
      statusEl.textContent = '🟢 MySQL Connected';
      statusEl.style.background = 'rgba(16,185,129,0.2)';
      statusEl.style.color = '#10b981';
      statusEl.style.border = '1px solid rgba(16,185,129,0.4)';
      statusEl.title = '';
    } else if (state === 'warn') {
      statusEl.textContent = '🟠 Server OK — DB Error';
      statusEl.style.background = 'rgba(249,115,22,0.2)';
      statusEl.style.color = '#f97316';
      statusEl.style.border = '1px solid rgba(249,115,22,0.4)';
      statusEl.title = detail || '';
    } else {
      statusEl.textContent = '🟡 Offline (LocalStorage)';
      statusEl.style.background = 'rgba(245,158,11,0.2)';
      statusEl.style.color = '#f59e0b';
      statusEl.style.border = '1px solid rgba(245,158,11,0.4)';
      statusEl.title = detail || '';
    }
  };

  const tryConnect = async () => {
    const online = await window.AlokaAPI.ping();
    if (!online) {
      setStatus('offline', 'Server not running at http://localhost:3001');
      return false;
    }
    if (!window.AlokaAPI.isDbOk()) {
      setStatus('warn', 'Server is up but MySQL is not connected.\nCheck that MySQL is running and the database "alokaFastFood" exists.');
      return false;
    }
    setStatus('online');
    try {
      await window.AlokaAPI.loadAllState();
    } catch (e) {
      console.error('[AlokaAPI] Failed to load from MySQL:', e);
      setStatus('warn', e.message);
    }
    return true;
  };

  await tryConnect();

  // Retry every 30s if offline
  setInterval(async () => {
    if (!window.AlokaAPI.isOnline()) {
      await tryConnect();
    }
  }, 30000);
})();
