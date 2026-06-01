// AutoBrix State Store & Logic Engine (Layer 1 & Layer 2)

const STATIONS_DEFAULT = {
  tawa: { id: "tawa", name: "Tawa", baseCapacity: 1 },
  prep: { id: "prep", name: "Prep", baseCapacity: 1 },
  reception: { id: "reception", name: "Reception", baseCapacity: 1 },
  deep_fry: { id: "deep_fry", name: "Deep Fry", baseCapacity: 1 },
  kosha: { id: "kosha", name: "Kosha", baseCapacity: 1 },
  chilley: { id: "chilley", name: "Chilley", baseCapacity: 1 },
  moghlai: { id: "moghlai", name: "Mughlai", baseCapacity: 1 },
  moghlai_tawa: { id: "moghlai_tawa", name: "Mughlai Tawa", baseCapacity: 1 },
  cleaner: { id: "cleaner", name: "Cleaner", baseCapacity: 1 },
  server: { id: "server", name: "Server", baseCapacity: 1 }
};

const BATCH_RECIPES_DEFAULT = {
  chicken_keema: {
    name: "Chicken Keema",
    unit: "g",
    rawIngredients: { raw_chicken: 1.25, onion: 0.1, oil: 0.05, spices: 0.02 }, // ingredients needed per 1g of output
    expectedYieldRatio: 0.8 // 1.25kg raw chicken yields 1kg keema (1.25 * 0.8 = 1.0)
  },
  paneer_keema: {
    name: "Paneer Keema",
    unit: "g",
    rawIngredients: { paneer: 1.0, onion: 0.1, oil: 0.05, spices: 0.02 },
    expectedYieldRatio: 0.95
  },
  chicken_kosha_gravy: {
    name: "Chicken Kosha Gravy",
    unit: "portions",
    rawIngredients: { raw_chicken: 250, onion: 50, oil: 20, spices: 20 }, // per 1 portion
    expectedYieldRatio: 1.0
  },
  pakora_mixture: {
    name: "Chicken Pakora Mixture",
    unit: "g",
    rawIngredients: { raw_chicken: 1.1, oil: 0.05, spices: 0.02 },
    expectedYieldRatio: 0.9
  },
  paratha_base: {
    name: "Paratha Base",
    unit: "pcs",
    rawIngredients: { flour: 50, oil: 10 }, // per 1 pc
    expectedYieldRatio: 1.0
  },
  mughlai_dough: {
    name: "Mughlai Dough",
    unit: "pcs",
    rawIngredients: { flour: 80, oil: 10 },
    expectedYieldRatio: 1.0
  },
  chowmein_base: {
    name: "Chowmein Base",
    unit: "portions",
    rawIngredients: { noodles: 80, oil: 10 },
    expectedYieldRatio: 1.0
  },
  pasta_base: {
    name: "Pasta Base",
    unit: "portions",
    rawIngredients: { pasta: 80, oil: 10 },
    expectedYieldRatio: 1.0
  }
};

const MENU_DEFAULT = {
  chicken_roll: {
    id: "chicken_roll",
    name: "Chicken Roll",
    station: "tawa",
    prepTime: 3,
    active: true,
    variants: {
      single: { name: "Single", price: 90, recipeMultiplier: 1.0 }
    },
    recipe: { chicken_keema: 80, paratha_base: 1, onion: 20, sauce: 10 }
  },
  egg_roll: {
    id: "egg_roll",
    name: "Egg Roll",
    station: "tawa",
    prepTime: 3,
    active: true,
    variants: {
      single: { name: "Single", price: 60, recipeMultiplier: 1.0 }
    },
    recipe: { paratha_base: 1, egg: 1, onion: 20, sauce: 10 }
  },
  chicken_chowmein: {
    id: "chicken_chowmein",
    name: "Chicken Chowmein",
    station: "chilley",
    prepTime: 4,
    active: true,
    variants: {
      half: { name: "Half", price: 70, recipeMultiplier: 1.0 },
      full: { name: "Full", price: 120, recipeMultiplier: 1.8 }
    },
    recipe: { chicken_keema: 60, chowmein_base: 1, onion: 20, capsicum: 20, sauce: 10 }
  },
  chicken_pasta: {
    id: "chicken_pasta",
    name: "Chicken Pasta",
    station: "chilley",
    prepTime: 4,
    active: true,
    variants: {
      half: { name: "Half", price: 80, recipeMultiplier: 1.0 },
      full: { name: "Full", price: 140, recipeMultiplier: 1.8 }
    },
    recipe: { chicken_keema: 60, pasta_base: 1, onion: 10, capsicum: 10, sauce: 10 }
  },
  mughlai_paratha: {
    id: "mughlai_paratha",
    name: "Mughlai Paratha",
    station: "moghlai",
    prepTime: 5,
    active: true,
    variants: {
      single: { name: "Single", price: 120, recipeMultiplier: 1.0 }
    },
    recipe: { chicken_keema: 120, mughlai_dough: 1, egg: 2, onion: 50, oil: 50 }
  },
  chicken_pakora: {
    id: "chicken_pakora",
    name: "Chicken Pakora",
    station: "deep_fry",
    prepTime: 4,
    active: true,
    variants: {
      single: { name: "Single", price: 100, recipeMultiplier: 1.0 }
    },
    recipe: { pakora_mixture: 150, oil: 50 }
  },
  chicken_kosha: {
    id: "chicken_kosha",
    name: "Chicken Kosha",
    station: "kosha",
    prepTime: 5,
    active: true,
    variants: {
      half: { name: "Half Portion", price: 100, recipeMultiplier: 1.0 },
      full: { name: "Full Portion", price: 180, recipeMultiplier: 1.8 }
    },
    recipe: { chicken_kosha_gravy: 1 }
  },
  veg_chowmein: {
    id: "veg_chowmein",
    name: "Veg Chowmein",
    station: "chilley",
    prepTime: 4,
    active: true,
    variants: {
      half: { name: "Half", price: 50, recipeMultiplier: 1.0 },
      full: { name: "Full", price: 90, recipeMultiplier: 1.8 }
    },
    recipe: { chowmein_base: 1, onion: 20, capsicum: 20, sauce: 10 }
  }
};

const MODIFIERS_DEFAULT = {
  extra_chicken: { id: "extra_chicken", name: "Extra Chicken", price: 25, recipe: { chicken_keema: 40 } },
  extra_cheese: { id: "extra_cheese", name: "Extra Cheese", price: 15, recipe: { cheese: 20 } },
  extra_egg: { id: "extra_egg", name: "Extra Egg", price: 10, recipe: { egg: 1 } },
  no_onion: { id: "no_onion", name: "No Onion", price: 0, recipe: { onion: -20 } }
};

const WORKERS_DEFAULT = [
  { id: "w1", name: "Raju", stations: ["tawa"], prepTime: 3, active: true },
  { id: "w2", name: "Sanjay", stations: ["tawa", "prep"], prepTime: 4, active: true },
  { id: "w3", name: "Amit", stations: ["prep"], prepTime: 3, active: true },
  { id: "w4", name: "Bikram", stations: ["moghlai", "moghlai_tawa"], prepTime: 4, active: true },
  { id: "w5", name: "Joy", stations: ["deep_fry"], prepTime: 3, active: true },
  { id: "w6", name: "Kunal", stations: ["kosha", "chilley"], prepTime: 5, active: true },
  { id: "w7", name: "Debu", stations: ["server", "reception"], prepTime: 5, active: true }
];

const RAW_DEFAULT = {
  raw_chicken: { name: "Raw Chicken", stock: 20000, reserved: 0, minStock: 5000, purchaseUnit: "kg", stockUnit: "g", conversionFactor: 1000, costPerPurchaseUnit: 220, supplier: "Apex Poultry" },
  paneer: { name: "Paneer", stock: 10000, reserved: 0, minStock: 2000, purchaseUnit: "kg", stockUnit: "g", conversionFactor: 1000, costPerPurchaseUnit: 350, supplier: "Maa Dairy" },
  flour: { name: "Flour", stock: 50000, reserved: 0, minStock: 10000, purchaseUnit: "kg", stockUnit: "g", conversionFactor: 1000, costPerPurchaseUnit: 40, supplier: "Ganesh Flour Mill" },
  egg: { name: "Egg", stock: 120, reserved: 0, minStock: 30, purchaseUnit: "pcs", stockUnit: "pcs", conversionFactor: 1, costPerPurchaseUnit: 6, supplier: "Egg Vendor" },
  oil: { name: "Cooking Oil", stock: 15000, reserved: 0, minStock: 3000, purchaseUnit: "L", stockUnit: "ml", conversionFactor: 1000, costPerPurchaseUnit: 140, supplier: "Fortune Retail" },
  onion: { name: "Onions", stock: 15000, reserved: 0, minStock: 3000, purchaseUnit: "kg", stockUnit: "g", conversionFactor: 1000, costPerPurchaseUnit: 40, supplier: "Sabji Mandi" },
  capsicum: { name: "Capsicum", stock: 5000, reserved: 0, minStock: 1500, purchaseUnit: "kg", stockUnit: "g", conversionFactor: 1000, costPerPurchaseUnit: 80, supplier: "Sabji Mandi" },
  noodles: { name: "Raw Noodles", stock: 10000, reserved: 0, minStock: 2000, purchaseUnit: "kg", stockUnit: "g", conversionFactor: 1000, costPerPurchaseUnit: 60, supplier: "Chong noodles" },
  pasta: { name: "Raw Pasta", stock: 10000, reserved: 0, minStock: 2000, purchaseUnit: "kg", stockUnit: "g", conversionFactor: 1000, costPerPurchaseUnit: 80, supplier: "Fortune Retail" },
  cheese: { name: "Cheese Block", stock: 5000, reserved: 0, minStock: 1000, purchaseUnit: "kg", stockUnit: "g", conversionFactor: 1000, costPerPurchaseUnit: 400, supplier: "Amul Store" },
  spices: { name: "Mix Spices", stock: 2000, reserved: 0, minStock: 500, purchaseUnit: "kg", stockUnit: "g", conversionFactor: 1000, costPerPurchaseUnit: 300, supplier: "Sunrise Spices" },
  sauce: { name: "Sauces & Condiments", stock: 5000, reserved: 0, minStock: 1000, purchaseUnit: "kg", stockUnit: "g", conversionFactor: 1000, costPerPurchaseUnit: 80, supplier: "Kissan Depot" }
};

const INTERMEDIATE_DEFAULT = {
  chicken_keema: { name: "Chicken Keema", stock: 8000, reserved: 0, minStock: 1500, unit: "g" },
  paneer_keema: { name: "Paneer Keema", stock: 3000, reserved: 0, minStock: 1000, unit: "g" },
  chicken_kosha_gravy: { name: "Chicken Kosha Gravy", stock: 20, reserved: 0, minStock: 5, unit: "portions" },
  pakora_mixture: { name: "Chicken Pakora Mixture", stock: 4000, reserved: 0, minStock: 1000, unit: "g" }
};

const PREPARED_DEFAULT = {
  paratha_base: { name: "Paratha Base", stock: 150, reserved: 0, minStock: 30, unit: "pcs" },
  mughlai_dough: { name: "Mughlai Dough", stock: 40, reserved: 0, minStock: 10, unit: "pcs" },
  chowmein_base: { name: "Chowmein Base", stock: 50, reserved: 0, minStock: 10, unit: "portions" },
  pasta_base: { name: "Pasta Base", stock: 30, reserved: 0, minStock: 10, unit: "portions" }
};

const SETTINGS_DEFAULT = {
  gstRate: 5,
  rushThresholds: [5, 10, 20],
  rushMultipliers: [1.0, 1.1, 1.25, 1.5],
  defaultOrderPriority: "NORMAL",
  dayClosingTime: "23:30"
};

const SOURCES_DEFAULT = {
  DINE_IN: { name: "Dine-In", commissionPct: 0, fee: 0 },
  TAKEAWAY: { name: "Takeaway", commissionPct: 0, fee: 0 },
  SWIGGY: { name: "Swiggy", commissionPct: 22, fee: 0 },
  ZOMATO: { name: "Zomato", commissionPct: 22, fee: 0 },
  PHONE_ORDER: { name: "Phone Order", commissionPct: 0, fee: 0 }
};

class AutoBrixStore {
  constructor() {
    this.storageKey = "autobrix_state";
    this.broadcastChannel = new BroadcastChannel("autobrix_sync");
    
    this.state = {
      config: {
        menuItems: MENU_DEFAULT,
        modifiers: MODIFIERS_DEFAULT,
        batchRecipes: BATCH_RECIPES_DEFAULT,
        stations: STATIONS_DEFAULT,
        workers: WORKERS_DEFAULT,
        settings: SETTINGS_DEFAULT,
        sources: SOURCES_DEFAULT
      },
      orders: [],
      inventory: {
        raw: RAW_DEFAULT,
        intermediate: INTERMEDIATE_DEFAULT,
        prepared: PREPARED_DEFAULT
      },
      expenses: [],
      auditLogs: [],
      dayHistory: []
    };

    this.listeners = [];
    
    // Load state
    this.loadFromStorage();

    // Listen for tab sync
    this.broadcastChannel.onmessage = (event) => {
      if (event.data && event.data.type === "STATE_UPDATED") {
        this.loadFromStorage();
        this.notifyListeners("sync");
      }
    };

    // Listen to localstorage event from other windows
    window.addEventListener("storage", (e) => {
      if (e.key === this.storageKey) {
        this.loadFromStorage();
        this.notifyListeners("sync");
      }
    });
  }

  // --- Persistence Layers ---
  loadFromStorage() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        // Merge structures carefully
        this.state.config = parsed.config || this.state.config;
        this.state.orders = parsed.orders || [];
        this.state.inventory = parsed.inventory || this.state.inventory;
        this.state.expenses = parsed.expenses || [];
        this.state.auditLogs = parsed.auditLogs || [];
        this.state.dayHistory = parsed.dayHistory || [];
      } else {
        this.saveToStorage();
      }
    } catch (e) {
      console.error("Failed to load AutoBrix state", e);
    }
  }

  saveToStorage() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.state));
    } catch (e) {
      console.error("Failed to save AutoBrix state", e);
    }
  }

  broadcastState() {
    this.broadcastChannel.postMessage({ type: "STATE_UPDATED" });
  }

  updateState(updaterFn) {
    updaterFn(this.state);
    this.saveToStorage();
    this.broadcastState();
    this.notifyListeners("update");
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notifyListeners(reason) {
    this.listeners.forEach(l => l(this.state, reason));
  }

  // --- Audit Logging ---
  logAudit(action, payload) {
    const log = {
      timestamp: new Date().toISOString(),
      user: "System Admin",
      action: action,
      payload: payload
    };
    this.state.auditLogs.unshift(log);
    // Limit to 500 items to avoid storage explosion
    if (this.state.auditLogs.length > 500) {
      this.state.auditLogs.pop();
    }
  }

  // --- Recipe Costing & Margin Engine ---
  calculateIngredientCost(ingredientId, qty) {
    // raw ingredient cost per gram/ml/pc
    const raw = this.state.inventory.raw[ingredientId];
    if (raw) {
      const costPerStockUnit = raw.costPerPurchaseUnit / raw.conversionFactor;
      return costPerStockUnit * qty;
    }

    // if intermediate/prepared, recursively sum cost based on batchRecipes config
    const batchRecipe = this.state.config.batchRecipes[ingredientId];
    if (batchRecipe) {
      let costSum = 0;
      for (const [subIng, subQty] of Object.entries(batchRecipe.rawIngredients)) {
        costSum += this.calculateIngredientCost(subIng, subQty);
      }
      // expectedYieldRatio adjusts cost based on yield conversion (e.g. raw chicken loses weight)
      // To get cost per unit output = cost of raw inputs / expected yield
      // Note: rawIngredients ratio is defined per 1 unit of output (e.g. 1.25g chicken to get 1g keema)
      // so costSum represents input cost per unit of output!
      // Therefore, cost per unit output is exactly costSum!
      return costSum * qty;
    }
    return 0;
  }

  calculateMenuItemCost(itemId, variantId, modifierIds = []) {
    const item = this.state.config.menuItems[itemId];
    if (!item) return 0;

    const variant = item.variants[variantId];
    const multiplier = variant ? variant.recipeMultiplier : 1.0;

    let totalCost = 0;

    // Base Recipe Cost
    for (const [ing, baseQty] of Object.entries(item.recipe)) {
      totalCost += this.calculateIngredientCost(ing, baseQty * multiplier);
    }

    // Modifiers Cost
    for (const modId of modifierIds) {
      const mod = this.state.config.modifiers[modId];
      if (mod && mod.recipe) {
        for (const [ing, modQty] of Object.entries(mod.recipe)) {
          totalCost += this.calculateIngredientCost(ing, modQty);
        }
      }
    }

    return parseFloat(totalCost.toFixed(2));
  }

  calculateMenuItemMargin(itemId, variantId, modifierIds = []) {
    const item = this.state.config.menuItems[itemId];
    if (!item) return { cost: 0, price: 0, margin: 0, marginPct: 0 };

    const variant = item.variants[variantId];
    let price = variant ? variant.price : 0;

    for (const modId of modifierIds) {
      const mod = this.state.config.modifiers[modId];
      if (mod) price += mod.price;
    }

    const cost = this.calculateMenuItemCost(itemId, variantId, modifierIds);
    const margin = price - cost;
    const marginPct = price > 0 ? (margin / price) * 100 : 0;

    return {
      cost: parseFloat(cost.toFixed(2)),
      price: price,
      margin: parseFloat(margin.toFixed(2)),
      marginPct: parseFloat(marginPct.toFixed(1))
    };
  }

  // --- Smart Stock Availability Checker ---
  getMenuItemAvailableStock(itemId, variantId, modifierIds = []) {
    const item = this.state.config.menuItems[itemId];
    if (!item) return 0;

    const variant = item.variants[variantId];
    const multiplier = variant ? variant.recipeMultiplier : 1.0;

    // Calculate aggregated requirements per item ordered
    const requirements = {};
    for (const [ing, baseQty] of Object.entries(item.recipe)) {
      requirements[ing] = (requirements[ing] || 0) + (baseQty * multiplier);
    }
    for (const modId of modifierIds) {
      const mod = this.state.config.modifiers[modId];
      if (mod && mod.recipe) {
        for (const [ing, modQty] of Object.entries(mod.recipe)) {
          requirements[ing] = (requirements[ing] || 0) + modQty;
        }
      }
    }

    let minLimit = Infinity;
    for (const [ing, needed] of Object.entries(requirements)) {
      if (needed <= 0) continue; // ignore negative ingredients like "no onion"

      const isRaw = this.state.inventory.raw[ing] !== undefined;
      const inv = isRaw ? this.state.inventory.raw[ing] : (this.state.inventory.intermediate[ing] || this.state.inventory.prepared[ing]);
      if (!inv) continue;

      const availableStock = inv.stock - inv.reserved;
      const capacity = Math.floor(availableStock / needed);
      if (capacity < minLimit) {
        minLimit = capacity;
      }
    }

    return minLimit === Infinity ? 0 : Math.max(0, minLimit);
  }

  // --- Labor Station Capacities & ETAs ---
  getStationEffectiveCapacity(stationId) {
    const workers = this.state.config.workers.filter(w => w.stations && w.stations.includes(stationId) && w.active);
    if (workers.length === 0) {
      // Fallback if no worker is checked in, use a tiny default capacity to avoid divide-by-zero
      const station = this.state.config.stations[stationId];
      return station ? station.baseCapacity * 0.5 : 0.5;
    }
    return workers.reduce((sum, w) => {
      const basePrepTime = 3.0;
      const capacityContribution = (basePrepTime / w.prepTime) / w.stations.length;
      return sum + capacityContribution;
    }, 0);
  }

  getStationQueueTime(stationId) {
    const capacity = this.getStationEffectiveCapacity(stationId);
    
    // Sum remaining prep time of active items in kitchen
    let totalWorkload = 0;
    this.state.orders.forEach(order => {
      if (["ACCEPTED", "COOKING"].includes(order.fulfillmentStatus)) {
        order.items.forEach(item => {
          const menuInfo = this.state.config.menuItems[item.id];
          if (menuInfo && menuInfo.station === stationId && item.status !== "READY") {
            totalWorkload += menuInfo.prepTime * item.quantity;
          }
        });
      }
    });

    return totalWorkload / capacity;
  }

  getRushMultiplier() {
    const activeCount = this.state.orders.filter(o => ["ACCEPTED", "COOKING"].includes(o.fulfillmentStatus)).length;
    const settings = this.state.config.settings;
    const thresholds = settings.rushThresholds;
    const multipliers = settings.rushMultipliers;

    if (activeCount <= thresholds[0]) return multipliers[0]; // 1.0
    if (activeCount <= thresholds[1]) return multipliers[1]; // 1.1
    if (activeCount <= thresholds[2]) return multipliers[2]; // 1.25
    return multipliers[3]; // 1.5
  }

  calculateCartWaitTime(cartItems) {
    if (cartItems.length === 0) return 0;
    
    const rush = this.getRushMultiplier();
    const stationETAs = {};

    cartItems.forEach(cartItem => {
      const menuInfo = this.state.config.menuItems[cartItem.id];
      if (!menuInfo) return;
      const stationId = menuInfo.station;
      const currentQueue = this.getStationQueueTime(stationId);
      const itemPrep = menuInfo.prepTime;

      // Item ETA = (Queue + Prep) * Rush Multiplier
      const itemETA = (currentQueue + itemPrep) * rush;

      if (!stationETAs[stationId] || itemETA > stationETAs[stationId]) {
        stationETAs[stationId] = itemETA;
      }
    });

    const maxETA = Math.max(...Object.values(stationETAs), 0);
    return Math.ceil(maxETA);
  }

  // --- Layer 1 Business Actions ---

  // Atomic checkout reservations
  reserveInventoryAtomically(orderData) {
    let success = false;
    this.updateState((state) => {
      // Reload state synchronously from localStorage right before checking to guarantee transaction integrity
      const rawData = localStorage.getItem(this.storageKey);
      if (rawData) {
        const parsed = JSON.parse(rawData);
        state.inventory = parsed.inventory; // restore current inventory snapshot
      }

      // 1. Accumulate requirements
      const required = {};
      for (const item of orderData.items) {
        const qty = item.quantity;
        const menuInfo = state.config.menuItems[item.id];
        if (!menuInfo) continue;
        const multiplier = menuInfo.variants[item.variant].recipeMultiplier;
        
        // Base recipe ingredients
        for (const [ing, baseQty] of Object.entries(menuInfo.recipe)) {
          required[ing] = (required[ing] || 0) + (baseQty * multiplier * qty);
        }

        // Modifiers ingredients
        for (const modId of item.modifiers || []) {
          const modInfo = state.config.modifiers[modId];
          if (modInfo && modInfo.recipe) {
            for (const [ing, modQty] of Object.entries(modInfo.recipe)) {
              required[ing] = (required[ing] || 0) + (modQty * qty);
            }
          }
        }
      }

      // 2. Validate availability
      let available = true;
      for (const [ing, needed] of Object.entries(required)) {
        const isRaw = state.inventory.raw[ing] !== undefined;
        const inv = isRaw ? state.inventory.raw[ing] : (state.inventory.intermediate[ing] || state.inventory.prepared[ing]);
        if (!inv || (inv.stock - inv.reserved) < needed) {
          available = false;
          break;
        }
      }

      if (available) {
        // 3. Make reservation
        for (const [ing, needed] of Object.entries(required)) {
          const isRaw = state.inventory.raw[ing] !== undefined;
          const inv = isRaw ? state.inventory.raw[ing] : (state.inventory.intermediate[ing] || state.inventory.prepared[ing]);
          inv.reserved += needed;
        }
        
        // 4. Create and push order
        const newOrder = {
          id: orderData.id || "AB-" + Math.floor(1000 + Math.random() * 9000),
          timestamp: new Date().toISOString(),
          customerName: orderData.customerName || "Walk-In",
          source: orderData.source || "DINE_IN",
          priority: orderData.priority || "NORMAL",
          items: orderData.items.map(it => ({
            ...it,
            status: "PENDING" // item-level status
          })),
          subtotal: orderData.subtotal,
          tax: orderData.tax,
          total: orderData.total,
          commission: orderData.commission || 0,
          netRevenue: orderData.netRevenue,
          eta: orderData.eta,
          fulfillmentStatus: "ACCEPTED",
          paymentStatus: orderData.paymentStatus || "UNPAID",
          timestamps: {
            accepted: new Date().toISOString(),
            cooking: null,
            ready: null,
            completed: null
          }
        };

        state.orders.push(newOrder);
        this.logAudit("Create Order", `Order #${newOrder.id} placed via ${newOrder.source}. Total: ₹${newOrder.total}`);
        success = true;
      }
    });

    return success;
  }

  // Release Inventory (Order Cancelled)
  cancelOrder(orderId) {
    this.updateState((state) => {
      const order = state.orders.find(o => o.id === orderId);
      if (!order) return;

      if (order.fulfillmentStatus === "CANCELLED") return;

      // Only release if we haven't already completed/cancelled
      if (order.fulfillmentStatus !== "COMPLETED") {
        // Release reservations
        for (const item of order.items) {
          const qty = item.quantity;
          const menuInfo = state.config.menuItems[item.id];
          if (!menuInfo) continue;
          const multiplier = menuInfo.variants[item.variant].recipeMultiplier;

          // Release base recipe
          for (const [ing, baseQty] of Object.entries(menuInfo.recipe)) {
            const isRaw = state.inventory.raw[ing] !== undefined;
            const inv = isRaw ? state.inventory.raw[ing] : (state.inventory.intermediate[ing] || state.inventory.prepared[ing]);
            if (inv) inv.reserved = Math.max(0, inv.reserved - (baseQty * multiplier * qty));
          }

          // Release modifiers
          for (const modId of item.modifiers || []) {
            const modInfo = state.config.modifiers[modId];
            if (modInfo && modInfo.recipe) {
              for (const [ing, modQty] of Object.entries(modInfo.recipe)) {
                const isRaw = state.inventory.raw[ing] !== undefined;
                const inv = isRaw ? state.inventory.raw[ing] : (state.inventory.intermediate[ing] || state.inventory.prepared[ing]);
                if (inv) inv.reserved = Math.max(0, inv.reserved - (modQty * qty));
              }
            }
          }
        }
      }

      order.fulfillmentStatus = "CANCELLED";
      this.logAudit("Cancel Order", `Order #${orderId} was cancelled.`);
    });
  }

  // Complete Order (Fulfillment completed)
  completeOrder(orderId) {
    this.updateState((state) => {
      const order = state.orders.find(o => o.id === orderId);
      if (!order) return;

      if (["COMPLETED", "CANCELLED"].includes(order.fulfillmentStatus)) return;

      // Consume stock & release reservations
      for (const item of order.items) {
        const qty = item.quantity;
        const menuInfo = state.config.menuItems[item.id];
        if (!menuInfo) continue;
        const multiplier = menuInfo.variants[item.variant].recipeMultiplier;

        // Base recipe
        for (const [ing, baseQty] of Object.entries(menuInfo.recipe)) {
          const isRaw = state.inventory.raw[ing] !== undefined;
          const inv = isRaw ? state.inventory.raw[ing] : (state.inventory.intermediate[ing] || state.inventory.prepared[ing]);
          if (inv) {
            const needed = baseQty * multiplier * qty;
            inv.stock = Math.max(0, inv.stock - needed);
            inv.reserved = Math.max(0, inv.reserved - needed);
          }
        }

        // Modifiers
        for (const modId of item.modifiers || []) {
          const modInfo = state.config.modifiers[modId];
          if (modInfo && modInfo.recipe) {
            for (const [ing, modQty] of Object.entries(modInfo.recipe)) {
              const isRaw = state.inventory.raw[ing] !== undefined;
              const inv = isRaw ? state.inventory.raw[ing] : (state.inventory.intermediate[ing] || state.inventory.prepared[ing]);
              if (inv) {
                const needed = modQty * qty;
                inv.stock = Math.max(0, inv.stock - needed);
                inv.reserved = Math.max(0, inv.reserved - needed);
              }
            }
          }
        }
      }

      order.fulfillmentStatus = "COMPLETED";
      order.timestamps.completed = new Date().toISOString();
      this.logAudit("Complete Order", `Order #${orderId} was completed/served.`);
    });
  }

  // Update payment status
  updatePaymentStatus(orderId, status) {
    this.updateState((state) => {
      const order = state.orders.find(o => o.id === orderId);
      if (!order) return;
      order.paymentStatus = status;
      this.logAudit("Payment Updated", `Order #${orderId} payment status set to ${status}.`);
    });
  }

  // Update item-level fulfillment in Kitchen
  updateOrderItemStatus(orderId, itemIndex, itemStatus) {
    this.updateState((state) => {
      const order = state.orders.find(o => o.id === orderId);
      if (!order) return;
      
      const item = order.items[itemIndex];
      if (!item) return;

      item.status = itemStatus; // e.g. "COOKING" or "READY"

      // Update order timestamps and overall fulfillmentStatus
      if (itemStatus === "COOKING" && !order.timestamps.cooking) {
        order.timestamps.cooking = new Date().toISOString();
        order.fulfillmentStatus = "COOKING";
      }

      // Check if all items in the order are ready
      const allReady = order.items.every(it => it.status === "READY");
      if (allReady) {
        order.fulfillmentStatus = "READY";
        order.timestamps.ready = new Date().toISOString();
        this.logAudit("Order Ready", `All items in Order #${orderId} are ready to serve.`);
      }
    });
  }

  // --- Morning Production Batch Prep ---
  produceBatch(recipeId, inputQty, actualYield) {
    let result = null;
    this.updateState((state) => {
      const recipe = state.config.batchRecipes[recipeId];
      if (!recipe) return;

      // 1. expected yield calculations
      // recipe.rawIngredients stores ratios (e.g. to make 1g/1pc of batch, consumes X grams/pcs of raw ingredient)
      // To produce batch, we check the main scaling raw ingredient (usually the first one, or we scale by inputQty)
      // e.g. rawIngredients: { raw_chicken: 1.25 }. inputQty is raw_chicken qty.
      // Expected Yield = inputQty * expectedYieldRatio / ratio.
      // For chicken_keema: rawIngredients: { raw_chicken: 1.25 }, expectedYieldRatio: 0.8.
      // If we use 1000g chicken: Expected Keema = 1000 * 0.8 / 1.25 = 640g ?
      // Wait, let's keep it simple: the recipe states the exact rawIngredients ratios per unit produced.
      // So inputQty specifies the target scale of the batch.
      // Let's define `inputQty` as the quantity of the *primary raw ingredient* being processed.
      // For instance: "I am prep-cooking 5000g of raw chicken".
      // Let's find the primary raw ingredient (the first key in rawIngredients):
      const primaryIng = Object.keys(recipe.rawIngredients)[0];
      const ratioPerUnitOutput = recipe.rawIngredients[primaryIng];
      
      // Expected output = (inputQty / ratioPerUnitOutput) * recipe.expectedYieldRatio;
      // Wait! If yield ratio is already accounted for in ratioPerUnitOutput (e.g. 1.25g chicken to make 1g keema, which is 80% yield):
      // Expected yield = inputQty / ratioPerUnitOutput.
      // Let's use this definition:
      const expectedYield = inputQty / ratioPerUnitOutput;

      // Deduct all required raw ingredients based on the scaled output
      const scaledOutput = expectedYield;
      for (const [subIng, ratio] of Object.entries(recipe.rawIngredients)) {
        const rawInv = state.inventory.raw[subIng];
        if (rawInv) {
          rawInv.stock = Math.max(0, rawInv.stock - (ratio * scaledOutput));
        }
      }

      // Add actual yield to intermediate/prepared stock
      const isIntermediate = state.inventory.intermediate[recipeId] !== undefined;
      const targetInv = isIntermediate ? state.inventory.intermediate[recipeId] : state.inventory.prepared[recipeId];
      
      if (targetInv) {
        targetInv.stock += actualYield;
      }

      const yieldPct = expectedYield > 0 ? (actualYield / expectedYield) * 100 : 0;
      const waste = Math.max(0, expectedYield - actualYield);

      const logMsg = `Produced ${actualYield}${targetInv.unit} of ${recipe.name} from ${inputQty}g of ${state.inventory.raw[primaryIng].name}. Yield: ${yieldPct.toFixed(1)}%, Waste: ${waste.toFixed(1)}${targetInv.unit}`;
      this.logAudit("Batch Production", logMsg);

      result = {
        expected: expectedYield,
        actual: actualYield,
        yieldPct: yieldPct,
        waste: waste
      };
    });
    return result;
  }

  // --- Expenses Panel ---
  addExpense(expenseData) {
    this.updateState((state) => {
      const cost = parseFloat(expenseData.cost);
      const newExpense = {
        id: "EXP-" + Math.floor(1000 + Math.random() * 9000),
        date: expenseData.date || new Date().toISOString().split("T")[0],
        item: expenseData.item,
        quantity: parseFloat(expenseData.quantity),
        unit: expenseData.unit,
        supplier: expenseData.supplier || "Cash Expense",
        cost: cost
      };

      state.expenses.unshift(newExpense);

      // If it corresponds to a raw ingredient, automatically add to raw stock!
      // This is a neat real-world touch!
      const rawKey = Object.keys(state.inventory.raw).find(k => state.inventory.raw[k].name.toLowerCase() === expenseData.item.toLowerCase() || k === expenseData.item);
      if (rawKey) {
        const raw = state.inventory.raw[rawKey];
        // convert purchase quantity to stock units (e.g. 5kg * 1000 = 5000g)
        const addedStock = newExpense.quantity * raw.conversionFactor;
        raw.stock += addedStock;
        // update the purchase unit cost if it changed!
        raw.costPerPurchaseUnit = cost / newExpense.quantity;
        this.logAudit("Inventory Purchase", `Restocked ${expenseData.item} +${newExpense.quantity}${expenseData.unit}. Updated price to ₹${raw.costPerPurchaseUnit.toFixed(2)}/${raw.purchaseUnit}`);
      } else {
        this.logAudit("Log Expense", `Recorded expense: ${newExpense.item} (₹${cost})`);
      }
    });
  }

  // --- Day Closing System ---
  closeDay() {
    let report = null;
    this.updateState((state) => {
      // Calculate revenue
      let totalSales = 0;
      let dineInSales = 0, takeawaySales = 0, swiggySales = 0, zomatoSales = 0, phoneSales = 0;
      let orderCount = 0;
      let itemSalesCounts = {};

      const completedOrders = state.orders.filter(o => o.fulfillmentStatus === "COMPLETED" || o.paymentStatus === "PAID");
      
      completedOrders.forEach(o => {
        totalSales += o.total;
        orderCount++;

        // Source sales
        if (o.source === "DINE_IN") dineInSales += o.total;
        else if (o.source === "TAKEAWAY") takeawaySales += o.total;
        else if (o.source === "SWIGGY") swiggySales += o.total;
        else if (o.source === "ZOMATO") zomatoSales += o.total;
        else if (o.source === "PHONE_ORDER") phoneSales += o.total;

        // Item breakdown
        o.items.forEach(it => {
          itemSalesCounts[it.id] = (itemSalesCounts[it.id] || 0) + it.quantity;
        });
      });

      // Calculate total expenses logged today
      const totalExpenses = state.expenses.reduce((sum, exp) => sum + exp.cost, 0);

      // Create inventory snapshot
      const inventorySnapshot = {
        raw: JSON.parse(JSON.stringify(state.inventory.raw)),
        intermediate: JSON.parse(JSON.stringify(state.inventory.intermediate)),
        prepared: JSON.parse(JSON.stringify(state.inventory.prepared))
      };

      // Create Report Journal
      report = {
        id: "REP-" + new Date().toISOString().split("T")[0],
        date: new Date().toISOString().split("T")[0],
        timestamp: new Date().toISOString(),
        orderCount: orderCount,
        revenue: totalSales,
        sourceBreakdown: {
          dineIn: dineInSales,
          takeaway: takeawaySales,
          swiggy: swiggySales,
          zomato: zomatoSales,
          phone: phoneSales
        },
        itemSales: itemSalesCounts,
        expenses: totalExpenses,
        netProfit: totalSales - totalExpenses,
        inventorySnapshot: inventorySnapshot
      };

      state.dayHistory.push(report);

      // Reset orders and expenses for the next operating cycle!
      // Keep completed orders but clear active cache, or clear overall day state:
      state.orders = [];
      state.expenses = [];
      
      // Clear reservations just in case of leaks
      for (const raw of Object.values(state.inventory.raw)) raw.reserved = 0;
      for (const inter of Object.values(state.inventory.intermediate)) inter.reserved = 0;
      for (const prep of Object.values(state.inventory.prepared)) prep.reserved = 0;

      this.logAudit("Day Closed", `Successfully finalized operations for ${report.date}. Net Revenue: ₹${totalSales}, Expenses: ₹${totalExpenses}`);
    });
    return report;
  }

  // --- Configuration Layer Edits (Layer 2) ---
  updateMenuItemPrice(itemId, variantId, newPrice) {
    this.updateState((state) => {
      const item = state.config.menuItems[itemId];
      if (item && item.variants[variantId]) {
        const oldPrice = item.variants[variantId].price;
        item.variants[variantId].price = parseFloat(newPrice);
        this.logAudit("Config Change", `Changed ${item.name} (${variantId}) price from ₹${oldPrice} to ₹${newPrice}`);
      }
    });
  }

  updateMenuItemRecipe(itemId, ingredientId, newQty) {
    this.updateState((state) => {
      const item = state.config.menuItems[itemId];
      if (item) {
        const oldQty = item.recipe[ingredientId] || 0;
        if (newQty <= 0) {
          delete item.recipe[ingredientId];
        } else {
          item.recipe[ingredientId] = parseFloat(newQty);
        }
        this.logAudit("Config Change", `Updated ${item.name} recipe ingredient ${ingredientId}: ${oldQty} -> ${newQty}`);
      }
    });
  }

  updateWorkerShift(workerId, isActive, stations = null, prepTime = null) {
    this.updateState((state) => {
      const worker = state.config.workers.find(w => w.id === workerId);
      if (worker) {
        const oldActive = worker.active;
        const oldStations = worker.stations;
        
        worker.active = isActive;
        if (stations !== null) {
          worker.stations = Array.isArray(stations) ? stations : [stations];
        }
        if (prepTime !== null) {
          worker.prepTime = parseInt(prepTime);
        }

        this.logAudit("Labor Change", `Worker ${worker.name}: Shift state changed. Active: ${oldActive} -> ${isActive}, Stations: ${JSON.stringify(oldStations)} -> ${JSON.stringify(worker.stations)}`);
      }
    });
  }

  addWorker(name, stations, prepTime) {
    this.updateState((state) => {
      const newWorker = {
        id: "w" + (state.config.workers.length + 1),
        name: name,
        stations: Array.isArray(stations) ? stations : [stations],
        prepTime: parseInt(prepTime),
        active: true
      };
      state.config.workers.push(newWorker);
      this.logAudit("Labor Change", `Added new worker ${name} to stations ${JSON.stringify(stations)} with prep time ${prepTime} min`);
    });
  }

  addStation(id, name) {
    this.updateState((state) => {
      state.config.stations[id] = { id: id, name: name, baseCapacity: 1 };
      this.logAudit("Config Change", `Added station: ${name} (${id})`);
    });
  }

  removeStation(id) {
    this.updateState((state) => {
      delete state.config.stations[id];
      // remove station reference from menu items
      Object.values(state.config.menuItems).forEach(item => {
        if (item.station === id) item.station = "";
      });
      // remove from workers
      state.config.workers.forEach(w => {
        if (w.stations) {
          w.stations = w.stations.filter(s => s !== id);
        }
      });
      this.logAudit("Config Change", `Removed station ID: ${id}`);
    });
  }

  addMenuItem(itemData) {
    this.updateState((state) => {
      state.config.menuItems[itemData.id] = {
        id: itemData.id,
        name: itemData.name,
        station: itemData.station,
        prepTime: parseInt(itemData.prepTime) || 3,
        active: true,
        image: itemData.image || null,
        variants: itemData.variants || {},
        recipe: itemData.recipe || {}
      };
      this.logAudit("Config Change", `Added new menu item: ${itemData.name}`);
    });
  }
}

// Instantiate global store on window object so all modules can access it
window.AutoBrixStore = new AutoBrixStore();
